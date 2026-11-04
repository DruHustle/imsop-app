import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { releaseConfig } from './release-config.mjs';
import { verifyLiveRelease } from '../../imsop-app-frontend/scripts/verify-live-release.mjs';

export function stagedOrigin(value) {
  const url = new URL(value);
  assert(url.origin === value && url.protocol === 'https:' && !url.port &&
    /^[a-z0-9][a-z0-9-]*\.vercel\.app$/.test(url.hostname),
  'Expected a direct HTTPS deployment origin without credentials, path, query or fragment');
  return url;
}

export async function verifyStagedRelease(value, env) {
  const config = releaseConfig(env);
  const origin = stagedOrigin(value);
  // Confirm ownership before sending the project protection secret to any deployment.
  const metadataUrl = new URL(`https://api.vercel.com/v13/deployments/${origin.hostname}`);
  metadataUrl.searchParams.set('teamId', env.VERCEL_ORG_ID);
  const response = await fetch(metadataUrl, {
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}`, Accept: 'application/json' },
  });
  assert(response.ok, `Deployment ownership check: HTTP ${response.status}`);
  const deployment = await response.json();
  assert.equal(deployment.projectId, env.VERCEL_PROJECT_ID, 'Staged deployment belongs to a different project');
  assert.equal(deployment.url, origin.hostname, 'Staged deployment hostname differs from its metadata');
  assert.equal(deployment.target, 'production', 'Only a staged production build may be promoted');
  assert.equal(deployment.readyState, 'READY', 'Staged production build is not ready');
  assert.equal(deployment.meta?.imsopSourceRevision, config.revision, 'Staged source revision differs');
  assert.equal(deployment.meta?.imsopRepository, config.repository, 'Staged source repository differs');
  assert(/^dpl_[A-Za-z0-9]+$/.test(deployment.id || ''), 'Invalid staged deployment identity');
  const smoke = await verifyLiveRelease(origin.origin, config.revision, config.revision, {
    protectionBypass: env.VERCEL_AUTOMATION_BYPASS_SECRET || undefined,
  });
  return { ...smoke, deploymentId: deployment.id, projectId: deployment.projectId, target: deployment.target };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await verifyStagedRelease(process.argv[2], process.env)));
  } catch {
    // Metadata/network errors may contain confidential provider context. Do not serialize them.
    console.error('Staged release verification failed; check project identity, exact revision, readiness and protected-deployment access. Production was not promoted.');
    process.exitCode = 1;
  }
}
