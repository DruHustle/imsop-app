import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  installRequest,
  packageSelection,
  pendingInstall,
  type InstallActor,
  type NodeRedTargets,
  type InstallOperation,
  type NodeRedStatus,
  type PackageReview,
} from "./contract";
import { NodeRedClient } from "./client";
import {
  INSTALL_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  REVIEW_LIFETIME_MS,
  NodeRedError,
  nodeRedConfigurations,
  runtimeScope,
  safeNodeRedError,
  type NodeRedConfiguration,
} from "./configuration";
import { postgresInstallStore, type InstallStore } from "./store";

const reviewPayload = packageSelection
  .extend({
    actorId: z.number().int().positive(),
    runtimeId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    sessionBinding: z.string().regex(/^[a-f0-9]{64}$/),
    gatewayId: z.string().min(1).max(80),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    expires: z.number().int(),
  })
  .strict();
type ReviewPayload = z.infer<typeof reviewPayload>;
const stamp = () => new Date().toISOString();
const sessionBinding = (actor: InstallActor) =>
  createHash("sha256").update(actor.sessionId).digest("hex");
const matches = (
  item: Awaited<ReturnType<NodeRedClient["installed"]>>,
  version: string,
) =>
  !!item && item.version === version && !item.pendingVersion && !item.loadError;
function sign(body: string, config: NodeRedConfiguration) {
  return createHmac("sha256", config.token)
    .update("smart-logistics:node-red-review:v1\0")
    .update(body)
    .digest("base64url");
}
function encodeReview(payload: ReviewPayload, config: NodeRedConfiguration) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return body + "." + sign(body, config);
}
function decodeReview(
  token: string,
  actor: InstallActor,
  config: NodeRedConfiguration,
) {
  const parts = token.split(".");
  const [body, signature] = parts;
  const expected = Buffer.from(sign(body ?? "", config));
  const received = Buffer.from(signature ?? "");
  if (
    parts.length !== 2 ||
    received.byteLength !== expected.byteLength ||
    !timingSafeEqual(received, expected)
  )
    throw new NodeRedError(
      "The package review is invalid or the runtime configuration changed. Review the package again.",
      true,
    );
  let parsed: ReturnType<typeof reviewPayload.safeParse>;
  try {
    parsed = reviewPayload.safeParse(
      JSON.parse(Buffer.from(body, "base64url").toString("utf8")),
    );
  } catch {
    throw new NodeRedError(
      "The package review is invalid. Review the package again.",
      true,
    );
  }
  if (
    !parsed.success ||
    parsed.data.actorId !== actor.id ||
    parsed.data.sessionBinding !== sessionBinding(actor) ||
    parsed.data.workspaceId !== actor.workspaceId ||
    parsed.data.gatewayId !== config.target.gatewayId ||
    parsed.data.runtimeId !== config.target.id ||
    parsed.data.revision !== config.target.revision ||
    parsed.data.expires <= Date.now() ||
    parsed.data.expires > Date.now() + REVIEW_LIFETIME_MS
  )
    throw new NodeRedError(
      "The package review expired or no longer matches this administrator and runtime. Review the package again.",
      true,
    );
  return parsed.data;
}

