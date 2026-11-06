import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { MANAGEMENT_PERMISSIONS } from "./configuration";
const source = readFileSync("../edge/node-red/settings.js", "utf8");
const runtimeId = "8d70df1b-5722-4e7f-8dfc-e90cfa875a77",
  token = "b".repeat(64);
function settings(enrollment: Record<string, string | undefined> = {}) {
  const module = { exports: {} as any };
  runInNewContext(source, {
    module,
    require,
    Buffer,
    process: {
      env: {
        NODE_RED_ADMIN_USER: "synthetic-editor-admin",
        NODE_RED_ADMIN_PASSWORD_HASH: "$2b$12$synthetic-hash",
        NODE_RED_CREDENTIAL_SECRET: "synthetic-flow-credential-secret",
        EDGE_INGRESS_TOKEN: "synthetic-ingress-token",
        ...enrollment,
      },
    },
  });
  return module.exports;
}
test("optional package enrollment preserves loopback 1882, authenticated /flows, editor login and the agent crypto context", async () => {
  const plain = settings();
  assert.equal(plain.uiHost, "127.0.0.1");
  assert.equal(plain.uiPort, 1882);
  assert.equal(plain.httpAdminRoot, "/admin");
  assert.equal(plain.httpNodeRoot, "/flows");
  assert.equal(plain.httpNodeAuth.user, "synthetic-editor-admin");
  assert.equal(plain.adminAuth.users[0].permissions, "*");
  assert.equal(
    typeof plain.functionGlobalContext.crypto.createHmac,
    "function",
  );
  assert.equal(plain.adminAuth.tokens, undefined);
  assert.equal(plain.externalModules, undefined);
  const enrolled = settings({
    NODE_RED_RUNTIME_ID: runtimeId,
    NODE_RED_ADMIN_TOKEN: token,
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(await enrolled.adminAuth.tokens(token))),
    {
      username: "smart-logistics-package-manager",
      permissions: MANAGEMENT_PERMISSIONS,
    },
  );
  for (const invalid of ["c".repeat(64), "short", "é".repeat(64), null])
    assert.equal(await enrolled.adminAuth.tokens(invalid), null);
  assert.deepEqual(
    JSON.parse(JSON.stringify(enrolled.externalModules.palette)),
    { allowInstall: true, allowUpdate: false, allowUpload: false },
  );
  let identified = false,
    continued = false;
  enrolled.httpAdminMiddleware(
    {},
    {
      set: (name: string, value: string) => {
        assert.equal(name, "X-Smart-Logistics-Node-RED-Runtime");
        assert.equal(value, runtimeId);
        identified = true;
      },
    },
    () => {
      continued = true;
    },
  );
  assert.equal(identified && continued, true);
  assert.equal(enrolled.httpNodeRoot, plain.httpNodeRoot);
  assert.equal(enrolled.credentialSecret, plain.credentialSecret);
});
test("gateway startup refuses partial, weak or reused enrollment credentials", () => {
  for (const enrollment of [
    { NODE_RED_ADMIN_TOKEN: token },
    { NODE_RED_RUNTIME_ID: runtimeId },
    { NODE_RED_RUNTIME_ID: runtimeId, NODE_RED_ADMIN_TOKEN: "weak" },
    {
      NODE_RED_RUNTIME_ID: runtimeId,
      NODE_RED_ADMIN_TOKEN: token,
      EDGE_INGRESS_TOKEN: token,
    },
    {
      NODE_RED_RUNTIME_ID: runtimeId,
      NODE_RED_ADMIN_TOKEN: token,
      NODE_RED_CREDENTIAL_SECRET: token,
    },
  ])
    assert.throws(() => settings(enrollment), /separate 64-character/);
});
