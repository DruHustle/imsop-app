import type { Pool, PoolClient } from "pg";
import { connection } from "../config/db";
import {
  installOperation,
  pendingInstall,
  type InstallActor,
  type InstallOperation,
  type NodeRedScope,
} from "./contract";
import { NodeRedError } from "./configuration";

export interface InstallStore {
  current(scope: NodeRedScope): Promise<InstallOperation | null>;
  claim(
    operation: InstallOperation,
    actor: InstallActor,
  ): Promise<{ operation: InstallOperation; accepted: boolean }>;
  finish(operation: InstallOperation): Promise<InstallOperation>;
  authorize(actor: InstallActor): Promise<void>;
}
type Queryable = Pick<PoolClient, "query">;
const immutable = [
  "id",
  "runtimeId",
  "workspaceId",
  "gatewayId",
  "targetRevision",
  "actorId",
  "module",
  "version",
  "startedAt",
] as const;
const sameRequest = (a: InstallOperation, b: InstallOperation, retry = false) =>
  immutable
    .filter((key) => !retry || key !== "startedAt")
    .every((key) => a[key] === b[key]);

async function authorize(db: Queryable, actor: InstallActor) {
  const result = await db.query(
    `SELECT u.id FROM auth_sessions s JOIN users u ON u.id=s.user_id
     WHERE s.id=$1 AND u.id=$2 AND s.workspace_id=$3 AND u.role='admin'
       AND s.revoked_at IS NULL AND s.expires_at>now() AND NOT u.disabled
       AND s.version=u.session_version AND s.role=u.role AND s.workspace_id=u.active_workspace_id
       AND EXISTS(SELECT 1 FROM workspace_memberships m WHERE m.user_id=u.id AND m.workspace_id=s.workspace_id)`,
    [actor.sessionId, actor.id, actor.workspaceId],
  );
  if (!result.rowCount)
    throw new NodeRedError(
      "An active administrator session in this workspace is required to manage Node-RED packages.",
      true,
      403,
    );
}
function parse(row: Record<string, any>): InstallOperation {
  const parsed = installOperation.safeParse({
    id: row.id,
    runtimeId: row.runtime_id,
    workspaceId: row.workspace_id,
    gatewayId: row.gateway_id,
    targetRevision: row.target_revision,
    actorId: row.actor_id,
    module: row.module,
    version: row.version,
    state: row.state,
    message: row.message,
    startedAt:
      row.started_at instanceof Date
        ? row.started_at.toISOString()
        : row.started_at,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at,
  });
  if (!parsed.success)
    throw new NodeRedError(
      "The saved Node-RED operation needs an administrator's review before further installs.",
    );
  return parsed.data;
}
async function current(
  db: Queryable,
  scope: NodeRedScope,
): Promise<InstallOperation | null> {
  const pointer = (
    await db.query(
      "SELECT workspace_id,gateway_id,current_request_id FROM node_red_runtime_installs WHERE runtime_id=$1",
      [scope.runtimeId],
    )
  ).rows[0];
  if (!pointer) return null;
  if (
    pointer.workspace_id !== scope.workspaceId ||
    pointer.gateway_id !== scope.gatewayId
  )
    throw new NodeRedError(
      "This runtime has a saved enrollment that must be reviewed before management can continue.",
    );
  const result = await db.query(
    "SELECT * FROM node_red_install_requests WHERE id=$1 AND runtime_id=$2 AND workspace_id=$3 AND gateway_id=$4",
    [
      pointer.current_request_id,
      scope.runtimeId,
      scope.workspaceId,
      scope.gatewayId,
    ],
  );
  if (!result.rows[0])
    throw new NodeRedError(
      "The saved Node-RED operation is unavailable. Further installations are blocked.",
    );
  return parse(result.rows[0]);
}
async function locked<T>(
  pool: Pool,
  runtimeId: string,
  run: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SET LOCAL statement_timeout='3000ms'");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "logistics_node_red:" + runtimeId,
    ]);
    const result = await run(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    db.release();
  }
}

export function createPostgresInstallStore(
  pool: Pool = connection,
): InstallStore {
  return {
    current: (scope) => current(pool, scope),
    authorize: (actor) => authorize(pool, actor),
    claim: (operation, actor) =>
      locked(pool, operation.runtimeId, async (db) => {
        if (
          operation.actorId !== actor.id ||
          operation.workspaceId !== actor.workspaceId
        )
          throw new NodeRedError(
            "The installation request does not match this workspace administrator.",
            true,
            403,
          );
        await authorize(db, actor);
        const previous = (
          await db.query(
            "SELECT * FROM node_red_install_requests WHERE id=$1",
            [operation.id],
          )
        ).rows[0];
        if (previous) {
          const saved = parse(previous);
          if (!sameRequest(saved, operation, true))
            throw new NodeRedError(
              "This request identifier belongs to a different installation request.",
              true,
            );
          return { operation: saved, accepted: false };
        }
        if (pendingInstall(await current(db, operation)))
          throw new NodeRedError(
            "An installation for this runtime is pending or unconfirmed. Check its outcome before requesting another package.",
            true,
          );
        await db.query(
          `INSERT INTO node_red_install_requests
         (id,runtime_id,workspace_id,gateway_id,target_revision,actor_id,module,version,state,message,started_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            operation.id,
            operation.runtimeId,
            operation.workspaceId,
            operation.gatewayId,
            operation.targetRevision,
            operation.actorId,
            operation.module,
            operation.version,
            operation.state,
            operation.message,
            operation.startedAt,
            operation.updatedAt,
          ],
        );
        await db.query(
          `INSERT INTO node_red_runtime_installs(runtime_id,workspace_id,gateway_id,current_request_id)
         VALUES($1,$2,$3,$4) ON CONFLICT(runtime_id) DO UPDATE SET current_request_id=excluded.current_request_id`,
          [
            operation.runtimeId,
            operation.workspaceId,
            operation.gatewayId,
            operation.id,
          ],
        );
        return { operation, accepted: true };
      }),
    finish: (operation) =>
      locked(pool, operation.runtimeId, async (db) => {
        const saved = await current(db, operation);
        if (!saved || !sameRequest(saved, operation))
          throw new NodeRedError(
            "The active installation changed. Refresh its saved status.",
          );
        // A late network failure cannot undo an independently verified read-back.
        if (!pendingInstall(saved)) return saved;
        await db.query(
          "UPDATE node_red_install_requests SET state=$1,message=$2,updated_at=$3 WHERE id=$4 AND workspace_id=$5 AND runtime_id=$6",
          [
            operation.state,
            operation.message,
            operation.updatedAt,
            operation.id,
            operation.workspaceId,
            operation.runtimeId,
          ],
        );
        return operation;
      }),
  };
}
export const postgresInstallStore = createPostgresInstallStore();
