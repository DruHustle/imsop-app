import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  packageSelection,
  pendingInstall,
  type InstallActor,
  type InstallOperation,
} from "./contract";
import {
  MANAGEMENT_PERMISSIONS,
  NodeRedError,
  nodeRedConfigurations,
  runtimeScope,
  type NodeRedConfiguration,
} from "./configuration";
import { NodeRedClient } from "./client";
import { NodeRedPackageService } from "./service";
import type { InstallStore } from "./store";

const actor: InstallActor = {
  id: 7,
  sessionId: randomUUID(),
  workspaceId: randomUUID(),
};
const gatewayId = "warehouse-fixture";
const selection = { module: "@fixture/node-red-test", version: "1.2.3" };
const config: NodeRedConfiguration = {
  workspaceId: actor.workspaceId,
  token: "a".repeat(64),
  adminUrl: "http://127.0.0.1:18882/admin",
  target: {
    id: randomUUID(),
    gatewayId,
    label: "Synthetic warehouse gateway",
    version: "4.1.4",
    revision: "b".repeat(64),
  },
};
const environment = { ...process.env };
afterEach(() => {
  for (const key of Object.keys(process.env))
    if (!(key in environment)) delete process.env[key];
  Object.assign(process.env, environment);
});
function configure(overrides: Record<string, unknown> = {}) {
  process.env.IMSOP_NODE_RED_MANAGEMENT_ENABLED = "true";
  process.env.IMSOP_EDGE_GATEWAYS = JSON.stringify({
    [gatewayId]: {
      workspaceId: actor.workspaceId,
      secret: "edge-fixture-secret-at-least-32-characters",
      sources: ["sensor-a"],
    },
  });
  process.env.IMSOP_NODE_RED_TOKEN_WAREHOUSE = config.token;
  process.env.IMSOP_NODE_RED_TARGETS = JSON.stringify({
    [gatewayId]: {
      commissioned: true,
      adminUrl: config.adminUrl,
      runtimeId: config.target.id,
      runtimeVersion: config.target.version,
      label: config.target.label,
      tokenEnv: "IMSOP_NODE_RED_TOKEN_WAREHOUSE",
      ...overrides,
    },
  });
}
function memoryStore() {
  const records = new Map<string, InstallOperation>();
  let saved: InstallOperation | null = null;
  let allowed = true,
    failSave = false,
    claims = 0;
  const store: InstallStore = {
    current: async () => structuredClone(saved),
    authorize: async () => {
      if (!allowed)
        throw new NodeRedError("Administrator access changed", true, 403);
    },
    claim: async (next, identity) => {
      await store.authorize(identity);
      claims++;
      const previous = records.get(next.id);
      if (previous)
        return { operation: structuredClone(previous), accepted: false };
      if (pendingInstall(saved))
        throw new NodeRedError("Installation pending or unconfirmed", true);
      saved = structuredClone(next);
      records.set(next.id, saved);
      return { operation: structuredClone(next), accepted: true };
    },
    finish: async (next) => {
      if (failSave) throw Error("Synthetic persistence outage");
      if (!saved || saved.id !== next.id) throw Error("Wrong reservation");
      if (!pendingInstall(saved)) return structuredClone(saved);
      saved = structuredClone(next);
      records.set(next.id, saved);
      return structuredClone(saved);
    },
  };
  return {
    store,
    get claims() {
      return claims;
    },
    set allowed(value: boolean) {
      allowed = value;
    },
    set failSave(value: boolean) {
      failSave = value;
    },
  };
}
function runtimeFixture(store?: InstallStore) {
  const state = {
    installed: false,
    posts: 0,
    postFailure: "" as "" | "lost" | "refused",
    failReadback: false,
    pluginOnly: false,
    wrongVersion: false,
    pendingVersion: false,
    loadError: false,
    runtimeId: config.target.id,
    permissions: MANAGEMENT_PERMISSIONS,
    runtimeVersion: "4.1.4",
    allowUpdate: false,
    genericPackage: false,
  };
  const calls: { url: string; init: RequestInit }[] = [];
  let beforePost: (() => Promise<void>) | undefined;
  const entry = () => ({
    module: selection.module,
    name: "fixture",
    version: state.wrongVersion ? "9.9.9" : selection.version,
    ...(state.loadError ? { err: "private runtime exception" } : {}),
  });
  const module = () => ({
    name: selection.module,
    version: entry().version,
    nodes: state.pluginOnly ? [] : [entry()],
    plugins: state.pluginOnly ? [entry()] : [],
    path: "/private/userDir",
    ...(state.pendingVersion ? { pending_version: "9.9.9" } : {}),
  });
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json",
        "x-smart-logistics-node-red-runtime": state.runtimeId,
      },
    });
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith("https://registry.npmjs.org/"))
      return reply({
        name: selection.module,
        version: selection.version,
        description: "Synthetic package",
        ...(!state.genericPackage
          ? {
              "node-red": state.pluginOnly
                ? { plugins: { fixture: "plugin.js" } }
                : { nodes: { fixture: "node.js" } },
            }
          : {}),
      });
    if (init.method === "POST") {
      if (store)
        assert.equal(
          (await store.current(runtimeScope(config)))?.state,
          "installing",
          "reservation must precede POST",
        );
      await beforePost?.();
      state.posts++;
      if (state.postFailure === "refused")
        return reply({ message: "Bearer secret-value" }, 401);
      if (state.postFailure === "lost")
        throw Error("password=secret-value http://private.gateway");
      state.installed = true;
      return reply(module());
    }
    if (state.posts && state.failReadback)
      return reply({ message: "secret-value" }, 401);
    if (url.endsWith("/settings"))
      return reply({
        version: state.runtimeVersion,
        user: { permissions: state.permissions },
        externalModules: {
          palette: {
            allowInstall: true,
            allowUpdate: state.allowUpdate,
            allowUpload: false,
          },
        },
      });
    if (url.endsWith("/nodes"))
      return reply(state.installed && !state.pluginOnly ? [entry()] : []);
    if (url.endsWith("/plugins"))
      return reply(state.installed && state.pluginOnly ? [entry()] : []);
    if (url.endsWith("/nodes/" + encodeURIComponent(selection.module)))
      return reply(module());
    throw Error("Unexpected synthetic request");
  };
  return {
    state,
    calls,
    fetcher,
    set beforePost(value: (() => Promise<void>) | undefined) {
      beforePost = value;
    },
  };
}
function fixture() {
  const memory = memoryStore(),
    runtime = runtimeFixture(memory.store);
  const service = new NodeRedPackageService(
    memory.store,
    () => [config],
    runtime.fetcher,
  );
  return { ...memory, memory, runtime, service };
}
const request = (reviewToken: string) => ({
  requestId: randomUUID(),
  reviewToken,
  acknowledgeCodeExecution: true as const,
});
async function start(service: NodeRedPackageService) {
  const review = await service.review(actor, gatewayId, selection),
    input = request(review.reviewToken);
  const operation = await service.install(actor, gatewayId, input);
  return { input, operation };
}
async function settled(store: InstallStore) {
  for (let i = 0; i < 100; i++) {
    const saved = await store.current(runtimeScope(config));
    if (saved && saved.state !== "installing") return saved;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw Error("Synthetic operation did not settle");
}

test("package selection excludes commands, paths, URLs, aliases, tags and non-exact versions", () => {
  for (const module of [
    "../private",
    "/tmp/nodes",
    "file:./nodes",
    "https://example.test/pkg",
    "git+ssh://example.test/repo",
    "npm:other-package",
    "package@latest",
    "@scope/../package",
    "pkg;id",
    "pkg%2fother",
    "node-red",
    "node_modules",
    "npm",
    "--help",
  ])
    assert.equal(
      packageSelection.safeParse({ ...selection, module }).success,
      false,
      module,
    );
  for (const version of [
    "latest",
    "next",
    "^1.2.3",
    "~1.2.3",
    "1.x",
    "1.2",
    ">=1.2.3",
    "1.2.3 || 2.0.0",
    "v1.2.3",
    "01.2.3",
    "1.2.3-01",
    "1.2.3;id",
    "npm:alias@1.2.3",
  ])
    assert.equal(
      packageSelection.safeParse({ ...selection, version }).success,
      false,
      version,
    );
  assert.equal(
    packageSelection.safeParse({ ...selection, version: "1.2.3-rc.1+build.7" })
      .success,
    true,
  );
  assert.equal(
    packageSelection.safeParse({
      ...selection,
      url: "https://example.test/pkg.tgz",
    }).success,
    false,
  );
});
test("enrollment is disabled by default, commissioned, loopback-only, and bound to the existing gateway workspace", () => {
  delete process.env.IMSOP_NODE_RED_MANAGEMENT_ENABLED;
  assert.equal(nodeRedConfigurations(), null);
  configure();
  assert.equal(nodeRedConfigurations()![0].workspaceId, actor.workspaceId);
  for (const adminUrl of [
    "http://localhost:1882/admin",
    "http://192.168.0.2:1882/admin",
    "https://example.test/admin",
    "http://user:secret@127.0.0.1:1882/admin",
    "http://127.0.0.1:1882/admin?token=secret",
    "http://127.0.0.1:1882/flows",
  ]) {
    configure({ adminUrl });
    assert.throws(nodeRedConfigurations, NodeRedError);
  }
  for (const overrides of [
    { commissioned: false },
    { runtimeVersion: "4.1" },
    { tokenEnv: "PATH" },
    { workspaceId: randomUUID() },
  ]) {
    configure(overrides);
    assert.throws(nodeRedConfigurations, NodeRedError);
  }
  configure();
  process.env.IMSOP_EDGE_GATEWAYS = "{}";
  assert.throws(nodeRedConfigurations, NodeRedError);
  configure();
  const targets = JSON.parse(process.env.IMSOP_NODE_RED_TARGETS!);
  process.env.IMSOP_EDGE_GATEWAYS = JSON.stringify({
    ...JSON.parse(process.env.IMSOP_EDGE_GATEWAYS!),
    other: {
      workspaceId: randomUUID(),
      secret: "other-secret-at-least-32-characters",
      sources: ["other"],
    },
  });
  process.env.IMSOP_NODE_RED_TARGETS = JSON.stringify({
    ...targets,
    other: targets[gatewayId],
  });
  assert.throws(nodeRedConfigurations, NodeRedError);
});
test("scoped listing and all gateway methods reject another workspace before any runtime request", async () => {
  const { service, runtime } = fixture(),
    other = { ...actor, workspaceId: randomUUID() };
  assert.deepEqual((await service.targets(other)).targets, []);
  for (const run of [
    () => service.status(other, gatewayId),
    () => service.review(other, gatewayId, selection),
    () => service.install(other, gatewayId, request("synthetic")),
    () => service.reconcile(other, gatewayId),
  ])
    await assert.rejects(run, /no enrolled/);
  assert.equal(runtime.calls.length, 0);
});
test("private routing uses bounded nonredirecting reads without exposing token, host or upstream errors", async () => {
  const { service, runtime } = fixture();
  const status = await service.status(actor, gatewayId);
  assert.equal(status.state, "ready");
  assert.doesNotMatch(JSON.stringify(status), /127\.0\.0\.1|secret-value/);
  assert.ok(!JSON.stringify(status).includes(config.token));
  for (const { init } of runtime.calls) {
    assert.equal(init.redirect, "error");
    assert.ok(init.signal instanceof AbortSignal);
  }
  runtime.state.runtimeId = randomUUID();
  await assert.rejects(
    service.review(actor, gatewayId, selection),
    /enrolled Node-RED runtime/,
  );
  assert.equal(runtime.state.posts, 0);
});
test("runtime version, permissions, palette policy and declared Node-RED package metadata are mandatory", async () => {
  for (const patch of [
    { runtimeVersion: "4.1.3" },
    { permissions: ["*"] },
    { allowUpdate: true },
    { genericPackage: true },
  ]) {
    const { service, runtime } = fixture();
    Object.assign(runtime.state, patch);
    await assert.rejects(service.review(actor, gatewayId, selection));
    assert.equal(runtime.state.posts, 0);
  }
});
test("streamed responses are bounded even without a content-length header", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(600_000));
    },
    cancel() {
      cancelled = true;
    },
  });
  const fetcher: typeof fetch = async () =>
    new Response(stream, {
      headers: {
        "content-type": "application/json",
        "x-smart-logistics-node-red-runtime": config.target.id,
      },
    });
  await assert.rejects(
    new NodeRedClient(config, fetcher).checkRuntime(),
    /size limit/,
  );
  assert.equal(cancelled, true);
});
for (const pluginOnly of [false, true])
  test(`one reserved exact installation verifies ${pluginOnly ? "plugin" : "node"} inventory and deduplicates request IDs`, async () => {
    const { service, runtime, store } = fixture();
    runtime.state.pluginOnly = pluginOnly;
    const { input, operation } = await start(service);
    assert.equal(operation.state, "installing");
    assert.equal((await settled(store)).state, "installed");
    assert.equal(runtime.state.posts, 1);
    const post = runtime.calls.find((call) => call.init.method === "POST")!;
    assert.equal(post.url, config.adminUrl + "/nodes");
    assert.deepEqual(JSON.parse(String(post.init.body)), selection);
    const registry = runtime.calls.find((call) =>
      call.url.startsWith("https://registry.npmjs.org/"),
    )!;
    assert.equal(
      new Headers(registry.init.headers).has("Authorization"),
      false,
    );
    assert.equal(
      (await service.install(actor, gatewayId, input)).state,
      "installed",
    );
    assert.equal(runtime.state.posts, 1);
  });
