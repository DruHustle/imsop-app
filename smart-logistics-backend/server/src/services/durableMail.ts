import { connection } from "../config/db";
import {
  decryptMail,
  encryptMail,
  mailBinding,
  mailDigest,
} from "./mailEnvelope";

export class MailDeliveryError extends Error {
  constructor(readonly state: "pending" | "unknown" | "failed" | "expired") {
    super(`Mail delivery ${state}`);
  }
}
export const deliveryFailureState = (error: unknown, attempts: number) =>
  error instanceof MailDeliveryError &&
  (error.state !== "pending" || attempts < 5)
    ? error.state
    : "unknown";

// Legacy dispatchers ignore these states during a binary rollback, so they
// cannot re-render requests already attempted by this version.
export const queueFailureState = (error: unknown, attempts: number) => {
  const state = deliveryFailureState(error, attempts);
  return state === "pending" ? "pending_v2" : state;
};

export interface FrozenTransport {
  provider: "resend" | "gmail" | "smtp";
  configurationHash: string;
  freeze(): Promise<string>;
  send(bytes: string, id: string): Promise<string>;
}

// A session advisory lock serializes senders across processes, including a
// lease-expired worker. The durable sending marker precedes external I/O.
export async function deliverFrozenMail(
  id: string,
  recipient: string,
  expiresAt: Date,
  transport: FrozenTransport,
) {
  const db = await connection.connect();
  let locked = false;
  try {
    locked = (
      await db.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1, 491698)) AS locked",
        [id],
      )
    ).rows[0].locked;
    if (!locked) throw new MailDeliveryError("pending");
    let row = (await db.query("SELECT * FROM mail_requests WHERE id=$1", [id]))
      .rows[0];
    if (!row) {
      if (expiresAt.getTime() <= Date.now())
        throw new MailDeliveryError("expired");
      const bytes = await transport.freeze();
      row = (
        await db.query(
          `INSERT INTO mail_requests(id,provider,encrypted_request,request_sha256,configuration_hash,recipient_hash,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [
            id,
            transport.provider,
            encryptMail(bytes),
            mailDigest(bytes),
            transport.configurationHash,
            mailBinding(recipient),
            expiresAt,
          ],
        )
      ).rows[0];
    }
    if (row.state === "sent") return;
    const first = row.first_attempt_at
      ? new Date(row.first_attempt_at).getTime()
      : null;
    const stop = async (
      state: "unknown" | "blocked" | "expired" | "failed",
    ): Promise<never> => {
      await db.query(
        "UPDATE mail_requests SET state=$2,updated_at=now() WHERE id=$1",
        [id, state],
      );
      throw new MailDeliveryError(state === "blocked" ? "unknown" : state);
    };
    if (["unknown", "blocked", "expired", "failed"].includes(row.state))
      throw new MailDeliveryError(
        row.state === "blocked" ? "unknown" : row.state,
      );
    if (
      row.provider !== transport.provider ||
      row.configuration_hash !== transport.configurationHash ||
      row.recipient_hash !== mailBinding(recipient)
    )
      await stop("blocked");
    // Resend retains idempotency keys for 24h. Stop an hour early, never
    // replay past that horizon. SMTP has no equivalent delivery guarantee.
    if (
      Date.now() >= new Date(row.expires_at).getTime() ||
      (first !== null && Date.now() - first >= 23 * 3600000)
    )
      await stop(first === null ? "expired" : "unknown");
    if (row.attempts >= 5 || (first !== null && row.provider !== "resend"))
      await stop("unknown");
    let bytes: string;
    try {
      bytes = decryptMail(row.encrypted_request);
    } catch {
      return await stop("blocked");
    }
    if (mailDigest(bytes) !== row.request_sha256) await stop("blocked");
    await db.query(
      "UPDATE mail_requests SET state='sending',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,now()),updated_at=now() WHERE id=$1",
      [id],
    );
    try {
      const receipt = await transport.send(bytes, id);
      await db.query(
        "UPDATE mail_requests SET state='sent',provider_id=$2,updated_at=now() WHERE id=$1",
        [id, receipt],
      );
    } catch (error) {
      let state =
        error instanceof MailDeliveryError
          ? error.state
          : row.provider === "resend" && row.attempts < 4
            ? "pending"
            : "unknown";
      if (
        (state === "failed" && first !== null) ||
        (state === "pending" && row.attempts >= 4)
      )
        state = "unknown";
      await db.query(
        "UPDATE mail_requests SET state=$2,updated_at=now() WHERE id=$1",
        [id, state],
      );
      throw new MailDeliveryError(state);
    }
  } finally {
    let broken = false;
    if (locked)
      try {
        await db.query(
          "SELECT pg_advisory_unlock(hashtextextended($1, 491698))",
          [id],
        );
      } catch {
        broken = true;
      }
    db.release(broken);
  }
}
