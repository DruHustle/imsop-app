"use strict";
const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(name + " is required");
  return value;
};
const hash = env("NODE_RED_ADMIN_PASSWORD_HASH");
if (!/^\$2[aby]\$\d{2}\$/.test(hash))
  throw new Error("NODE_RED_ADMIN_PASSWORD_HASH must be bcrypt");
module.exports = {
  uiPort: 1882,
  uiHost: "127.0.0.1",
  credentialSecret: env("NODE_RED_CREDENTIAL_SECRET"),
  httpAdminRoot: "/admin",
  httpNodeRoot: "/flows",
  adminAuth: {
    type: "credentials",
    users: [{ username: env("NODE_RED_ADMIN_USER"), password: hash, permissions: "*" }]
  },
  httpNodeAuth: { user: env("NODE_RED_ADMIN_USER"), pass: hash },
  functionGlobalContext: { crypto: require("node:crypto") },
  logging: { console: { level: "info", metrics: false, audit: true } },
  editorTheme: { projects: { enabled: false } }
};
