import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import jwt from "jsonwebtoken";
import { connection } from "../config/db";
import { getJwtSecret } from "../config/security";
import { isEmailConfigured, sendPasswordResetEmail } from "./emailService";
import { buildResetLink } from "./resetLink";
import { queueFailureState } from "./durableMail";
const key = () =>
  process.env.RESET_DELIVERY_KEY
    ? Buffer.from(process.env.RESET_DELIVERY_KEY, "hex")
    : createHash("sha256").update(getJwtSecret()).digest();
function encrypt(value: string) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(), iv);
  return Buffer.concat([
    iv,
    c.update(value),
    c.final(),
    c.getAuthTag(),
  ]).toString("base64");
}
function decrypt(value: string) {
  const data = Buffer.from(value, "base64"),
    c = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  c.setAuthTag(data.subarray(-16));
  return Buffer.concat([
    c.update(data.subarray(12, -16)),
    c.final(),
  ]).toString();
}
export async function queuePasswordReset(email: string) {
  const user = (
    await connection.query(
      "SELECT id,email,password_reset_version FROM users WHERE email=$1 AND NOT disabled",
      [email],
    )
  ).rows[0];
  // Same database round trip class for unknown accounts; no provider latency or credentials in response.
  if (!user) return;
  const token = jwt.sign(
    {
      id: user.id,
      purpose: "password-reset",
      resetVersion: user.password_reset_version,
    },
    getJwtSecret(),
    { expiresIn: "15m", issuer: "imsop-api", audience: "imsop-password-reset" },
  );
  const url = buildResetLink(
    process.env.PASSWORD_RESET_BASE_URL ||
      "http://localhost:5173/#/reset-password",
    token,
  );
  await connection.query(
    `INSERT INTO reset_deliveries(id,user_id,reset_version,encrypted_payload,expires_at) VALUES($1,$2,$3,$4,now()+interval '15 minutes')
 ON CONFLICT(user_id,reset_version) DO UPDATE SET id=EXCLUDED.id,encrypted_payload=EXCLUDED.encrypted_payload,expires_at=EXCLUDED.expires_at,state='pending',attempts=0,next_attempt_at=now(),lease_until=NULL,delivered_at=NULL,created_at=now()
 WHERE reset_deliveries.expires_at<now()`,
    [
      randomUUID(),
      user.id,
      user.password_reset_version,
      encrypt(JSON.stringify({ email: user.email, url })),
    ],
  );
}
export async function dispatchResetDeliveries() {
  if (
    !isEmailConfigured() &&
    !(
      process.env.NODE_ENV !== "production" &&
      process.env.EMAIL_PROVIDER === "smtp"
    )
  )
    return;
  await connection.query(`UPDATE reset_deliveries d SET state='unknown',encrypted_payload=NULL,lease_until=NULL WHERE state IN ('pending','sending') AND attempts>0
    AND (lease_until IS NULL OR lease_until<now()) AND NOT EXISTS(SELECT 1 FROM mail_requests r WHERE r.id=d.id)`);
  await connection.query(
    `UPDATE reset_deliveries SET state=CASE WHEN state IN ('pending','pending_v2','sending_v2') THEN CASE WHEN attempts>0 THEN 'unknown' ELSE 'expired' END ELSE state END,encrypted_payload=NULL,lease_until=NULL WHERE expires_at<=now() AND encrypted_payload IS NOT NULL`,
  );
  // Recover a crash on the final attempt instead of leaving a sending row stuck.
  await connection.query(`UPDATE reset_deliveries SET state='unknown',encrypted_payload=NULL,lease_until=NULL
    WHERE state='sending_v2' AND attempts>=5 AND lease_until<now()`);
  // Claim immediately before sending. A slow earlier mail must not consume the
  // lease of another row sitting in a claimed batch.
  for (let slot = 0; slot < 5; slot++) {
    const claimed =
      await connection.query(`WITH due AS (SELECT id FROM reset_deliveries WHERE state IN ('pending','pending_v2','sending_v2') AND expires_at>now() AND next_attempt_at<=now()
 AND (lease_until IS NULL OR lease_until<now()) AND attempts<5 ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
 UPDATE reset_deliveries d SET state='sending_v2',attempts=attempts+1,lease_until=now()+interval '60 seconds' FROM due WHERE d.id=due.id RETURNING d.*`);
    const row = claimed.rows[0];
    if (!row) break;
    try {
      const { email, url } = JSON.parse(decrypt(row.encrypted_payload));
      const valid = await connection.query(
        "SELECT 1 FROM users WHERE id=$1 AND email=$2 AND password_reset_version=$3 AND NOT disabled",
        [row.user_id, email, row.reset_version],
      );
      if (!valid.rowCount) {
        await connection.query(
          "UPDATE reset_deliveries SET state='cancelled',encrypted_payload=NULL,lease_until=NULL WHERE id=$1",
          [row.id],
        );
        continue;
      }
      await sendPasswordResetEmail(
        email,
        url,
        row.id,
        new Date(row.expires_at),
      );
      await connection.query(
        "UPDATE reset_deliveries SET state='sent',delivered_at=now(),encrypted_payload=NULL,lease_until=NULL WHERE id=$1",
        [row.id],
      );
    } catch (error) {
      await connection.query(
        `UPDATE reset_deliveries SET state=$2,encrypted_payload=CASE WHEN $2='pending_v2' THEN encrypted_payload ELSE NULL END,lease_until=NULL,next_attempt_at=now()+interval '30 seconds'*power(2,attempts) WHERE id=$1`,
        [row.id, queueFailureState(error, row.attempts)],
      );
      console.warn(
        JSON.stringify({
          event: "reset_delivery_failed",
          deliveryId: row.id,
          attempt: row.attempts,
        }),
      );
    }
  }
}
