import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stagedOrigin, verifyStagedRelease } from './staged-release.mjs';
import { verifyLiveRelease } from '../../imsop-app-frontend/scripts/verify-live-release.mjs';
const sha = 'a'.repeat(40);
const env = { GITHUB_REPOSITORY: 'DruHustle/imsop-app', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sha,
  VERCEL_TOKEN: 'synthetic-api-secret', VERCEL_ORG_ID: 'team_test', VERCEL_PROJECT_ID: 'prj_test',
  VERCEL_CLI_VERSION: '1.2.3', IMSOP_API_ORIGIN: 'https://api.example.test', IMSOP_WEB_ORIGIN: 'https://web.example.test',
  VERCEL_AUTOMATION_BYPASS_SECRET: 'synthetic-protection-secret' };
const origin = 'https://imsop-test.vercel.app';
const metadata = { id: 'dpl_test', projectId: env.VERCEL_PROJECT_ID, url: 'imsop-test.vercel.app',
  target: 'production', readyState: 'READY', meta: { imsopSourceRevision: sha, imsopRepository: env.GITHUB_REPOSITORY } };
function route(url) {
  if (url.pathname === '/release.json') return Response.json({ frontendRevision: sha });
  if (url.pathname === '/version') return Response.json({ revision: sha, apiContract: 2, capabilities: ['purchase-pagination-v1', 'optional-adapters-v1'] });
  if (url.pathname === '/ready') return Response.json({ status: 'ready' });
  return Response.json({}, { status: 401 });
}
test('staging rejects non-deployment origins and URL-embedded credentials', () => {
  for (const value of ['http://imsop-test.vercel.app', 'https://evil.test', 'https://imsop-test.vercel.app.evil.test',
    'https://u:p@imsop-test.vercel.app', origin + '/x', origin + '?token=x', origin + '#x', origin + ':444']) {
    assert.throws(() => stagedOrigin(value));
  }
  assert.equal(stagedOrigin(origin).origin, origin);
});
test('ownership precedes bypass; credentials stay scoped and never enter receipts', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (value, options) => {
    const url = new URL(value); requests++;
    assert.equal(options.redirect, 'error');
    if (url.hostname === 'api.vercel.com') {
      assert.equal(requests, 1);
      assert.equal(url.pathname, '/v13/deployments/imsop-test.vercel.app');
      assert.equal(url.searchParams.get('teamId'), env.VERCEL_ORG_ID);
      assert.equal(options.headers.Authorization, `Bearer ${env.VERCEL_TOKEN}`);
      assert(!options.headers['x-vercel-protection-bypass']);
      return Response.json(metadata);
    }
    assert.equal(url.origin, origin);
    assert(!options.headers.Authorization && !options.headers.Cookie);
    assert.equal(options.headers['x-vercel-protection-bypass'], env.VERCEL_AUTOMATION_BYPASS_SECRET);
    return route(url);
  });
  const receipt = await verifyStagedRelease(origin, env);
  assert.equal(receipt.deploymentId, 'dpl_test');
  assert.equal(receipt.ready, true);
  assert.equal(requests, 6);
  for (const secret of [env.VERCEL_TOKEN, env.VERCEL_AUTOMATION_BYPASS_SECRET]) assert(!JSON.stringify(receipt).includes(secret));
});
test('incorrect project, source, target or state cannot receive protection credentials', async t => {
  let current;
  t.mock.method(globalThis, 'fetch', async value => {
    assert.equal(new URL(value).hostname, 'api.vercel.com');
    return Response.json(current);
  });
  for (const patch of [{ projectId: 'prj_other' }, { url: 'other.vercel.app' }, { target: 'preview' },
    { readyState: 'BUILDING' }, { meta: {} }, { id: 'bad id' }]) {
    current = { ...metadata, ...patch };
    await assert.rejects(verifyStagedRelease(origin, env));
  }
});
test('missing bypass does not invent an authenticated production smoke result', async t => {
  t.mock.method(globalThis, 'fetch', async value => new URL(value).hostname === 'api.vercel.com'
    ? Response.json(metadata) : new Response('Sign in', { status: 401 }));
  await assert.rejects(verifyStagedRelease(origin, { ...env, VERCEL_AUTOMATION_BYPASS_SECRET: '' }), /HTTP 401/);
});
test('ordinary public checks never attach either deployment credential', async t => {
  t.mock.method(globalThis, 'fetch', async (value, options) => {
    assert.deepEqual(options.headers, { Accept: 'application/json' });
    assert.equal(options.redirect, 'error');
    return route(new URL(value));
  });
  assert.equal((await verifyLiveRelease('https://web.example.test', sha, sha)).ready, true);
});
test('probe refuses bypass credentials for custom domains, credentials or ports before fetch', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Unexpected network access'));
  for (const target of ['https://web.example.test', 'http://imsop-test.vercel.app', 'https://u:p@imsop-test.vercel.app', origin + ':444']) {
    await assert.rejects(verifyLiveRelease(target, sha, sha, { protectionBypass: env.VERCEL_AUTOMATION_BYPASS_SECRET }));
  }
});
test('staged workflow scopes credentials, pins actions and checks before promotion', () => {
  const source = readFileSync(new URL('../../.github/workflows/deploy-frontend.yml', import.meta.url), 'utf8');
  assert(!/^      VERCEL_TOKEN:/m.test(source));
  assert(!source.includes('--token'));
  assert(source.includes('persist-credentials: false'));
  assert(source.includes('deploy --prebuilt --prod --skip-domain'));
  assert(source.indexOf('node local-tools/ci/staged-release.mjs') < source.indexOf('vercel promote'));
  assert(source.indexOf('npm install --prefix') < source.indexOf('vercel pull'));
  const actions = [...source.matchAll(/uses: ([^\s]+)/g)].map(match => match[1]);
  for (const action of actions) assert(action.startsWith('./') || /@[a-f0-9]{40}$/.test(action), action);
});
