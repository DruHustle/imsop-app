import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { prepareDeployment, httpsOrigin } from "./prepare-deployment.mjs";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const html = await readFile(new URL("../client/index.html", import.meta.url), "utf8");

test("domain migration moves every authenticated and readiness path before the SPA fallback", () => {
  const prepared = prepareDeployment(config, html, "https://logistics-api.onesa.eu/", "https://logistics.onesa.eu/");
  const routes = prepared.config.rewrites;
  const spa = routes.findIndex(route => route.destination === "/index.html");
  for (const pathname of ["/version", "/api/:path*", "/supply-chain/:path*", "/health", "/ready"]) {
    const index = routes.findIndex(route => route.source === pathname);
    assert(index >= 0 && index < spa);
    assert.equal(routes[index].destination, "https://logistics-api.onesa.eu" + pathname);
  }
  assert.deepEqual(prepared.config.headers, config.headers);
  assert.deepEqual(prepared.config.git, config.git);
  assert.match(prepared.html, /rel="canonical" href="https:\/\/logistics.onesa.eu\/"/);
  assert(!prepared.html.includes("imsop-app.vercel.app"));
  assert(config.rewrites.some(route => route.destination.includes("152-70-22-84")), "The source configuration must not be mutated");
});

test("bad origins and an incomplete proxy fail before configuration is written", () => {
  for (const origin of ["http://api.example", "https://api.example/api", "https://user:password@api.example", "https://api.example/?x=1", "https://api.example/#bad", "https://api.example;bad"]) {
    assert.throws(() => httpsOrigin(origin, "test"));
  }
  const broken = structuredClone(config);
  broken.rewrites = broken.rewrites.filter(route => route.source !== "/supply-chain/:path*");
  assert.throws(() => prepareDeployment(broken, html, "https://logistics-api.onesa.eu", "https://logistics.onesa.eu"), /supply-chain/);
});
