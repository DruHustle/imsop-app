import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectProduction, httpsOrigin } from './production-preflight.mjs';

const revision = 'a'.repeat(40);
const webOrigin = 'https://logistics.example.test';
const apiOrigin = 'https://api.example.test';
const settings = { webOrigin, apiOrigin, revision };

function fixture(overrides = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), options });
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert(!Object.keys(options.headers).some(key => /authorization|cookie|bypass/i.test(key)));
    const path = url.pathname;
    if (overrides.intercept) {
      const response = await overrides.intercept(url, options);
      if (response) return response;
    }
    if (path === '/release.json') return Response.json({ frontendRevision: overrides.frontend || revision, apiContract: 2 });
    if (path === '/version') return Response.json({
      revision: overrides.backend || revision, apiContract: 2,
      capabilities: ['purchase-pagination-v1', 'optional-adapters-v1'],
    });
    if (path === '/ready') return Response.json({ status: 'ready', dependencies: [
      { name: 'node-api', healthy: true }, { name: 'operations-service', healthy: true },
      { name: 'supply-chain', healthy: true },
    ] });
    assert(['/api/operations/shipments', '/supply-chain/api/v1/orders'].includes(path));
    const headers = {};
    if (options.headers.Origin === webOrigin) {
      headers['access-control-allow-origin'] = webOrigin;
      headers['access-control-allow-credentials'] = 'true';
    }
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  };
  return { fetcher, calls };
}

test('successful public checks never authorize authenticated acceptance, rollback or retirement', async () => {
  const { fetcher, calls } = fixture();
  const report = await inspectProduction({ ...settings, fetcher });
  assert.equal(report.status, 'public-checks-passed');
  assert.equal(report.publicChecksPassed, true);
  assert.equal(report.candidateRevisionMatched, true);
  assert.equal(report.authenticatedAcceptance, 'not-run');
  assert.equal(report.rollbackVerification, 'not-run');
  assert.equal(report.retirementEligible, false);
  assert.equal(calls.length, 17);
  assert.equal(report.probes.length, 12);
  assert(calls.every(call => [webOrigin, apiOrigin].includes(new URL(call.url).origin)));
});

test('healthy older deployments remain blocked for the consolidated source', async () => {
  const { fetcher } = fixture({ frontend: 'b'.repeat(40), backend: 'c'.repeat(40) });
  const report = await inspectProduction({ ...settings, fetcher });
  assert.equal(report.baselinePassed, true);
  assert.equal(report.originPolicyPassed, true);
  assert.equal(report.candidateRevisionMatched, false);
  assert.equal(report.publicChecksPassed, false);
  assert.equal(report.status, 'blocked');
});

test('readiness and identity do not accept HTML, missing dependencies or mismatched proxies', async t => {
  const cases = [
    ['HTML fallback', url => url.pathname === '/version' ? new Response('<html>private error</html>') : null],
    ['missing dependency checks', url => url.pathname === '/ready' ? Response.json({ status: 'ready' }) : null],
    ['unhealthy dependency', url => url.pathname === '/ready' ? Response.json({ status: 'ready', dependencies: [
      { name: 'node-api', healthy: true }, { name: 'operations-service', healthy: true }, { name: 'supply-chain', healthy: false },
    ] }) : null],
    ['duplicate dependencies', url => url.pathname === '/ready' ? Response.json({ status: 'ready', dependencies: [
      { name: 'node-api', healthy: true }, { name: 'operations-service', healthy: true },
      { name: 'supply-chain', healthy: true }, { name: 'supply-chain', healthy: true },
    ] }) : null],
    ['unsupported contract', url => url.pathname === '/version' ? Response.json({ revision, apiContract: 1, capabilities: [] }) : null],
    ['wrong proxy', url => url.origin === webOrigin && url.pathname === '/version' ? Response.json({
      revision: 'd'.repeat(40), apiContract: 2, capabilities: ['purchase-pagination-v1', 'optional-adapters-v1'],
    }) : null],
    ['array instead of object', url => url.pathname === '/ready' ? Response.json([]) : null],
    ['invalid JSON', url => url.pathname === '/ready' ? new Response('secret-not-json', { headers: { 'content-type': 'application/json' } }) : null],
    ['oversized JSON', url => url.pathname === '/version' ? Response.json({ secret: 'x'.repeat(70000) }) : null],
  ];
  for (const [name, intercept] of cases) await t.test(name, async () => {
    const { fetcher } = fixture({ intercept });
    const report = await inspectProduction({ ...settings, fetcher });
    assert.equal(report.baselinePassed, false);
    assert.equal(report.publicChecksPassed, false);
    assert(!JSON.stringify(report).includes('secret-not-json'));
    assert(JSON.stringify(report).length < 15000);
  });
});

