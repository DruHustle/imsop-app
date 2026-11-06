import { z } from "zod";
const gatewayId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/);
export const nodeRedTarget = z.object({
  id: z.string().uuid(),
  gatewayId,
  label: z.string().max(80),
  version: z.string().max(96),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
});
export const nodeRedOperation = z.object({
  id: z.string().uuid(),
  runtimeId: z.string().uuid(),
  gatewayId,
  workspaceId: z.string().uuid(),
  actorId: z.number().int().positive(),
  targetRevision: z.string().regex(/^[a-f0-9]{64}$/),
  module: z.string().max(214),
  version: z.string().max(96),
  state: z.enum(["installing", "installed", "failed", "unconfirmed"]),
  message: z.string().max(400),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const nodeRedTargets = z.object({
  state: z.enum(["disabled", "ready"]),
  message: z.string().max(400),
  targets: z.array(nodeRedTarget).max(100),
});
export const nodeRedStatus = z.object({
  state: z.enum(["disabled", "unavailable", "ready"]),
  message: z.string().max(400),
  target: nodeRedTarget.nullable(),
  operation: nodeRedOperation.nullable(),
  packages: z
    .array(
      z.object({
        name: z.string().max(214),
        version: z.string().max(96),
        nodeSets: z.number().int().nonnegative(),
        pluginSets: z.number().int().nonnegative(),
        loadError: z.boolean(),
        pendingVersion: z.string().max(96).nullable(),
      })
    )
    .max(10_000),
});
export const nodeRedReview = z.object({
  module: z.string().max(214),
  version: z.string().max(96),
  target: nodeRedTarget,
  description: z.string().max(500),
  nodeSets: z.array(z.string().max(500)).max(256),
  pluginSets: z.array(z.string().max(500)).max(256),
  reviewToken: z.string().max(2048),
  expiresAt: z.string().datetime(),
});
export type NodeRedTarget = z.infer<typeof nodeRedTarget>;
export type NodeRedStatus = z.infer<typeof nodeRedStatus>;
export const pendingNodeRedInstall = (operation: NodeRedStatus["operation"]) =>
  operation?.state === "installing" || operation?.state === "unconfirmed";
export const nodeRedError = (error: unknown) =>
  error instanceof z.ZodError
    ? "The gateway returned an unsupported response. Refresh its saved status."
    : error instanceof Error
      ? error.message
      : "Package management is unavailable. Refresh when ready.";
