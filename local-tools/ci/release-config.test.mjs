import assert from 'node:assert/strict';
import test from 'node:test';
import { httpsOrigin, releaseConfig, verifyVercelProject } from './release-config.mjs';

const env = {
  GITHUB_REPOSITORY: 'DruHustle/smart-logistics', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: 'a'.repeat(40),
  VERCEL_CLI_VERSION: '1.2.3', VERCEL_TOKEN: 'test-secret-never-output', VERCEL_ORG_ID: 'test-org',
  VERCEL_PROJECT_ID: 'test-project', SMART_LOGISTICS_API_ORIGIN: 'https://api.example.test', SMART_LOGISTICS_WEB_ORIGIN: 'https://logistics.example.test',
};
test('release identity and origins are explicit; credentials never enter receipt', () => {
  const result = releaseConfig(env);
  assert.equal(result.revision, env.GITHUB_SHA);
  assert.equal(result.webOrigin, env.SMART_LOGISTICS_WEB_ORIGIN);
  for (const value of [env.VERCEL_TOKEN, env.VERCEL_ORG_ID, env.VERCEL_PROJECT_ID]) {
    assert(!JSON.stringify(result).includes(value));
  }
});
test('wrong repository, branch and non-exact SHA fail closed', () => {
  for (const [key, value] of [['GITHUB_REPOSITORY', 'DruHustle/imsop-app-frontend'], ['GITHUB_REF', 'refs/heads/review'], ['GITHUB_SHA', 'main'], ['GITHUB_SHA', 'a'.repeat(39)]]) {
    assert.throws(() => releaseConfig({ ...env, [key]: value }));
  }
});
test('all deployment credentials and exact CLI version are required', () => {
  for (const key of ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID', 'VERCEL_CLI_VERSION', 'SMART_LOGISTICS_API_ORIGIN', 'SMART_LOGISTICS_WEB_ORIGIN']) {
    assert.throws(() => releaseConfig({ ...env, [key]: '' }));
  }
  for (const value of ['latest', '^1.2.3', '1.2.3; echo unsafe', '1.2.3-beta']) {
    assert.throws(() => releaseConfig({ ...env, VERCEL_CLI_VERSION: value }));
  }
});
test('origins reject insecure schemes, credentials and non-origin components', () => {
  for (const value of ['http://example.test', 'https://u:p@example.test', 'https://example.test/api', 'https://example.test/?token=x', 'https://example.test/#x', '', ' https://example.test']) {
    assert.throws(() => httpsOrigin(value, 'origin'));
  }
  assert.equal(httpsOrigin('https://example.test/', 'origin'), 'https://example.test');
});
test('project identity and monorepo root must match before building or deploying', () => {
  const project = { orgId: env.VERCEL_ORG_ID, projectId: env.VERCEL_PROJECT_ID, settings: { rootDirectory: 'smart-logistics-frontend' } };
  verifyVercelProject(project, env);
  for (const altered of [{ ...project, orgId: 'other' }, { ...project, projectId: 'other' }, { ...project, settings: {} }, { ...project, settings: { rootDirectory: '.' } }]) {
    assert.throws(() => verifyVercelProject(altered, env));
  }
});