test('anonymous operational data is never read or copied into the evidence', async () => {
  let cancelled = 0;
  const { fetcher } = fixture({ intercept: url => {
    if (!url.pathname.startsWith('/api/')) return null;
    const stream = new ReadableStream({ cancel() { cancelled++; } });
    return new Response(stream, { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  const report = await inspectProduction({ ...settings, fetcher });
  assert.equal(report.baselinePassed, false);
  assert.equal(cancelled, 6);
  assert(report.probes.filter(p => p.path.startsWith('/api/')).every(p => !p.passed));
});

test('Vercel login HTML is not mistaken for an application authentication denial', async () => {
  const { fetcher } = fixture({ intercept: url => url.pathname.startsWith('/api/')
    ? new Response('<html>login</html>', { status: 401, headers: { 'content-type': 'text/html' } }) : null });
  const report = await inspectProduction({ ...settings, fetcher });
  assert.equal(report.baselinePassed, false);
  assert(report.probes.filter(p => p.path.startsWith('/api/') && p.mode === 'anonymous').every(p => !p.passed));
});

test('CORS rejects wildcard, reflected untrusted origins and missing credential support', async t => {
  for (const mode of ['wildcard', 'reflected', 'no-credentials']) await t.test(mode, async () => {
    const { fetcher } = fixture({ intercept: (url, options) => {
      if (!url.pathname.startsWith('/api/') || !options.headers.Origin) return null;
      const origin = options.headers.Origin;
      const headers = {};
      if (mode === 'wildcard') headers['access-control-allow-origin'] = '*';
      if (mode === 'reflected') headers['access-control-allow-origin'] = origin;
      if (mode === 'no-credentials' && origin === webOrigin) headers['access-control-allow-origin'] = origin;
      return Response.json({ error: 'unauthorized' }, { status: 401, headers });
    } });
    const report = await inspectProduction({ ...settings, fetcher });
    assert.equal(report.baselinePassed, true);
    assert.equal(report.originPolicyPassed, false);
    assert.equal(report.publicChecksPassed, false);
  });
});

test('redirects and network failures do not leak arbitrary exception text', async () => {
  const { fetcher } = fixture({ intercept: url => {
    if (url.pathname === '/release.json') {
      const response = Response.json({ frontendRevision: revision, apiContract: 2 });
      Object.defineProperty(response, 'redirected', { value: true });
      return response;
    }
    throw new Error('Authorization=secret-value-that-must-not-leak');
  } });
  const report = await inspectProduction({ ...settings, fetcher });
  assert.equal(report.publicChecksPassed, false);
  assert.equal(report.observed.frontend.error, 'redirect-rejected');
  assert(!JSON.stringify(report).includes('secret-value'));
});

test('invalid origins and non-exact source revisions fail before network access', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; throw new Error('must not fetch'); };
  for (const origin of ['http://example.test', 'https://u:p@example.test', 'https://example.test/path',
    'https://example.test/?key=secret', 'https://example.test/#x', '', ' https://example.test']) {
    assert.throws(() => httpsOrigin(origin));
    await assert.rejects(inspectProduction({ ...settings, webOrigin: origin, fetcher }));
  }
  for (const value of ['main', 'a'.repeat(39), 'a'.repeat(41), undefined]) {
    await assert.rejects(inspectProduction({ ...settings, revision: value, fetcher }));
  }
  assert.equal(calls, 0);
  assert.equal(httpsOrigin('https://example.test/'), 'https://example.test');
});


test('empty ASP.NET Bearer challenges are valid application denials, never HTML login responses', async () => {
  for (const html of [false, true]) {
    const { fetcher } = fixture({ intercept: (url, options) => {
      if (!url.pathname.startsWith('/supply-chain/')) return null;
      const headers = { 'www-authenticate': 'Bearer' };
      if (options.headers.Origin === webOrigin) {
        headers['access-control-allow-origin'] = webOrigin;
        headers['access-control-allow-credentials'] = 'true';
      }
      if (html) headers['content-type'] = 'text/html';
      return new Response(html ? '<html>login</html>' : null, { status: 401, headers });
    } });
    const report = await inspectProduction({ ...settings, fetcher });
    assert.equal(report.publicChecksPassed, !html);
  }
});
