import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { pnpmVersion } from './local-checks.mjs';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('local validation, both package roots and hosted entrypoints use one reviewed pnpm version', () => {
  for (const path of ['smart-logistics-frontend/package.json', 'smart-logistics-backend/server/package.json']) {
    const { packageManager } = JSON.parse(read(path));
    const version = /^pnpm@(\d+\.\d+\.\d+)(?:\+sha512\.[a-f0-9]+)?$/.exec(packageManager ?? '');
    assert.equal(version?.[1], pnpmVersion, `${path} packageManager differs from local validation`);
  }
  let setupCount = 0;
  for (const filename of readdirSync(new URL('../../.github/workflows/', import.meta.url)).filter(name => /\.ya?ml$/.test(name))) {
    const path = `.github/workflows/${filename}`;
    const source = read(path);
    const actions = source.match(/uses: pnpm\/action-setup@/g) ?? [];
    const pins = [...source.matchAll(/uses: pnpm\/action-setup@[^\n]+\n\s+with:\n\s+version:\s*([^\s]+)/g)];
    setupCount += actions.length;
    assert.equal(pins.length, actions.length, `${path} has an unreviewed package-manager setup`);
    for (const [, version] of pins) assert.equal(version, pnpmVersion, `${path} differs from the committed local pin`);
  }
  assert(setupCount > 0, 'hosted entrypoints must explicitly prepare pnpm');
});
