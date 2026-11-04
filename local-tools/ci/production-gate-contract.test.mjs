import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../../.github/workflows/deploy-frontend.yml', import.meta.url), 'utf8');
const steps = workflow.split(/\n      - /);
const step = name => {
  const result = steps.find(value => value.startsWith(`name: ${name}\n`));
  assert(result, `Missing step: ${name}`);
  return result;
};

test('production origin must pass before staging and again before promotion', () => {
  const first = step('Require the actual production Origin before staging');
  const second = step('Recheck backend immediately before promotion');
  for (const value of [first, second]) {
    assert(value.includes('--web-origin "$IMSOP_WEB_ORIGIN"'));
    assert(value.includes('--api-origin "$IMSOP_API_ORIGIN"'));
    assert(value.includes('--revision "$GITHUB_SHA" --enforce-api'));
    assert(!value.includes('VERCEL_TOKEN'));
    assert(!value.includes('BYPASS'));
    assert(!value.includes('continue-on-error'));
  }
  assert(workflow.indexOf(first) < workflow.indexOf('name: Stage production without changing live domains'));
  assert(workflow.indexOf(second) < workflow.indexOf('name: Promote only the verified staged production deployment'));
});

test('post-promotion verification enforces the full public release, not API-only checks', () => {
  const value = step('Verify exact public release and first-party API without protection bypass');
  assert(value.includes('--revision "$GITHUB_SHA" --enforce --out'));
  assert(!value.includes('--enforce-api'));
  assert(!value.includes('BYPASS'));
});
