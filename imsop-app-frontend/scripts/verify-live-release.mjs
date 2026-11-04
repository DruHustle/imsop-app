import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const revision = /^[a-f0-9]{40}$/;
async function request(origin, path, options = {}) {
  const target = new URL(path, origin);
  const headers = { Accept: "application/json" };
  if (options.protectionBypass) {
    const base = new URL(origin);
    assert(
      base.protocol === "https:" && !base.port && !base.username && !base.password &&
        base.pathname === "/" && !base.search && !base.hash &&
        /^[a-z0-9][a-z0-9-]*\.vercel\.app$/.test(base.hostname),
      "Deployment protection credentials require a direct HTTPS Vercel deployment origin"
    );
    assert(
      typeof options.protectionBypass === "string" && /^[\x21-\x7e]+$/.test(options.protectionBypass),
      "Invalid deployment protection credential format"
    );
    assert.equal(target.origin, base.origin, "Cross-origin credential forwarding is forbidden");
    headers["x-vercel-protection-bypass"] = options.protectionBypass;
  }
  // Never forward deployment credentials through redirects, or accept another serving origin.
  return fetch(target, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers,
  });
}
async function json(origin, path, options) {
  const response = await request(origin, path, options);
  assert(response.ok, `${path}: HTTP ${response.status}`);
  assert(
    response.headers.get("content-type")?.includes("application/json"),
    `${path}: expected JSON, received the SPA or a proxy error`
  );
  return response.json();
}
export async function verifyApiRelease(origin, expected, options = {}) {
  assert(revision.test(expected || ""), "An exact backend revision is required");
  const version = await json(origin, "/version", options);
  assert(
    revision.test(version.revision || ""),
    "Backend release identity is missing; deploy the qualified Oracle image first"
  );
  assert.equal(version.revision, expected, "The installed backend revision differs from the qualified source");
  assert.equal(version.apiContract, 2, "Unsupported backend API contract");
  assert(version.capabilities?.includes("purchase-pagination-v1"), "The backend does not support the required purchasing pages");
  assert(version.capabilities?.includes("optional-adapters-v1"), "The backend does not support explicit optional adapter configuration");
  assert.equal((await json(origin, "/ready", options)).status, "ready", "Backend dependencies are not ready");
  for (const path of ["/api/operations/shipments?limit=1", "/supply-chain/api/v1/orders?offset=0"]) {
    const response = await request(origin, path, options);
    assert.equal(response.status, 401, `${path}: anonymous access must be rejected`);
    await response.arrayBuffer();
  }
  return version;
}
export async function verifyLiveRelease(origin, frontend, backend, options = {}) {
  assert(revision.test(frontend || ""), "An exact frontend revision is required");
  const release = await json(origin, "/release.json", options);
  assert.equal(release.frontendRevision, frontend, "The published frontend is a different revision");
  const api = await verifyApiRelease(origin, backend, options);
  return {
    origin,
    frontend: release.frontendRevision,
    backend: api.revision,
    ready: true,
    anonymousAccess: "rejected",
    verifiedAt: new Date().toISOString(),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [first, second, third] = process.argv.slice(2);
  try {
    // Ordinary public/API checks deliberately do not read any bypass secret from the environment.
    const result = first === "--api-only"
      ? await verifyApiRelease(second, third)
      : await verifyLiveRelease(first, second, third);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`Release verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
