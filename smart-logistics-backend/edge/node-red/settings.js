"use strict";
const { timingSafeEqual } = require("node:crypto");
const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(name + " is required");
  return value;
};
const hash = env("NODE_RED_ADMIN_PASSWORD_HASH");
if (!/^\$2[aby]\$\d{2}\$/.test(hash))
  throw new Error("NODE_RED_ADMIN_PASSWORD_HASH must be bcrypt");
const managementToken = process.env.NODE_RED_ADMIN_TOKEN || "";
const runtimeId = process.env.NODE_RED_RUNTIME_ID || "";
if (managementToken || runtimeId) {
  if (
    !/^[a-f0-9]{64}$/i.test(managementToken) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      runtimeId,
    ) ||
    managementToken === process.env.EDGE_INGRESS_TOKEN ||
    managementToken === process.env.NODE_RED_CREDENTIAL_SECRET
  )
    throw new Error(
      "Package management requires an enrolled runtime UUID and a separate 64-character hexadecimal token",
    );
}
module.exports = {
  uiPort: 1882,
  uiHost: "127.0.0.1",
  credentialSecret: env("NODE_RED_CREDENTIAL_SECRET"),
  httpAdminRoot: "/admin",
  httpNodeRoot: "/flows",
  adminAuth: {
    type: "credentials",
    users: [
      {
        username: env("NODE_RED_ADMIN_USER"),
        password: hash,
        permissions: "*",
      },
    ],
    ...(managementToken
      ? {
          tokens: async (token) => {
            if (
              typeof token !== "string" ||
              !/^[a-f0-9]{64}$/i.test(token) ||
              !timingSafeEqual(Buffer.from(token), Buffer.from(managementToken))
            )
              return null;
            return {
              username: "smart-logistics-package-manager",
              permissions: [
                "nodes.read",
                "nodes.write",
                "plugins.read",
                "settings.read",
              ],
            };
          },
        }
      : {}),
  },
  ...(managementToken
    ? {
        httpAdminMiddleware: (_req, res, next) => {
          res.set("X-Smart-Logistics-Node-RED-Runtime", runtimeId);
          next();
        },
        // Runtime enforcement also prevents an external editor race from updating an
        // existing module between the broker preflight and its add-only request.
        externalModules: {
          palette: {
            allowInstall: true,
            allowUpdate: false,
            allowUpload: false,
          },
        },
      }
    : {}),
  httpNodeAuth: { user: env("NODE_RED_ADMIN_USER"), pass: hash },
  functionGlobalContext: { crypto: require("node:crypto") },
  logging: { console: { level: "info", metrics: false, audit: true } },
  editorTheme: { projects: { enabled: false } },
};
