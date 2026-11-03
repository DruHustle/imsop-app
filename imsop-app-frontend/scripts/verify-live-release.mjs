import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const revision = /^[a-f0-9]{40}$/;
async function json(origin, path) {
  const response = await fetch(new URL(path, origin), {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: { Accept: "application/json" },
  });
  assert(response.ok, `${path}: HTTP ${response.status}`);
  assert(
    response.headers.get("content-type")?.includes("application/json"),
    `${path}: expected JSON, received the SPA or a proxy error`
  );
  return response.json();
}
export async function verifyApiRelease(origin, expected) {
  assert(
    revision.test(expected || ""),
    "An exact backend revision is required"
  );
  const version = await json(origin, "/version");
  assert(
    revision.test(version.revision || ""),
    "Backend release identity is missing; deploy the qualified Oracle image first"
  );
  if (expected)
    assert.equal(
      version.revision,
      expected,
      "The installed backend revision differs from the qualified source"
    );
  assert.equal(version.apiContract, 2, "Unsupported backend API contract");
  assert(
    version.capabilities?.includes("purchase-pagination-v1"),
    "The backend does not support the required purchasing pages"
  );
  assert(
    version.capabilities?.includes("optional-adapters-v1"),
    "The backend does not support explicit optional adapter configuration"
  );
  assert.equal(
    (await json(origin, "/ready")).status,
    "ready",
    "Backend dependencies are not ready"
  );
  for (const path of [
    "/api/operations/shipments?limit=1",
    "/supply-chain/api/v1/orders?offset=0",
  ]) {
    const response = await fetch(new URL(path, origin), {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    });
    assert.equal(
      response.status,
      401,
      `${path}: anonymous access must be rejected`
    );
    await response.arrayBuffer();
  }
  return version;
}
export async function verifyLiveRelease(origin, frontend, backend) {
  assert(
    revision.test(frontend || ""),
    "An exact frontend revision is required"
  );
  const release = await json(origin, "/release.json");
  assert.equal(
    release.frontendRevision,
    frontend,
    "The published frontend is a different revision"
  );
  const api = await verifyApiRelease(origin, backend);
  return {
    origin,
    frontend: release.frontendRevision,
    backend: api.revision,
    ready: true,
    anonymousAccess: "rejected",
    verifiedAt: new Date().toISOString(),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [first, second, third] = process.argv.slice(2);
  try {
    const result =
      first === "--api-only"
        ? await verifyApiRelease(second, third)
        : await verifyLiveRelease(first, second, third);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`Release verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
