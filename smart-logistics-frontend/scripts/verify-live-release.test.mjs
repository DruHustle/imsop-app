import test from "node:test";
import assert from "node:assert/strict";
import { verifyLiveRelease, verifyApiRelease } from "./verify-live-release.mjs";
const sha = "a".repeat(40);
test("release verification rejects HTML fallbacks, old runtimes, mismatched revisions and anonymous data", async t => {
  let mode = "html";
  t.mock.method(globalThis, "fetch", async url => {
    const path = new URL(url).pathname;
    if (mode === "html")
      return new Response("<!doctype html>", {
        headers: { "content-type": "text/html" },
      });
    if (path.startsWith("/api/") || path.startsWith("/supply-chain/"))
      return new Response("{}", { status: mode === "public" ? 200 : 401 });
    const data =
      path === "/version"
        ? {
            revision: sha,
            apiContract: 2,
            capabilities:
              mode === "old"
                ? []
                : ["purchase-pagination-v1", "optional-adapters-v1"],
          }
        : path === "/ready"
          ? { status: "ready" }
          : { frontendRevision: sha };
    return Response.json(data);
  });
  await assert.rejects(
    verifyApiRelease("https://app.test", sha),
    /expected JSON/
  );
  mode = "old";
  await assert.rejects(
    verifyApiRelease("https://app.test", sha),
    /purchasing pages/
  );
  mode = "good";
  await assert.rejects(
    verifyLiveRelease("https://app.test", "b".repeat(40), sha),
    /different revision/
  );
  mode = "public";
  await assert.rejects(
    verifyApiRelease("https://app.test", sha),
    /anonymous access/
  );
  mode = "good";
  assert.equal(
    (await verifyLiveRelease("https://app.test", sha, sha)).ready,
    true
  );
});
