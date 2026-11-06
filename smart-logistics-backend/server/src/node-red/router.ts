import { Router, type Response } from "express";
import {
  authenticate,
  authorize,
  requireWorkspace,
  type AuthRequest,
} from "../middleware/auth";
import { edgeIdentity } from "../config/edge";
import {
  installRequest,
  packageSelection,
  type InstallActor,
} from "./contract";
import { NodeRedError, safeNodeRedError } from "./configuration";
import { NodeRedPackageService, nodeRedPackages } from "./service";

export function createNodeRedRouter(
  service: NodeRedPackageService = nodeRedPackages,
) {
  const router = Router();
  router.use(authenticate, requireWorkspace, authorize(["admin"]));
  const actor = (req: AuthRequest): InstallActor => ({
    id: req.user!.id,
    sessionId: req.user!.sessionId,
    workspaceId: req.user!.workspaceId!,
  });
  async function safe(
    res: Response,
    run: () => Promise<unknown>,
    status = 200,
  ) {
    try {
      res.status(status).json(await run());
    } catch (error) {
      res
        .status(error instanceof NodeRedError ? error.status : 503)
        .json({ error: safeNodeRedError(error) });
    }
  }
  router.get("/", (req: AuthRequest, res) =>
    safe(res, () => service.targets(actor(req))),
  );
  router.use("/:gatewayId", (req, res, next) => {
    if (!edgeIdentity.safeParse(req.params.gatewayId).success)
      return res.status(404).json({ error: "Gateway not found" });
    next();
  });
  router.get("/:gatewayId/status", (req: AuthRequest, res) =>
    safe(res, () => service.status(actor(req), String(req.params.gatewayId))),
  );
  router.post("/:gatewayId/review", (req: AuthRequest, res) => {
    const input = packageSelection.safeParse(req.body);
    if (!input.success)
      return res
        .status(400)
        .json({
          error: "Enter a Node-RED npm package name and one exact version.",
        });
    return safe(res, () =>
      service.review(actor(req), String(req.params.gatewayId), input.data),
    );
  });
  router.post("/:gatewayId/install", (req: AuthRequest, res) => {
    const input = installRequest.safeParse(req.body);
    if (!input.success)
      return res
        .status(400)
        .json({
          error:
            "A current package review, request identifier and explicit code-execution acknowledgement are required.",
        });
    return safe(
      res,
      () =>
        service.install(actor(req), String(req.params.gatewayId), input.data),
      202,
    );
  });
  router.post("/:gatewayId/reconcile", (req: AuthRequest, res) => {
    if (!req.body || Object.keys(req.body).length)
      return res
        .status(400)
        .json({
          error: "Reconciliation accepts no package or runtime overrides.",
        });
    return safe(res, () =>
      service.reconcile(actor(req), String(req.params.gatewayId)),
    );
  });
  return router;
}
export const nodeRedRouter = createNodeRedRouter();
