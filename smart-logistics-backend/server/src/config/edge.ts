import { z } from "zod";

export const edgeIdentity = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/);
const gatewayMap = z.record(
  edgeIdentity,
  z
    .object({
      workspaceId: z.string().uuid(),
      secret: z.string().min(32).max(256),
      sources: z.array(edgeIdentity).min(1).max(200),
    })
    .strict(),
);

// One authoritative gateway-to-workspace binding for intake and management.
export function smartLogisticsEdgeGateways() {
  const raw = process.env.IMSOP_EDGE_GATEWAYS;
  if (!raw) return {} as z.infer<typeof gatewayMap>;
  try {
    return gatewayMap.parse(JSON.parse(raw));
  } catch {
    throw new Error(
      "IMSOP_EDGE_GATEWAYS is invalid; each gateway requires a reviewed workspace/source allowlist",
    );
  }
}
