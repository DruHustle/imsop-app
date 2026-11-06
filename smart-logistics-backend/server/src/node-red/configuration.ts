import { createHash } from "node:crypto";
import { z } from "zod";
import { edgeIdentity, smartLogisticsEdgeGateways } from "../config/edge";
import { integrationEnabled, serverSecret } from "../config/integrations";
import type { NodeRedTarget, NodeRedScope } from "./contract";

export class NodeRedError extends Error {
  constructor(
    message: string,
    readonly rejected = false,
    readonly status = rejected ? 409 : 503,
  ) {
    super(message);
  }
}
export type NodeRedConfiguration = {
  target: NodeRedTarget;
  workspaceId: string;
  adminUrl: string;
  token: string;
};
export const MANAGEMENT_PERMISSIONS = [
  "nodes.read",
  "nodes.write",
  "plugins.read",
  "settings.read",
];
export const REQUEST_TIMEOUT_MS = 8_000;
export const INSTALL_TIMEOUT_MS = 120_000;
export const REVIEW_LIFETIME_MS = 10 * 60_000;
const enrollment = z.record(
  edgeIdentity,
  z
    .object({
      commissioned: z.literal(true),
      adminUrl: z.string(),
      runtimeId: z
        .string()
        .uuid()
        .regex(
          /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,
        ),
      runtimeVersion: z.literal("4.1.4"),
      label: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/),
      tokenEnv: z.string().regex(/^IMSOP_NODE_RED_TOKEN_[A-Z0-9_]{1,64}$/),
    })
    .strict(),
);

export function nodeRedConfigurations(): NodeRedConfiguration[] | null {
  try {
    if (!integrationEnabled("IMSOP_NODE_RED_MANAGEMENT_ENABLED")) return null;
    const targets = enrollment.parse(
      JSON.parse(process.env.IMSOP_NODE_RED_TARGETS || "null"),
    );
    if (!Object.keys(targets).length || Object.keys(targets).length > 100)
      throw new Error();
    const gateways = smartLogisticsEdgeGateways();
    const ids = new Set<string>(),
      routes = new Set<string>(),
      tokens = new Set<string>();
    return Object.entries(targets).map(([gatewayId, item]) => {
      const gateway = gateways[gatewayId];
      if (!gateway) throw new Error();
      const url = new URL(item.adminUrl);
      // No DNS resolution, browser-supplied URLs, public editors or route creation.
      // An operator's supervised SSH forward must share the API network namespace.
      if (
        url.protocol !== "http:" ||
        !["127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.port ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !["/admin", "/admin/"].includes(url.pathname)
      )
        throw new Error();
      const token = serverSecret(item.tokenEnv) || "";
      if (!/^[a-f0-9]{64}$/i.test(token) || token === gateway.secret)
        throw new Error();
      const id = item.runtimeId.toLowerCase(),
        workspaceId = gateway.workspaceId.toLowerCase();
      const adminUrl = url.origin + "/admin";
      if (ids.has(id) || routes.has(adminUrl) || tokens.has(token))
        throw new Error();
      ids.add(id);
      routes.add(adminUrl);
      tokens.add(token);
      const revision = createHash("sha256")
        .update(
          JSON.stringify([
            workspaceId,
            gatewayId,
            adminUrl,
            id,
            item.runtimeVersion,
            item.label,
            token,
          ]),
        )
        .digest("hex");
      return {
        adminUrl,
        token,
        workspaceId,
        target: {
          id,
          gatewayId,
          label: item.label,
          version: item.runtimeVersion,
          revision,
        },
      };
    });
  } catch {
    // Never disclose another workspace, private host, secret reference or parser input.
    throw new NodeRedError(
      "Node-RED management enrollment is invalid. Review the commissioned gateway mapping, loopback route, dedicated credential and exact runtime version.",
    );
  }
}
export function runtimeScope(config: NodeRedConfiguration): NodeRedScope {
  return {
    runtimeId: config.target.id,
    gatewayId: config.target.gatewayId,
    workspaceId: config.workspaceId,
  };
}
export function safeNodeRedError(error: unknown): string {
  return error instanceof NodeRedError
    ? error.message
    : "Node-RED management is unavailable. Check the private route and service logs.";
}
