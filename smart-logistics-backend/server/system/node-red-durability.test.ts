import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { connection } from "../src/config/db";
import { migrate } from "../src/migrate";
import app from "../src/app";
import { createPostgresInstallStore } from "../src/node-red/store";
import { NodeRedPackageService } from "../src/node-red/service";
import {
  MANAGEMENT_PERMISSIONS,
  runtimeScope,
  type NodeRedConfiguration,
} from "../src/node-red/configuration";
import type { InstallActor, InstallOperation } from "../src/node-red/contract";

// Never run against a production or shared application database.
assert.match(
  process.env.DATABASE_URL || "",
  /@127\.0\.0\.1:55467\/imsop_node_red_test$/,
);
assert.equal(process.env.NODE_ENV, "test");
const replica = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15_000,
});
const first = createPostgresInstallStore(connection),
  second = createPostgresInstallStore(replica);
let actor: InstallActor, other: InstallActor;
async function provision() {
  const workspaceId = randomUUID(),
    sessionId = randomUUID();
  await connection.query(
    "INSERT INTO workspaces(id,name) VALUES($1,'Isolated Node-RED qualification')",
    [workspaceId],
  );
  const user = (
    await connection.query(
      "INSERT INTO users(name,email,password,role,active_workspace_id) VALUES('Fixture',$1,'unused-bcrypt-fixture','admin',$2) RETURNING id",
      [randomUUID() + "@isolated.test", workspaceId],
    )
  ).rows[0];
  await connection.query(
    "INSERT INTO workspace_memberships(user_id,workspace_id) VALUES($1,$2)",
    [user.id, workspaceId],
  );
  await connection.query(
    "INSERT INTO auth_sessions(id,user_id,workspace_id,version,role,expires_at) VALUES($1,$2,$3,0,'admin',now()+interval '1 hour')",
    [sessionId, user.id, workspaceId],
  );
  return { id: user.id, workspaceId, sessionId };
}
function operation(
  identity = actor,
  runtimeId: string = randomUUID(),
): InstallOperation {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    runtimeId,
    workspaceId: identity.workspaceId,
    gatewayId: "warehouse-fixture",
    targetRevision: "a".repeat(64),
    actorId: identity.id,
    module: "node-red-contrib-fixture",
    version: "1.2.3",
    state: "installing",
    message: "Synthetic durable reservation",
    startedAt: now,
    updatedAt: now,
  };
}
before(async () => {
  await migrate(process.env.DATABASE_URL);
  actor = await provision();
  other = await provision();
});
after(async () => {
  await replica.end();
  await connection.end();
});

