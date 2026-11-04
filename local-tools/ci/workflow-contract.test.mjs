import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = name => readFileSync(resolve(root, name), 'utf8');
test('active workflows have no legacy repository fetch or checkout dependency', () => {
  for (const file of readdirSync(resolve(root, '.github/workflows'))) {
    const source = read(`.github/workflows/${file}`);
    assert(!/DruHustle\/imsop-app-(frontend|backend)/.test(source), file);
    assert(!/git ls-remote/.test(source), file);
    assert(!/^\s+repository:\s/m.test(source), file);
  }
});
test('both system suites are active and use the consolidated source', () => {
  assert(read('.github/workflows/ci.yml').includes('uses: ./.github/workflows/system-qualification.yml'));
  const system = read('.github/workflows/system-qualification.yml');
  for (const suite of ['system/security.test.ts', 'system/gateway.test.ts', 'system/completion.test.ts', 'system/mutation-check.mjs', 'system/production-boot-check.sh', 'scripts/restore-drill.sh', 'playwright.system.config.ts']) {
    assert(system.includes(suite), suite);
  }
  assert.equal((system.match(/APP_REVISION="\$GITHUB_SHA"/g) || []).length, 2);
});
test('publication requalifies the same source and never floats a production image tag', () => {
  for (const file of ['deploy-frontend.yml', 'publish-backend.yml']) {
    const source = read(`.github/workflows/${file}`);
    assert(source.includes('uses: ./.github/workflows/ci.yml'));
    assert(source.includes('workflow_dispatch:'));
    assert(!/^  push:/m.test(source));
    assert(source.includes('cancel-in-progress: false'));
  }
  const frontend = read('.github/workflows/deploy-frontend.yml');
  assert(frontend.includes('--api-only "$IMSOP_API_ORIGIN" "$GITHUB_SHA"'));
  assert(frontend.includes('"$IMSOP_WEB_ORIGIN" "$GITHUB_SHA" "$GITHUB_SHA"'));
  assert(frontend.indexOf('release-config.mjs .vercel/project.json') < frontend.indexOf('build --prod'));
  assert(!read('.github/workflows/publish-backend.yml').includes(':latest'));
});
test('frontend deployment command dispatches only the consolidated workflow', () => {
  const source = read('imsop-app-frontend/deploy.sh');
  assert(source.includes('gh workflow run deploy-frontend.yml --ref main --repo DruHustle/imsop-app\n'));
  assert(!source.includes('imsop-app-frontend\n'));
});
test('inactive component workflows are removed, not mistaken for active CI', () => {
  for (const component of ['frontend', 'backend']) {
    const path = resolve(root, `imsop-app-${component}/.github/workflows`);
    assert(!existsSync(path) || readdirSync(path).length === 0);
  }
});
