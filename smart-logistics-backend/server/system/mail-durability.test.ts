import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { connection } from "../src/config/db";
import { migrate } from "../src/migrate";
import app from "../src/app";
import { sendOperationalEmail } from "../src/services/emailService";
import { MailDeliveryError } from "../src/services/durableMail";
import { decryptMail, mailDigest } from "../src/services/mailEnvelope";
import {
  queuePasswordReset,
  dispatchResetDeliveries,
} from "../src/services/resetDelivery";

assert.match(
  process.env.DATABASE_URL || "",
  /@127\.0\.0\.1:55467\/imsop_mail_test$/,
);
assert.equal(process.env.NODE_ENV, "test");
const originalEnvironment = { ...process.env };
const originalFetch = globalThis.fetch;
let mode: "accept" | "lose-ack" | "reject" = "accept";
const requests: { id: string; bytes: string }[] = [];
const accepted = new Map<string, string>();
// Real HTTP fault endpoint. This exercises durable I/O, not live-provider
// acceptance: genuine Resend sender/delivery qualification remains separate.
const api = http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks).toString(),
    id = String(req.headers["idempotency-key"]);
  requests.push({ id, bytes });
  if (accepted.has(id)) assert.equal(bytes, accepted.get(id));
  if (mode === "reject") {
    res.writeHead(422).end("{}");
    return;
  }
  accepted.set(id, bytes);
  if (mode === "lose-ack") {
    req.socket.destroy();
    return;
  }
  res
    .writeHead(200, { "Content-Type": "application/json" })
    .end(JSON.stringify({ id: `receipt-${id}` }));
});
let smtpMode: "accept" | "lose-ack" = "accept";
const smtpMessages: string[] = [];
const smtp = net.createServer((socket) => {
  socket.write("220 isolated mail durability\r\n");
  let buffer = "",
    data = false,
    body = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    while (buffer.includes("\r\n")) {
      const split = buffer.indexOf("\r\n"),
        line = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      if (data) {
        if (line !== ".") {
          body += line + "\r\n";
          continue;
        }
        smtpMessages.push(body);
        body = "";
        data = false;
        if (smtpMode === "lose-ack") {
          socket.destroy();
          return;
        }
        socket.write("250 accepted\r\n");
        continue;
      }
      if (/^EHLO|^HELO/.test(line)) socket.write("250 isolated\r\n");
      else if (/^MAIL|^RCPT|^RSET/.test(line)) socket.write("250 ok\r\n");
      else if (line === "DATA") {
        data = true;
        socket.write("354 send data\r\n");
      } else if (line === "QUIT") socket.end("221 bye\r\n");
      else socket.write("500 unsupported\r\n");
    }
  });
});
function settings() {
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "isolated-key-never-a-provider-credential";
  process.env.EMAIL_FROM = "Smart Logistics <notifications-logistics@onesa.eu>";
  mode = "accept";
}
before(async () => {
  await migrate(process.env.DATABASE_URL);
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  await new Promise<void>((resolve) => smtp.listen(0, "127.0.0.1", resolve));
  const address = api.address();
  assert(address && typeof address === "object");
  mock.method(
    globalThis,
    "fetch",
    (
      url: Parameters<typeof fetch>[0],
      options: Parameters<typeof fetch>[1],
    ) => {
      assert.equal(url, "https://api.resend.com/emails");
      return originalFetch(`http://127.0.0.1:${address.port}/emails`, options);
    },
  );
});
after(async () => {
  mock.restoreAll();
  api.closeAllConnections();
  await new Promise<void>((resolve) => api.close(() => resolve()));
  await new Promise<void>((resolve) => smtp.close(() => resolve()));
  await connection.end();
  for (const key of Object.keys(process.env))
    if (!(key in originalEnvironment)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
});
const expiry = () => new Date(Date.now() + 3600000);
const send = (
  id: string,
  body = "Original body",
  recipient = "fixture@imsop.test",
) => sendOperationalEmail(recipient, "Fixture subject", body, id, expiry());
const row = async (id: string) =>
  (await connection.query("SELECT * FROM mail_requests WHERE id=$1", [id]))
    .rows[0];
const outcome = (state: string) => (error: unknown) =>
  error instanceof MailDeliveryError && error.state === state;

test("readiness refuses an unapplied mail migration and recovers after the exact ledger is restored", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/ready`;
  const checksum = (
    await connection.query(
      "SELECT checksum FROM schema_migrations WHERE name='007_immutable_mail.sql'",
    )
  ).rows[0].checksum;
  try {
    assert.equal((await originalFetch(url)).status, 200);
    await connection.query(
      "UPDATE schema_migrations SET checksum=NULL WHERE name='007_immutable_mail.sql'",
    );
    assert.equal((await originalFetch(url)).status, 503);
  } finally {
    await connection.query(
      "UPDATE schema_migrations SET checksum=$1 WHERE name='007_immutable_mail.sql'",
      [checksum],
    );
    assert.equal((await originalFetch(url)).status, 200);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("lost HTTP acknowledgement replays exact persisted bytes and returns one provider receipt", async () => {
  settings();
  mode = "lose-ack";
  const id = randomUUID();
  await assert.rejects(send(id), outcome("pending"));
  const frozen = await row(id);
  assert.equal(frozen.state, "pending");
  const message = JSON.parse(decryptMail(frozen.encrypted_request));
  assert.equal(typeof message.html, "string");
  assert.ok(message.html.includes("Smart Logistics"));
  assert.equal(message.text, "Original body");
  assert.equal(
    mailDigest(decryptMail(frozen.encrypted_request)),
    frozen.request_sha256,
  );
  mode = "accept";
  await send(id, "Changed business text must not replace attempted bytes");
  await send(id);
  const sent = requests.filter((x) => x.id === id);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].bytes, sent[1].bytes);
  assert.equal(accepted.has(id), true);
  assert.equal((await row(id)).state, "sent");
  assert.equal((await row(id)).provider_id, `receipt-${id}`);
  await assert.rejects(
    connection.query(
      "UPDATE mail_requests SET encrypted_request='replacement' WHERE id=$1",
      [id],
    ),
    /Frozen mail request/,
  );
});

test("sender, recipient, credential and provider changes stop uncertain attempts without network I/O", async () => {
  for (const change of ["sender", "recipient", "credential", "provider"]) {
    settings();
    mode = "lose-ack";
    const id = randomUUID();
    await assert.rejects(send(id), outcome("pending"));
    if (change === "sender") process.env.EMAIL_FROM = "Other <other@onesa.eu>";
    if (change === "credential")
      process.env.RESEND_API_KEY = "different-synthetic-key";
    if (change === "provider") {
      process.env.EMAIL_PROVIDER = "smtp";
      process.env.SMTP_PORT = String((smtp.address() as net.AddressInfo).port);
    }
    const count = requests.length,
      smtpCount = smtpMessages.length;
    await assert.rejects(
      send(
        id,
        "Updated",
        change === "recipient" ? "other@imsop.test" : "fixture@imsop.test",
      ),
      outcome("unknown"),
    );
    assert.equal(requests.length, count);
    assert.equal(smtpMessages.length, smtpCount);
    assert.equal((await row(id)).state, "blocked");
  }
});

test("concurrent workers cannot send the same delivery concurrently", async () => {
  settings();
  const id = randomUUID();
  const results = await Promise.allSettled([send(id), send(id)]);
  assert(results.some((x) => x.status === "fulfilled"));
  assert.equal(requests.filter((x) => x.id === id).length, 1);
  assert.equal((await row(id)).state, "sent");
});

test("Resend replay stops before provider retention expires and keeps unknown outcome", async () => {
  settings();
  mode = "lose-ack";
  const previous = randomUUID();
  await assert.rejects(send(previous), outcome("pending"));
  const id = randomUUID();
  await connection.query(
    `INSERT INTO mail_requests(id,provider,encrypted_request,request_sha256,configuration_hash,recipient_hash,state,attempts,first_attempt_at,expires_at)
    SELECT $1,provider,encrypted_request,request_sha256,configuration_hash,recipient_hash,'sending',1,now()-interval '24 hours',now()+interval '1 hour' FROM mail_requests WHERE id=$2`,
    [id, previous],
  );
  const count = requests.length;
  await assert.rejects(send(id), outcome("unknown"));
  assert.equal(requests.length, count);
  assert.equal((await row(id)).state, "unknown");
});

test("SMTP acceptance is recorded once; lost DATA acknowledgement never resends", async () => {
  settings();
  process.env.EMAIL_PROVIDER = "smtp";
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String((smtp.address() as net.AddressInfo).port);
  smtpMode = "accept";
  const ok = randomUUID();
  await send(ok);
  await send(ok);
  assert.equal((await row(ok)).state, "sent");
  smtpMode = "lose-ack";
  const id = randomUUID(),
    count = smtpMessages.length;
  await assert.rejects(send(id), outcome("unknown"));
  smtpMode = "accept";
  await assert.rejects(send(id), outcome("unknown"));
  assert.equal(smtpMessages.length, count + 1);
  assert.match(smtpMessages.at(-1)!, new RegExp(id));
  assert.equal((await row(id)).state, "unknown");
});

test("a crash after the last claimed provider attempt remains unknown and cannot resend", async () => {
  settings();
  mode = "lose-ack";
  const id = randomUUID();
  await assert.rejects(send(id), outcome("pending"));
  await connection.query(
    "UPDATE mail_requests SET attempts=5,state='sending' WHERE id=$1",
    [id],
  );
  const count = requests.length;
  await assert.rejects(send(id), outcome("unknown"));
  assert.equal(requests.length, count);
  await assert.rejects(send(id), outcome("unknown"));
  assert.equal(requests.length, count);
});

test("a failed reset cannot bypass its cooldown; legacy attempts and changed accounts do not send", async () => {
  settings();
  const email = randomUUID() + "@imsop.test";
  const user = (
    await connection.query(
      "INSERT INTO users(email,password,name,role) VALUES($1,'unused','Mail fixture','user') RETURNING id",
      [email],
    )
  ).rows[0];
  await queuePasswordReset(email);
  let reset = (
    await connection.query("SELECT * FROM reset_deliveries WHERE user_id=$1", [
      user.id,
    ])
  ).rows[0];
  await connection.query(
    "UPDATE reset_deliveries SET state='failed' WHERE id=$1",
    [reset.id],
  );
  await queuePasswordReset(email);
  assert.equal(
    (
      await connection.query(
        "SELECT id FROM reset_deliveries WHERE user_id=$1",
        [user.id],
      )
    ).rows[0].id,
    reset.id,
  );
  await connection.query(
    "UPDATE reset_deliveries SET state='pending',attempts=1 WHERE id=$1",
    [reset.id],
  );
  const count = requests.length;
  await dispatchResetDeliveries();
  assert.equal(
    (
      await connection.query("SELECT state FROM reset_deliveries WHERE id=$1", [
        reset.id,
      ])
    ).rows[0].state,
    "unknown",
  );
  assert.equal(requests.length, count);
  await connection.query(
    "UPDATE reset_deliveries SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [reset.id],
  );
  await queuePasswordReset(email);
  reset = (
    await connection.query("SELECT * FROM reset_deliveries WHERE user_id=$1", [
      user.id,
    ])
  ).rows[0];
  await connection.query("UPDATE users SET disabled=true WHERE id=$1", [
    user.id,
  ]);
  await dispatchResetDeliveries();
  assert.equal(
    (
      await connection.query("SELECT state FROM reset_deliveries WHERE id=$1", [
        reset.id,
      ])
    ).rows[0].state,
    "cancelled",
  );
  assert.equal(requests.length, count);
});

test("enabled password reset freezes a real rendered request and records acceptance once", async () => {
  settings();
  const email = randomUUID() + "@imsop.test";
  const user = (
    await connection.query(
      "INSERT INTO users(email,password,name,role) VALUES($1,'unused','Mail fixture','user') RETURNING id",
      [email],
    )
  ).rows[0];
  await queuePasswordReset(email);
  await dispatchResetDeliveries();
  await dispatchResetDeliveries();
  const reset = (
    await connection.query("SELECT * FROM reset_deliveries WHERE user_id=$1", [
      user.id,
    ])
  ).rows[0];
  assert.equal(reset.state, "sent");
  assert.equal(reset.encrypted_payload, null);
  const messages = requests.filter((x) => x.id === reset.id);
  assert.equal(messages.length, 1);
  const message = JSON.parse(messages[0].bytes);
  assert.equal(message.to, email);
  assert.equal(message.from, process.env.EMAIL_FROM);
  assert.match(message.text, /This link expires in 15 minutes/);
  assert.match(message.html, /Reset password/);
});

test("legacy dispatchers cannot claim an attempted v2 reset and the new worker reconciles it", async () => {
  settings();
  mode = "lose-ack";
  const email = randomUUID() + "@imsop.test";
  const user = (
    await connection.query(
      "INSERT INTO users(email,password,name,role) VALUES($1,'unused','Mail fixture','user') RETURNING id",
      [email],
    )
  ).rows[0];
  await queuePasswordReset(email);
  await dispatchResetDeliveries();
  const reset = (
    await connection.query("SELECT * FROM reset_deliveries WHERE user_id=$1", [
      user.id,
    ])
  ).rows[0];
  assert.equal(reset.state, "pending_v2");
  await connection.query(
    "UPDATE reset_deliveries SET next_attempt_at=now() WHERE id=$1",
    [reset.id],
  );
  const legacy = await connection.query(
    "SELECT id FROM reset_deliveries WHERE id=$1 AND state IN ('pending','sending') AND expires_at>now() AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now()) AND attempts<5",
    [reset.id],
  );
  assert.equal(legacy.rowCount, 0);
  mode = "accept";
  await dispatchResetDeliveries();
  assert.equal(
    (
      await connection.query("SELECT state FROM reset_deliveries WHERE id=$1", [
        reset.id,
      ])
    ).rows[0].state,
    "sent",
  );
  const messages = requests.filter((x) => x.id === reset.id);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].bytes, messages[1].bytes);
});