export class NodeRedPackageService {
  constructor(
    private readonly store: InstallStore = postgresInstallStore,
    private readonly configuration = nodeRedConfigurations,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  private config(actor: InstallActor, gatewayId: string) {
    const config = this.configuration()?.find(
      (item) =>
        item.workspaceId === actor.workspaceId &&
        item.target.gatewayId === gatewayId,
    );
    if (!config)
      throw new NodeRedError(
        "This workspace has no enrolled Node-RED management route for that gateway.",
        true,
        404,
      );
    return config;
  }
  async targets(actor: InstallActor): Promise<NodeRedTargets> {
    await this.store.authorize(actor);
    const configs = this.configuration();
    const targets =
      configs
        ?.filter((item) => item.workspaceId === actor.workspaceId)
        .map((item) => item.target) ?? [];
    return {
      state: targets.length ? "ready" : "disabled",
      targets,
      message: targets.length
        ? "Choose an enrolled gateway in this workspace."
        : "Package management is not configured for this workspace. An operator must enroll a commissioned private gateway.",
    };
  }
  private client(config: NodeRedConfiguration) {
    return new NodeRedClient(config, this.fetcher);
  }

  async status(actor: InstallActor, gatewayId: string): Promise<NodeRedStatus> {
    await this.store.authorize(actor);
    const config = this.config(actor, gatewayId);
    let target: NodeRedStatus["target"] = null;
    let operation: InstallOperation | null = null;
    try {
      target = config.target;
      operation = await this.store.current(runtimeScope(config));
      const client = this.client(config);
      await client.checkRuntime();
      return {
        state: "ready",
        message: "Connected to the enrolled Node-RED runtime.",
        target,
        packages: await client.packages(),
        operation,
      };
    } catch (error) {
      return {
        state: "unavailable",
        message: safeNodeRedError(error),
        target,
        packages: [],
        operation,
      };
    }
  }

  async review(
    actor: InstallActor,
    gatewayId: string,
    selection: z.infer<typeof packageSelection>,
  ): Promise<PackageReview> {
    const input = packageSelection.parse(selection);
    const config = this.config(actor, gatewayId);
    await this.store.authorize(actor);
    if (pendingInstall(await this.store.current(runtimeScope(config))))
      throw new NodeRedError(
        "Check the pending installation's outcome before reviewing another package.",
        true,
      );
    const client = this.client(config);
    await client.checkRuntime();
    if (await client.installed(input))
      throw new NodeRedError(
        "This package is already present. Updates and reinstalls require a separate gateway maintenance review.",
        true,
      );
    const metadata = await client.packageMetadata(input);
    const expires = Date.now() + REVIEW_LIFETIME_MS;
    return {
      ...input,
      ...metadata,
      target: config.target,
      expiresAt: new Date(expires).toISOString(),
      reviewToken: encodeReview(
        {
          ...input,
          actorId: actor.id,
          sessionBinding: sessionBinding(actor),
          workspaceId: actor.workspaceId,
          gatewayId,
          runtimeId: config.target.id,
          revision: config.target.revision,
          expires,
        },
        config,
      ),
    };
  }

  async install(
    actor: InstallActor,
    gatewayId: string,
    request: z.infer<typeof installRequest>,
  ) {
    const input = installRequest.parse(request);
    const config = this.config(actor, gatewayId);
    const reviewed = decodeReview(input.reviewToken, actor, config);
    const operation: InstallOperation = {
      id: input.requestId,
      runtimeId: config.target.id,
      targetRevision: config.target.revision,
      actorId: actor.id,
      workspaceId: actor.workspaceId,
      gatewayId,
      module: reviewed.module,
      version: reviewed.version,
      state: "installing",
      message:
        "Installation reserved. The gateway will verify the request before running the package installer.",
      startedAt: stamp(),
      updatedAt: stamp(),
    };
    const claimed = await this.store.claim(operation, actor);
    if (claimed.accepted) {
      // The durable reservation is committed before any mutating remote request.
      // A process restart never replays it. Status can be read by every replica.
      void this.run(operation, config, actor).catch(() => {
        // If persistence itself fails, leave the saved pending reservation in
        // place. It must be reconciled; never release or retry it optimistically.
      });
    }
    return claimed.operation;
  }

  private async run(
    operation: InstallOperation,
    config: NodeRedConfiguration,
    actor: InstallActor,
  ) {
    const client = this.client(config);
    const selection = { module: operation.module, version: operation.version };
    let transmitted = false;
    let postCompleted = false;
    let outcome: InstallOperation;
    try {
      await client.checkRuntime();
      const installed = await client.installed(selection);
      if (installed) {
        if (!matches(installed, operation.version))
          throw new NodeRedError(
            "The package is already present with another version or needs runtime attention. No update was requested.",
            true,
          );
        outcome = {
          ...operation,
          state: "installed",
          message:
            "The exact package version was already present with no reported load errors. No installation request was sent.",
          updatedAt: stamp(),
        };
      } else {
        if (
          this.config(actor, operation.gatewayId).target.revision !==
          operation.targetRevision
        )
          throw new NodeRedError(
            "Runtime configuration changed after approval. Review the package again.",
            true,
          );
        await this.store.authorize(actor);
        const current = await this.store.current(operation);
        if (
          !current ||
          current.id !== operation.id ||
          current.state !== "installing"
        )
          return;
        transmitted = true;
        await client.install(selection);
        postCompleted = true;
        await client.checkRuntime();
        const verified = await client.installed(selection);
        if (!matches(verified, operation.version))
          throw new NodeRedError(
            "Node-RED did not report the exact version without pending changes or load errors. Check the runtime before another installation.",
          );
        outcome = {
          ...operation,
          state: "installed",
          message:
            "The exact package version is present in the enrolled runtime with no reported load errors. Commission its nodes separately before OT use.",
          updatedAt: stamp(),
        };
      }
    } catch (error) {
      outcome = {
        ...operation,
        state:
          transmitted &&
          (postCompleted || !(error instanceof NodeRedError && error.rejected))
            ? "unconfirmed"
            : "failed",
        message: safeNodeRedError(error),
        updatedAt: stamp(),
      };
    }
    await this.store.finish(outcome);
  }

  async reconcile(actor: InstallActor, gatewayId: string) {
    const config = this.config(actor, gatewayId);
    await this.store.authorize(actor);
    const operation = await this.store.current(runtimeScope(config));
    if (!operation || !pendingInstall(operation)) return operation;
    if (operation.targetRevision !== config.target.revision)
      throw new NodeRedError(
        "The runtime configuration changed since this request. Restore or review the original enrollment before reconciling it.",
        true,
      );
    if (
      operation.state === "installing" &&
      Date.now() - Date.parse(operation.startedAt) <
        INSTALL_TIMEOUT_MS + 4 * REQUEST_TIMEOUT_MS
    )
      throw new NodeRedError(
        "The installation request is still within its response window. Wait for the saved result before checking for recovery.",
        true,
      );
    const client = this.client(config);
    await client.checkRuntime();
    const installed = await client.installed({
      module: operation.module,
      version: operation.version,
    });
    return this.store.finish({
      ...operation,
      state: matches(installed, operation.version)
        ? "installed"
        : "unconfirmed",
      message: matches(installed, operation.version)
        ? "Read-back confirmed the exact package version is currently present with no reported load errors. This verifies package inventory, not commissioning or active flow behavior."
        : "The exact version is not confirmed without pending changes or load errors. The installer may still be running or may have changed runtime files. New installations remain blocked until the gateway is reviewed.",
      updatedAt: stamp(),
    });
  }
}
export const nodeRedPackages = new NodeRedPackageService();
