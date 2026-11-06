import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { currentApiOrigin, prepareDeployment, httpsOrigin } from "./prepare-deployment.mjs";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const html = await readFile(new URL("../client/index.html", import.meta.url), "utf8");

test("production defaults and first-party proxy routes use the canonical Logistics API", async () => {
  assert.equal(currentApiOrigin, "https://logistics-api.onesa.eu");
  const environment = await readFile(new URL("../.env.production", import.meta.url), "utf8");
  assert.deepEqual(
    environment.split(/\r?\n/).filter(line => line.startsWith("VITE_API_URL=")),
    ["VITE_API_URL=" + currentApiOrigin]
  );
  for (const pathname of ["/version", "/api/:path*", "/supply-chain/:path*", "/health", "/ready"]) {
    assert.equal(config.rewrites.find(route => route.source === pathname)?.destination,
      currentApiOrigin + pathname);
  }
});

test("domain migration moves every authenticated and readiness path before the SPA fallback", () => {
  const original = structuredClone(config);
  const prepared = prepareDeployment(config, html, "https://qualified-api.example/", "https://logistics.onesa.eu/");
  const routes = prepared.config.rewrites;
  const spa = routes.findIndex(route => route.destination === "/index.html");
  for (const pathname of ["/version", "/api/:path*", "/supply-chain/:path*", "/health", "/ready"]) {
    const index = routes.findIndex(route => route.source === pathname);
    assert(index >= 0 && index < spa);
    assert.equal(routes[index].destination, "https://qualified-api.example" + pathname);
  }
  assert.deepEqual(prepared.config.headers, config.headers);
  assert.deepEqual(prepared.config.git, config.git);
  assert.match(prepared.html, /rel="canonical" href="https:\/\/logistics.onesa.eu\/"/);
  assert(!prepared.html.includes("imsop-app.vercel.app"));
  assert.deepEqual(config, original, "The source configuration must not be mutated");
});

test("bad origins and an incomplete proxy fail before configuration is written", () => {
  for (const origin of ["http://api.example", "https://api.example/api", "https://user:password@api.example", "https://api.example/?x=1", "https://api.example/#bad", "https://api.example;bad"]) {
    assert.throws(() => httpsOrigin(origin, "test"));
  }
  const broken = structuredClone(config);
  broken.rewrites = broken.rewrites.filter(route => route.source !== "/supply-chain/:path*");
  assert.throws(() => prepareDeployment(broken, html, "https://logistics-api.onesa.eu", "https://logistics.onesa.eu"), /supply-chain/);
});
