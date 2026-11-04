import { deliverFrozenMail, MailDeliveryError } from "./durableMail";
import { mailBinding } from "./mailEnvelope";
import nodemailer from "nodemailer";

type EmailProvider = "gmail" | "resend";
const provider = (): EmailProvider =>
  process.env.EMAIL_PROVIDER === "resend" ? "resend" : "gmail";
const resendSender = () =>
  process.env.EMAIL_FROM || "Smart Logistics <notifications-logistics@onesa.eu>";
const gmailSender = () =>
  process.env.GMAIL_FROM || "notifications.imsop@gmail.com";

function gmailTransport() {
  const user = gmailSender();
  const smtp = {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  } as const;
  if (
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  ) {
    return nodemailer.createTransport({
      ...smtp,
      auth: {
        type: "OAuth2",
        user,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      },
    });
  }
  if (process.env.GMAIL_APP_PASSWORD)
    return nodemailer.createTransport({
      ...smtp,
      auth: { user, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, "") },
    });
  throw new Error("Gmail credentials are not configured");
}

export function isEmailConfigured(): boolean {
  if (provider() === "resend")
    return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  return Boolean(
    (process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN) ||
    process.env.GMAIL_APP_PASSWORD,
  );
}

export async function sendPasswordResetEmail(
  recipient: string,
  resetUrl: string,
  deliveryId: string,
  expiresAt: Date,
): Promise<void> {
  const safeUrl = resetUrl
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const subject = "Reset your Smart Logistics password";
  const text = `A password reset was requested for your Smart Logistics account. This link expires in 15 minutes:\n\n${resetUrl}\n\nIf you did not request this, ignore this message.`;
  const html = `<p>A password reset was requested for your Smart Logistics account.</p><p><a href="${safeUrl}">Reset password</a></p><p>This link expires in 15 minutes. If you did not request this, ignore this message.</p>`;
  await deliverMail(recipient, subject, text, html, deliveryId, expiresAt);
}
export async function sendOperationalEmail(
  recipient: string,
  subject: string,
  text: string,
  deliveryId: string,
  expiresAt: Date,
) {
  await deliverMail(recipient, subject, text, undefined, deliveryId, expiresAt);
}
async function smtpSend(
  transport: ReturnType<typeof nodemailer.createTransport>,
  message: object,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      transport.sendMail(message),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          transport.close();
          reject(new Error("Mail transport timed out"));
        }, 20000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    transport.close();
  }
}
async function deliverMail(
  recipient: string,
  subject: string,
  text: string,
  html: string | undefined,
  deliveryId: string,
  expiresAt: Date,
) {
  const selected =
    process.env.EMAIL_PROVIDER === "smtp" &&
    process.env.NODE_ENV !== "production"
      ? "smtp"
      : provider();
  const from =
    selected === "resend"
      ? resendSender()
      : selected === "smtp"
        ? "Smart Logistics <recovery@imsop.test>"
        : `Smart Logistics Notifications <${gmailSender()}>`;
  const credential =
    selected === "resend"
      ? process.env.RESEND_API_KEY
      : selected === "gmail"
        ? [
            gmailSender(),
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            process.env.GMAIL_REFRESH_TOKEN,
            process.env.GMAIL_APP_PASSWORD,
          ]
        : [
            process.env.SMTP_HOST || "127.0.0.1",
            process.env.SMTP_PORT || "1025",
          ];
  if (selected !== "smtp" && !isEmailConfigured())
    throw new MailDeliveryError("pending");
  // Snapshot credentials and transport before awaiting anything: the stored
  // fingerprint must describe the credentials actually used for this attempt.
  const apiKey = process.env.RESEND_API_KEY;
  const smtp =
    selected === "resend"
      ? undefined
      : selected === "gmail"
        ? gmailTransport()
        : nodemailer.createTransport({
            host: process.env.SMTP_HOST || "127.0.0.1",
            port: Number(process.env.SMTP_PORT || 1025),
            secure: false,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
          });
  try {
    await deliverFrozenMail(deliveryId, recipient, expiresAt, {
      provider: selected,
      configurationHash: mailBinding(
        JSON.stringify([selected, from, credential]),
      ),
      async freeze() {
        const message = {
          from,
          to: recipient,
          subject,
          text,
          ...(html ? { html } : {}),
        };
        if (selected === "resend") return JSON.stringify(message);
        const compiled = await nodemailer
          .createTransport({
            streamTransport: true,
            buffer: true,
            newline: "windows",
          })
          .sendMail({
            ...message,
            messageId: `<${deliveryId}@imsop.test>`,
            date: new Date(),
          });
        if (!Buffer.isBuffer(compiled.message))
          throw new Error("Mail compiler did not return bytes");
        return JSON.stringify({
          raw: compiled.message.toString("base64"),
          envelope: compiled.envelope,
        });
      },
      async send(bytes, id) {
        if (selected !== "resend") {
          const frozen = JSON.parse(bytes);
          const info = await smtpSend(smtp!, {
            raw: Buffer.from(frozen.raw, "base64"),
            envelope: frozen.envelope,
          });
          if (
            !info ||
            !Array.isArray(info.accepted) ||
            info.accepted.length !== 1
          )
            throw new MailDeliveryError("unknown");
          return String(info.messageId || id);
        }
        // Send the persisted UTF-8 bytes verbatim, including the original From.
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": id,
          },
          body: bytes,
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
        if (!response.ok) {
          // Conflicts, rate limits and server failures may follow an accepted
          // request. Only identical bounded retries can reconcile that outcome.
          if (
            [408, 409, 425, 429].includes(response.status) ||
            response.status >= 500
          )
            throw new MailDeliveryError("pending");
          throw new MailDeliveryError("failed");
        }
        const result = (await response.json()) as { id?: string };
        if (typeof result.id !== "string" || !result.id)
          throw new MailDeliveryError("pending");
        return result.id;
      },
    });
  } finally {
    smtp?.close();
  }
}
