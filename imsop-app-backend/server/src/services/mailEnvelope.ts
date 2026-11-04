import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { getJwtSecret } from "../config/security";

const key = () =>
  process.env.RESET_DELIVERY_KEY
    ? Buffer.from(process.env.RESET_DELIVERY_KEY, "hex")
    : createHash("sha256").update(getJwtSecret()).digest();

export function encryptMail(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  return Buffer.concat([
    iv,
    cipher.update(value),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
export function decryptMail(value: string) {
  const data = Buffer.from(value, "base64"),
    cipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([
    cipher.update(data.subarray(12, -16)),
    cipher.final(),
  ]).toString();
}
export const mailBinding = (value: string) =>
  createHmac("sha256", key()).update(value).digest("hex");
export const mailDigest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