test("review is bound to actor, session, workspace, runtime enrollment, expiry and explicit acknowledgement", async (t) => {
  const { service, runtime, memory } = fixture();
  const review = await service.review(actor, gatewayId, selection),
    input = request(review.reviewToken);
  for (const identity of [
    { ...actor, id: 8 },
    { ...actor, sessionId: randomUUID() },
  ])
    await assert.rejects(
      service.install(identity, gatewayId, input),
      /administrator and runtime/,
    );
  const changed = new NodeRedPackageService(
    memory.store,
    () => [
      { ...config, target: { ...config.target, revision: "c".repeat(64) } },
    ],
    runtime.fetcher,
  );
  await assert.rejects(
    changed.install(actor, gatewayId, input),
    /no longer matches/,
  );
  await assert.rejects(
    service.install(actor, gatewayId, {
      ...input,
      acknowledgeCodeExecution: false,
    } as never),
  );
  await assert.rejects(
    service.install(actor, gatewayId, {
      ...input,
      reviewToken: review.reviewToken + "extra",
    }),
    /invalid/,
  );
  const later = Date.now() + 601_000;
  t.mock.method(Date, "now", () => later);
  await assert.rejects(service.install(actor, gatewayId, input), /expired/);
  assert.equal(memory.claims, 0);
  assert.equal(runtime.state.posts, 0);
});
test("an existing package is never upgraded after review", async () => {
  const { service, runtime, store } = fixture();
  const review = await service.review(actor, gatewayId, selection);
  runtime.state.installed = true;
  runtime.state.wrongVersion = true;
  await service.install(actor, gatewayId, request(review.reviewToken));
  assert.equal((await settled(store)).state, "failed");
  assert.equal(runtime.state.posts, 0);
});
test("lost acknowledgements and failures after accepted POST stay unconfirmed and block new requests", async () => {
  for (const mode of [
    "lost",
    "readback",
    "version",
    "pending",
    "load-error",
  ] as const) {
    const { service, runtime, store } = fixture();
    if (mode === "lost") runtime.state.postFailure = "lost";
    if (mode === "readback") runtime.state.failReadback = true;
    if (mode === "version") runtime.state.wrongVersion = true;
    if (mode === "pending") runtime.state.pendingVersion = true;
    if (mode === "load-error") runtime.state.loadError = true;
    const { input } = await start(service);
    const result = await settled(store);
    assert.equal(result.state, "unconfirmed", mode);
    assert.equal(runtime.state.posts, 1);
    await assert.rejects(
      service.install(actor, gatewayId, { ...input, requestId: randomUUID() }),
      /pending or unconfirmed/,
    );
    assert.doesNotMatch(
      JSON.stringify(result),
      /secret-value|private\.gateway/,
    );
  }
});
test("only an authoritative pre-handler credential refusal is a definite POST failure", async () => {
  const { service, runtime, store } = fixture();
  runtime.state.postFailure = "refused";
  await start(service);
  assert.equal((await settled(store)).state, "failed");
  assert.equal(runtime.state.posts, 1);
});
test("restart and read-only reconciliation never replay a request or infer failure from absence", async () => {
  const { service, runtime, store } = fixture();
  runtime.state.postFailure = "lost";
  const { operation } = await start(service);
  await settled(store);
  const restarted = new NodeRedPackageService(
    store,
    () => [config],
    runtime.fetcher,
  );
  assert.equal(
    (await restarted.status(actor, gatewayId)).operation?.id,
    operation.id,
  );
  assert.equal(
    (await restarted.reconcile(actor, gatewayId))?.state,
    "unconfirmed",
  );
  runtime.state.installed = true;
  assert.equal(
    (await restarted.reconcile(actor, gatewayId))?.state,
    "installed",
  );
  assert.equal(runtime.state.posts, 1);
});
test("revoked authority is checked at durable claim and again immediately before POST", async (t) => {
  const { service, runtime, memory, store } = fixture();
  const review = await service.review(actor, gatewayId, selection);
  memory.allowed = false;
  await assert.rejects(
    service.install(actor, gatewayId, request(review.reviewToken)),
    /access changed/,
  );
  memory.allowed = true;
  const current = store.current;
  t.mock.method(
    store,
    "current",
    async (scope: Parameters<InstallStore["current"]>[0]) => {
      const result = await current(scope);
      if (result?.state === "installing") memory.allowed = false;
      return result;
    },
  );
  // Revocation during the preflight's last inventory response precedes fresh authorization.
  const fetcher: typeof fetch = async (input, init) => {
    const response = await runtime.fetcher(input, init);
    if (String(input).endsWith("/plugins")) memory.allowed = false;
    return response;
  };
  const guarded = new NodeRedPackageService(store, () => [config], fetcher);
  await guarded.install(actor, gatewayId, request(review.reviewToken));
  assert.equal((await settled(store)).state, "failed");
  assert.equal(runtime.state.posts, 0);
});
test("persistence failure retains the committed reservation instead of retrying or clearing it", async () => {
  const { service, runtime, memory, store } = fixture();
  memory.failSave = true;
  await start(service);
  for (let i = 0; i < 100 && runtime.state.posts === 0; i++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(runtime.state.posts, 1);
  assert.equal(
    (await store.current(runtimeScope(config)))?.state,
    "installing",
  );
  await assert.rejects(service.review(actor, gatewayId, selection), /pending/);
  await assert.rejects(service.reconcile(actor, gatewayId), /response window/);
});

test("module read-back cannot erase aggregate pending/load errors or contradict the reported version", async () => {
  for (const warning of ["pending", "error", "version"] as const) {
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      const entry = { module: selection.module, version: selection.version };
      const body = url.endsWith("/plugins")
        ? []
        : url.endsWith("/nodes")
          ? [
              {
                ...entry,
                ...(warning === "pending" ? { pending_version: "2.0.0" } : {}),
                ...(warning === "error" ? { err: "Synthetic load error" } : {}),
              },
            ]
          : {
              name: selection.module,
              version: warning === "version" ? "2.0.0" : selection.version,
              nodes: [entry],
              plugins: [],
            };
      return new Response(JSON.stringify(body), {
        headers: {
          "content-type": "application/json",
          "x-smart-logistics-node-red-runtime": config.target.id,
        },
      });
    };
    const client = new NodeRedClient(config, fetcher);
    if (warning === "version")
      await assert.rejects(client.installed(selection), /inventory changed/);
    else {
      const installed = await client.installed(selection);
      assert.equal(
        warning === "pending"
          ? installed?.pendingVersion
          : installed?.loadError,
        warning === "pending" ? "2.0.0" : true,
      );
    }
  }
});
