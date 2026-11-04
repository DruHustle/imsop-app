import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const currentApiOrigin = "https://imsop-api.152-70-22-84.sslip.io";
export const currentWebOrigin = "https://imsop-app.vercel.app";
const apiPaths = ["/version", "/supply-chain/:path*", "/health", "/ready", "/api/:path*"];

export function httpsOrigin(value, name) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${name} must be a valid HTTPS origin`); }
  assert(parsed.protocol === "https:" && parsed.pathname === "/" && !parsed.search && !parsed.hash && !parsed.username && !parsed.password,
    `${name} must be an HTTPS origin without credentials, a path, query or fragment`);
  assert(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(parsed.hostname), `${name} has an invalid hostname`);
  return parsed.origin;
}

export function prepareDeployment(config, html, apiOrigin, webOrigin) {
  const api = httpsOrigin(apiOrigin, "IMSOP_API_ORIGIN");
  const web = httpsOrigin(webOrigin, "IMSOP_WEB_ORIGIN");
  const result = structuredClone(config);
  const spaIndex = result.rewrites?.findIndex(route => route.destination === "/index.html");
  assert(spaIndex >= 0, "The existing SPA fallback is missing");
  for (const pathname of apiPaths) {
    const matches = result.rewrites.map((route, index) => ({ route, index })).filter(({ route }) => route.source === pathname);
    assert(matches.length === 1 && matches[0].index < spaIndex, `${pathname} must have one proxy route before the SPA fallback`);
    matches[0].route.destination = api + pathname;
  }
  // Root-hosted browser clients use first-party requests; the rewrite owns routing.
  result.buildCommand = "VITE_BASE_PATH=/ pnpm build";
  const nextHtml = html.replaceAll(currentWebOrigin, web);
  assert(nextHtml.includes(`rel="canonical" href="${web}/"`), "The canonical frontend URL could not be prepared");
  return { config: result, html: nextHtml, apiOrigin: api, webOrigin: web };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const configPath = process.argv[2] || "vercel.json";
  const htmlPath = process.argv[3] || "client/index.html";
  const prepared = prepareDeployment(
    JSON.parse(await readFile(configPath, "utf8")),
    await readFile(htmlPath, "utf8"),
    process.env.IMSOP_API_ORIGIN || currentApiOrigin,
    process.env.IMSOP_WEB_ORIGIN || currentWebOrigin,
  );
  await writeFile(configPath, JSON.stringify(prepared.config, null, 2) + "\n");
  await writeFile(htmlPath, prepared.html);
  console.log(`Prepared IMSOP frontend ${prepared.webOrigin} with API ${prepared.apiOrigin}`);
}
