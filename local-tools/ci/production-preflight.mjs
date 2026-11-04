#!/usr/bin/env node
/** Read-only public release evidence. Never deploys, authenticates or authorizes retirement. */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const REQUIRED_CAPABILITIES = ['purchase-pagination-v1', 'optional-adapters-v1'];
const REQUIRED_DEPENDENCIES = ['node-api', 'operations-service', 'supply-chain'];
const PROTECTED_PATHS = ['/api/operations/shipments?limit=1', '/supply-chain/api/v1/orders?offset=0'];
const DENIED_ORIGIN = 'https://imsop-preflight-untrusted.invalid';
const MAX_JSON_BYTES = 65536;

export function httpsOrigin(value) {
  assert(typeof value === 'string' && value && value.trim() === value, 'An explicit HTTPS origin is required');
  const url = new URL(value);
  assert(url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password,
    'Use an HTTPS origin without credentials, path, query or fragment');
  return url.origin;
}

async function readObject(response) {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel();
    throw new Error('invalid-content-type');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('missing-body');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_JSON_BYTES) {
        await reader.cancel();
        throw new Error('response-too-large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let object;
  try { object = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('invalid-json'); }
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error('invalid-json-object');
  return object;
}

async function request(fetcher, origin, path, originHeader) {
  const headers = { Accept: 'application/json', 'Cache-Control': 'no-cache' };
  if (originHeader) headers.Origin = originHeader;
  const response = await fetcher(new URL(path, origin), {
    method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
    signal: AbortSignal.timeout(10000), headers,
  });
  if (response.redirected) {
    await response.body?.cancel();
    throw new Error('redirect-rejected');
  }
  return response;
}

async function publicObject(fetcher, origin, path) {
  try {
    const response = await request(fetcher, origin, path);
    if (response.status !== 200) {
      await response.body?.cancel();
      return { status: response.status, error: 'unexpected-status' };
    }
    return { status: response.status, data: await readObject(response) };
  } catch (error) {
    const known = new Set(['invalid-content-type', 'missing-body', 'response-too-large', 'invalid-json', 'invalid-json-object', 'redirect-rejected']);
    return { status: null, error: known.has(error.message) ? error.message : 'request-failed' };
  }
}

function versionIdentity(result) {
  const data = result.data;
  return {
    status: result.status,
    revision: SHA.test(data?.revision || '') ? data.revision : null,
    contractValid: data?.apiContract === 2 && Array.isArray(data.capabilities)
      && REQUIRED_CAPABILITIES.every(capability => data.capabilities.includes(capability)),
    error: result.error || null,
  };
}

function readiness(result) {
  const entries = result.data?.dependencies;
  const ready = result.data?.status === 'ready' && Array.isArray(entries)
    && REQUIRED_DEPENDENCIES.every(name => entries.filter(item => item?.name === name).length === 1
      && entries.find(item => item?.name === name)?.healthy === true)
    && entries.every(item => item?.healthy === true);
  return { status: result.status, ready: !!ready, error: result.error || null };
}

async function accessProbe(fetcher, origin, path, originHeader, mode) {
  try {
    const response = await request(fetcher, origin, path, originHeader);
    const type = response.headers.get('content-type') || '';
    const allow = response.headers.get('access-control-allow-origin');
    const credentials = response.headers.get('access-control-allow-credentials') === 'true';
    // Never read operational response bodies, even if access control unexpectedly fails.
    await response.body?.cancel();
    const json = /^application\/json(?:\s*;|$)/i.test(type);
    const allowedOrigin = allow === originHeader && !!originHeader;
    const bearerChallenge = /(?:^|,)\s*Bearer(?:\s|,|$)/i.test(response.headers.get('www-authenticate') || '');
    // ASP.NET's JWT challenge may be an empty 401 with WWW-Authenticate: Bearer.
    const applicationDenial = response.status === 401 && (json || (bearerChallenge && !/text\/html/i.test(type)));
    const passed = mode === 'allowed'
      ? applicationDenial && allowedOrigin && credentials
      : mode === 'denied'
        ? [401, 403].includes(response.status) && !allow
        : applicationDenial;
    return {
      path, mode, status: response.status, passed,
      jsonResponse: json, bearerChallenge,
      allowOrigin: !allow ? null : allowedOrigin ? 'requested-origin' : allow === '*' ? '*' : 'unexpected-origin',
      allowCredentials: credentials,
    };
  } catch {
    return { path, mode, status: null, passed: false, error: 'request-failed' };
  }
}

export async function inspectProduction({ webOrigin, apiOrigin, revision, fetcher = fetch }) {
  const web = httpsOrigin(webOrigin);
  const api = httpsOrigin(apiOrigin);
  assert(SHA.test(revision || ''), 'An exact consolidated source SHA is required');
  assert(web !== DENIED_ORIGIN && api !== DENIED_ORIGIN, 'The negative-test origin cannot be a deployment target');
  const [release, proxyVersion, apiVersion, proxyReady, apiReady] = await Promise.all([
    publicObject(fetcher, web, '/release.json'), publicObject(fetcher, web, '/version'),
    publicObject(fetcher, api, '/version'), publicObject(fetcher, web, '/ready'),
    publicObject(fetcher, api, '/ready'),
  ]);
  const frontend = {
    status: release.status,
    revision: SHA.test(release.data?.frontendRevision || '') ? release.data.frontendRevision : null,
    contractValid: release.data?.apiContract === 2,
    error: release.error || null,
  };
  const proxy = versionIdentity(proxyVersion);
  const backend = versionIdentity(apiVersion);
  const ready = { proxy: readiness(proxyReady), backend: readiness(apiReady) };
  const probes = [];
  for (const [target, origin] of [['web', web], ['api', api]]) {
    for (const path of PROTECTED_PATHS) {
      for (const [mode, header] of [['anonymous', undefined], ['allowed', web], ['denied', DENIED_ORIGIN]]) {
        probes.push({ target, ...await accessProbe(fetcher, origin, path, header, mode) });
      }
    }
  }
  const baselinePassed = !!frontend.revision && frontend.contractValid && !!backend.revision
    && !!proxy.revision && backend.contractValid && proxy.contractValid && proxy.revision === backend.revision
    && ready.proxy.ready && ready.backend.ready && probes.filter(p => p.mode === 'anonymous').every(p => p.passed);
  const originPolicyPassed = probes.filter(p => p.mode !== 'anonymous').every(p => p.passed);
  const candidateRevisionMatched = [frontend, proxy, backend].every(item => item.revision === revision);
  const publicChecksPassed = baselinePassed && originPolicyPassed && candidateRevisionMatched;
  // Before frontend staging the old frontend is expected; the direct API must
  // already have this source, readiness, access boundary and production Origin.
  const apiChecksPassed = backend.revision === revision && backend.contractValid
    && ready.backend.ready && probes.filter(p => p.target === 'api').every(p => p.passed);
  return {
    schemaVersion: 1, checkedAt: new Date().toISOString(), repository: 'DruHustle/smart-logistics',
    expectedRevision: revision, webOrigin: web, apiOrigin: api,
    status: publicChecksPassed ? 'public-checks-passed' : 'blocked',
    baselinePassed, originPolicyPassed, candidateRevisionMatched, publicChecksPassed, apiChecksPassed,
    observed: { frontend, proxy, backend, readiness: ready }, probes,
    authenticatedAcceptance: 'not-run', rollbackVerification: 'not-run', retirementEligible: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { values } = parseArgs({ options: {
      'web-origin': { type: 'string' }, 'api-origin': { type: 'string' }, revision: { type: 'string' },
      out: { type: 'string' }, enforce: { type: 'boolean', default: false },
      'enforce-api': { type: 'boolean', default: false },
    } });
    const report = await inspectProduction({ webOrigin: values['web-origin'], apiOrigin: values['api-origin'], revision: values.revision });
    const serialized = JSON.stringify(report, null, 2) + '\n';
    if (values.out) await writeFile(values.out, serialized, { mode: 0o600 });
    process.stdout.write(serialized);
    if ((values.enforce && !report.publicChecksPassed) || (values['enforce-api'] && !report.apiChecksPassed)) process.exitCode = 1;
  } catch {
    console.error('Production preflight failed. Check explicit origins, full source SHA and output path; no deployment was performed.');
    process.exitCode = 1;
  }
}
