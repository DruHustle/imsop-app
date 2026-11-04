import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function httpsOrigin(value, name) {
  assert(typeof value === 'string' && value.trim() === value && value, `${name} is required`);
  const url = new URL(value);
  assert(url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password,
    `${name} must be an HTTPS origin without credentials, path, query or fragment`);
  return url.origin;
}

export function releaseConfig(env) {
  assert.equal(env.GITHUB_REPOSITORY, 'DruHustle/imsop-app', 'Use the consolidated repository');
  assert.equal(env.GITHUB_REF, 'refs/heads/main', 'Only main may publish production');
  assert(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || ''), 'An exact consolidated source revision is required');
  assert(/^\d+\.\d+\.\d+$/.test(env.VERCEL_CLI_VERSION || ''), 'Set VERCEL_CLI_VERSION to an approved exact x.y.z release');
  for (const name of ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID']) {
    assert(typeof env[name] === 'string' && env[name].trim(), `${name} is required in the consolidated production environment`);
  }
  return {
    repository: env.GITHUB_REPOSITORY,
    revision: env.GITHUB_SHA,
    apiOrigin: httpsOrigin(env.IMSOP_API_ORIGIN, 'IMSOP_API_ORIGIN'),
    webOrigin: httpsOrigin(env.IMSOP_WEB_ORIGIN, 'IMSOP_WEB_ORIGIN'),
    cliVersion: env.VERCEL_CLI_VERSION,
  };
}

export function verifyVercelProject(project, env) {
  assert.equal(project.orgId, env.VERCEL_ORG_ID, 'The pulled Vercel organization differs from the configured one');
  assert.equal(project.projectId, env.VERCEL_PROJECT_ID, 'The pulled Vercel project differs from the configured one');
  assert.equal(project.settings?.rootDirectory, 'imsop-app-frontend',
    'Set the existing Vercel project Root Directory to imsop-app-frontend before using the monorepo workflow');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = releaseConfig(process.env);
    if (process.argv[2]) verifyVercelProject(JSON.parse(await readFile(process.argv[2], 'utf8')), process.env);
    // Never serialize the environment, token or pulled project configuration.
    console.log(JSON.stringify(config));
  } catch (error) {
    console.error(`Release preflight failed: ${error.message}`);
    process.exitCode = 1;
  }
}
