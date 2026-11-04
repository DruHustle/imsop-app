import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { verifyDeployment } from "./verify-deployment.mjs";

async function fixture(run) {
  const directory = await mkdtemp(path.join(tmpdir(), "imsop-build-"));
  try {
    await mkdir(path.join(directory, "assets"));
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
test("rejects stale lazy Operations chunks even when the entry bundle is clean", () =>
  fixture(async directory => {
    await writeFile(
      path.join(directory, "assets/index.js"),
      'const base="/api";'
    );
    await writeFile(
      path.join(directory, "assets/Operations.js"),
      'fetch("https://imsop-app.onrender.com/api/operations/shipments");'
    );
    await assert.rejects(verifyDeployment(directory), /retired Render backend/);
  }));
test("accepts same-origin and Oracle bundles", () =>
  fixture(async directory => {
    await writeFile(
      path.join(directory, "assets/index.js"),
      'const base="/api";'
    );
    await writeFile(
      path.join(directory, "assets/Operations.js"),
      'const base="https://imsop-api.152-70-22-84.sslip.io";'
    );
    assert.equal(await verifyDeployment(directory), 2);
  }));
test("does not pass an absent build", () =>
  fixture(async directory => {
    await assert.rejects(verifyDeployment(directory), /Build the frontend/);
  }));

test("purchasing keeps first-party cookie requests out of the SPA fallback", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8")
  );
  const index = config.rewrites.findIndex(
    route => route.source === "/supply-chain/:path*"
  );
  assert(
    index >= 0 &&
      index <
        config.rewrites.findIndex(route => route.destination === "/index.html")
  );
  assert.equal(
    config.rewrites[index].destination,
    "https://imsop-api.152-70-22-84.sslip.io/supply-chain/:path*"
  );
  assert(
    config.headers.some(
      route =>
        route.source === "/supply-chain/:path*" &&
        route.headers.some(
          header =>
            header.key === "Cache-Control" &&
            header.value === "private, no-store"
        )
    )
  );
});

test("production publishing uses the qualified CI path and exposes source identities", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8")
  );
  assert.equal(
    config.git.deploymentEnabled.main,
    false,
    "Git auto-publishing must not bypass the backend compatibility gate"
  );
  const version = config.rewrites.findIndex(
    route => route.source === "/version"
  );
  const spa = config.rewrites.findIndex(
    route => route.destination === "/index.html"
  );
  assert(version >= 0 && version < spa);
  assert.equal(
    config.rewrites[version].destination,
    "https://imsop-api.152-70-22-84.sslip.io/version"
  );
  assert(
    config.headers.some(
      route =>
        route.source === "/release.json" &&
        route.headers.some(
          header =>
            header.key === "Cache-Control" && header.value === "no-store"
        )
    )
  );
});
