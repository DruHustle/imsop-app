import { z } from "zod";
import { edgeIdentity } from "../config/edge";

// Deliberately excludes npm aliases, tags, ranges, URLs, archives and paths.
export const nodeRedPackageName = z
  .string()
  .max(214)
  .regex(
    /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/,
    "Enter an npm package name, such as node-red-contrib-example.",
  )
  .refine(
    (name) => !["node-red", "node_modules", "npm"].includes(name),
    "Core runtime packages are managed through the gateway release process.",
  );
export const exactPackageVersion = z
  .string()
  .max(96)
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
    "Enter one exact version, such as 1.2.3. Tags and version ranges are unavailable.",
  );
export const packageSelection = z
  .object({
    module: nodeRedPackageName,
    version: exactPackageVersion,
  })
  .strict();
export const installRequest = z
  .object({
    reviewToken: z.string().min(1).max(2048),
    requestId: z.string().uuid(),
    acknowledgeCodeExecution: z.literal(true),
  })
  .strict();
export const operationStates = [
  "installing",
  "installed",
  "failed",
  "unconfirmed",
] as const;
export type NodeRedTarget = {
  id: string;
  gatewayId: string;
  label: string;
  version: string;
  revision: string;
};
export type NodeRedPackage = {
  name: string;
  version: string;
  nodeSets: number;
  pluginSets: number;
  loadError: boolean;
  pendingVersion: string | null;
};
export const installOperation = z
  .object({
    id: z.string().uuid(),
    runtimeId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    gatewayId: edgeIdentity,
    targetRevision: z.string().regex(/^[a-f0-9]{64}$/),
    actorId: z.number().int().positive(),
    module: nodeRedPackageName,
    version: exactPackageVersion,
    state: z.enum(operationStates),
    message: z.string().max(400),
    startedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type InstallOperation = z.infer<typeof installOperation>;
export type NodeRedStatus = {
  state: "disabled" | "unavailable" | "ready";
  message: string;
  target: NodeRedTarget | null;
  packages: NodeRedPackage[];
  operation: InstallOperation | null;
};
export type PackageReview = {
  module: string;
  version: string;
  target: NodeRedTarget;
  description: string;
  nodeSets: string[];
  pluginSets: string[];
  reviewToken: string;
  expiresAt: string;
};
export const pendingInstall = (operation: InstallOperation | null) =>
  operation?.state === "installing" || operation?.state === "unconfirmed";

export type InstallActor = {
  id: number;
  sessionId: string;
  workspaceId: string;
};
export type NodeRedScope = Pick<
  InstallOperation,
  "runtimeId" | "workspaceId" | "gatewayId"
>;
export type NodeRedTargets = {
  state: "disabled" | "ready";
  message: string;
  targets: NodeRedTarget[];
};