test("current readiness requires the new ledger and retains the immutable-mail prerequisite", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/ready`;
  try {
    assert.equal((await fetch(url)).status, 200);
    for (const name of [
      "007_immutable_mail.sql",
      "008_node_red_package_management.sql",
    ]) {
      const checksum = (
        await connection.query(
          "SELECT checksum FROM schema_migrations WHERE name=$1",
          [name],
        )
      ).rows[0].checksum;
      try {
        await connection.query(
          "UPDATE schema_migrations SET checksum=NULL WHERE name=$1",
          [name],
        );
        assert.equal((await fetch(url)).status, 503);
      } finally {
        await connection.query(
          "UPDATE schema_migrations SET checksum=$1 WHERE name=$2",
          [checksum, name],
        );
      }
    }
    assert.equal((await fetch(url)).status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test("independent PostgreSQL connections serialize competing runtime reservations and deduplicate one request", async () => {
  const one = operation(),
    two = {
      ...operation(actor, one.runtimeId),
      module: "node-red-contrib-other",
    };
  const results = await Promise.allSettled([
    first.claim(one, actor),
    second.claim(two, actor),
  ]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected").length, 1);
  const current = (await first.current(one))!;
  assert.equal((await second.claim(current, actor)).accepted, false);
  assert.equal(
    (
      await connection.query(
        "SELECT count(*)::int AS total FROM node_red_install_requests WHERE runtime_id=$1",
        [one.runtimeId],
      )
    ).rows[0].total,
    1,
  );
  await first.finish({
    ...current,
    state: "unconfirmed",
    message: "Synthetic response lost",
  });
  const restarted = createPostgresInstallStore(replica);
  assert.equal((await restarted.current(one))?.state, "unconfirmed");
  await assert.rejects(
    restarted.claim(operation(actor, one.runtimeId), actor),
    /pending or unconfirmed/,
  );
});
test("workspace and gateway rebinding cannot expose or replace a durable runtime operation", async () => {
  const original = operation();
  await first.claim(original, actor);
  const rebound = { ...operation(other, original.runtimeId) };
  await assert.rejects(second.current(rebound), /saved enrollment/);
  await assert.rejects(second.claim(rebound, other), /saved enrollment/);
  await assert.rejects(
    second.current({ ...original, gatewayId: "other-gateway" }),
    /saved enrollment/,
  );
  await assert.rejects(
    second.claim({ ...rebound, id: original.id }, other),
    /different installation/,
  );
  assert.equal((await first.current(original))?.id, original.id);
  await assert.rejects(
    connection.query(
      "UPDATE node_red_install_requests SET workspace_id=$1 WHERE id=$2",
      [other.workspaceId, original.id],
    ),
    /immutable/,
  );
});
test("request identifiers cannot be reused across runtimes, and late results cannot undo reconciliation", async () => {
  const original = operation();
  await first.claim(original, actor);
  await assert.rejects(
    second.claim({ ...original, runtimeId: randomUUID() }, actor),
    /different installation/,
  );
  await first.finish({
    ...original,
    state: "unconfirmed",
    message: "Synthetic lost response",
  });
  await second.finish({
    ...original,
    state: "installed",
    message: "Read-back confirmed exact version",
  });
  assert.equal(
    (
      await first.finish({
        ...original,
        state: "unconfirmed",
        message: "Late network timeout",
      })
    ).state,
    "installed",
  );
  await assert.rejects(
    connection.query(
      "UPDATE node_red_install_requests SET state='installing' WHERE id=$1",
      [original.id],
    ),
    /cannot be reset/,
  );
  const newer = operation(actor, original.runtimeId);
  await second.claim(newer, actor);
  await assert.rejects(
    first.finish({ ...original, state: "failed" }),
    /active installation changed/,
  );
  assert.equal((await first.current(newer))?.id, newer.id);
});
test("durable claims verify current role, session revocation, membership and active workspace", async () => {
  for (const mutation of [
    "role",
    "session",
    "membership",
    "workspace",
    "disabled",
    "expiry",
  ] as const) {
    const identity = await provision();
    if (mutation === "role")
      await connection.query("UPDATE users SET role='engineer' WHERE id=$1", [
        identity.id,
      ]);
    if (mutation === "session")
      await connection.query(
        "UPDATE auth_sessions SET revoked_at=now() WHERE id=$1",
        [identity.sessionId],
      );
    if (mutation === "membership")
      await connection.query(
        "DELETE FROM workspace_memberships WHERE user_id=$1",
        [identity.id],
      );
    if (mutation === "workspace")
      await connection.query(
        "UPDATE users SET active_workspace_id=$1 WHERE id=$2",
        [other.workspaceId, identity.id],
      );
    if (mutation === "disabled")
      await connection.query("UPDATE users SET disabled=true WHERE id=$1", [
        identity.id,
      ]);
    if (mutation === "expiry")
      await connection.query(
        "UPDATE auth_sessions SET expires_at=now()-interval '1 second' WHERE id=$1",
        [identity.sessionId],
      );
    await assert.rejects(
      first.claim(operation(identity), identity),
      /active administrator session/,
      mutation,
    );
  }
});
test("a lost remote acknowledgement persists across service restart; inventory absence cannot unlock or replay it", async () => {
  const identity = await provision();
  const config: NodeRedConfiguration = {
    workspaceId: identity.workspaceId,
    token: "b".repeat(64),
    adminUrl: "http://127.0.0.1:18882/admin",
    target: {
      id: randomUUID(),
      gatewayId: "warehouse-fixture",
      label: "Synthetic warehouse",
      version: "4.1.4",
      revision: "c".repeat(64),
    },
  };
  const selection = { module: "node-red-contrib-fixture", version: "1.2.3" };
  let posts = 0,
    installed = false;
  const entry = { module: selection.module, version: selection.version };
  const reply = (body: unknown) =>
    new Response(JSON.stringify(body), {
      headers: {
        "content-type": "application/json",
        "x-smart-logistics-node-red-runtime": config.target.id,
      },
    });
  const transport: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("https://registry.npmjs.org/"))
      return reply({
        name: selection.module,
        version: selection.version,
        "node-red": { nodes: { fixture: "fixture.js" } },
      });
    if (init?.method === "POST") {
      assert.equal(
        (await second.current(runtimeScope(config)))?.state,
        "installing",
      );
      posts++;
      throw Error("Synthetic lost acknowledgement");
    }
    if (url.endsWith("/settings"))
      return reply({
        version: "4.1.4",
        user: { permissions: MANAGEMENT_PERMISSIONS },
        externalModules: {
          palette: {
            allowInstall: true,
            allowUpdate: false,
            allowUpload: false,
          },
        },
      });
    if (url.endsWith("/nodes")) return reply(installed ? [entry] : []);
    if (url.endsWith("/plugins")) return reply([]);
    return reply({
      name: selection.module,
      version: selection.version,
      nodes: [entry],
      plugins: [],
    });
  };
  const service = new NodeRedPackageService(first, () => [config], transport);
  const review = await service.review(
    identity,
    config.target.gatewayId,
    selection,
  );
  const request = {
    requestId: randomUUID(),
    reviewToken: review.reviewToken,
    acknowledgeCodeExecution: true as const,
  };
  const competing = new NodeRedPackageService(
    second,
    () => [config],
    transport,
  );
  await Promise.all([
    service.install(identity, config.target.gatewayId, request),
    competing.install(identity, config.target.gatewayId, request),
  ]);
  for (
    let i = 0;
    i < 100 &&
    (await second.current(runtimeScope(config)))?.state === "installing";
    i++
  )
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(
    (await second.current(runtimeScope(config)))?.state,
    "unconfirmed",
  );
  assert.equal(posts, 1);
  const restarted = new NodeRedPackageService(
    second,
    () => [config],
    transport,
  );
  assert.equal(
    (await restarted.status(identity, config.target.gatewayId)).operation?.id,
    request.requestId,
  );
  assert.equal(
    (await restarted.reconcile(identity, config.target.gatewayId))?.state,
    "unconfirmed",
  );
  await assert.rejects(
    restarted.install(identity, config.target.gatewayId, {
      ...request,
      requestId: randomUUID(),
    }),
    /pending or unconfirmed/,
  );
  installed = true;
  assert.equal(
    (await restarted.reconcile(identity, config.target.gatewayId))?.state,
    "installed",
  );
  assert.equal(posts, 1);
});
