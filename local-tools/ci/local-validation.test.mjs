import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { cleanGitEnvironment, installHook, parseUpdates, validatePush } from './pre-push.mjs';
import { run } from './local-checks.mjs';

const zero = '0'.repeat(40);
const git = (directory, ...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
  cwd: directory, env: cleanGitEnvironment(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const update = (commit, remote = 'refs/heads/main') => `HEAD ${commit} ${remote} ${zero}\n`;

function repository(t, checker = 'process.exit(0);\n') {
  const directory = mkdtempSync(resolve(tmpdir(), 'logistics-hook-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  git(directory, 'init', '-q');
  git(directory, 'config', 'user.email', 'local-test@example.invalid');
  git(directory, 'config', 'user.name', 'Local test');
  mkdirSync(resolve(directory, 'local-tools/ci'), { recursive: true });
  writeFileSync(resolve(directory, 'local-tools/ci/local-checks.mjs'), checker);
  writeFileSync(resolve(directory, 'value.txt'), 'first committed value\n');
  git(directory, 'add', '.');
  git(directory, 'commit', '-qm', 'first');
  return directory;
}

test('pre-push input handles new, updated and deleted refs and rejects malformed input', () => {
  const a = 'a'.repeat(40), b = 'b'.repeat(40);
  assert.deepEqual(parseUpdates(`refs/heads/feature ${a} refs/heads/feature ${b}\n(delete) ${zero} refs/heads/old ${b}\n`), [{ localOid: a, remoteRef: 'refs/heads/feature' }]);
  assert.equal(parseUpdates(`HEAD ${'c'.repeat(64)} refs/heads/main ${'0'.repeat(64)}\n`, 64).length, 1);
  for (const input of [`HEAD ${a} refs/heads/main\n`, `HEAD ${zero} refs/heads/main ${b}\n`, `(delete) ${a} refs/heads/main ${b}\n`, `HEAD ${a} refs/heads/main ${b} extra\n`, `HEAD ${a} refs/heads/../main ${b}\n`, `HEAD ${a}\trefs/heads/main ${b}\n`]) {
    assert.throws(() => parseUpdates(input), /Malformed/);
  }
});

test('checks the pushed tip rather than HEAD, staged, dirty or untracked files', t => {
  const directory = repository(t);
  const first = git(directory, 'rev-parse', 'HEAD');
  writeFileSync(resolve(directory, 'value.txt'), 'second committed value\n');
  git(directory, 'commit', '-qam', 'second');
  const head = git(directory, 'rev-parse', 'HEAD');
  writeFileSync(resolve(directory, 'value.txt'), 'staged value\n');
  git(directory, 'add', 'value.txt');
  writeFileSync(resolve(directory, 'value.txt'), 'dirty value\n');
  writeFileSync(resolve(directory, 'private-untracked.txt'), 'must not enter validation\n');
  const before = git(directory, 'status', '--porcelain=v1');
  const index = git(directory, 'write-tree');
  const worktrees = git(directory, 'worktree', 'list', '--porcelain');
  const result = validatePush(directory, update(first), (checkout, commit) => {
    assert.equal(commit, first);
    assert.equal(readFileSync(resolve(checkout, 'value.txt'), 'utf8'), 'first committed value\n');
    assert(!existsSync(resolve(checkout, 'private-untracked.txt')));
    assert.equal(git(checkout, 'rev-list', '--count', head), '2');
  });
  assert.deepEqual(result, [first]);
  assert.equal(git(directory, 'rev-parse', 'HEAD'), head);
  assert.equal(git(directory, 'status', '--porcelain=v1'), before);
  assert.equal(git(directory, 'write-tree'), index);
  assert.equal(git(directory, 'worktree', 'list', '--porcelain'), worktrees);
});

test('checks all distinct pushed commits, peels annotated tags and ignores deletions', t => {
  const directory = repository(t);
  const first = git(directory, 'rev-parse', 'HEAD');
  git(directory, 'tag', '-a', 'reviewed', '-m', 'reviewed');
  const tag = git(directory, 'rev-parse', 'refs/tags/reviewed');
  writeFileSync(resolve(directory, 'value.txt'), 'second\n');
  git(directory, 'commit', '-qam', 'second');
  const second = git(directory, 'rev-parse', 'HEAD');
  const observed = [];
  validatePush(directory, update(first) + update(tag, 'refs/tags/reviewed') + update(second, 'refs/heads/feature') + `(delete) ${zero} refs/heads/old ${first}\n`, (_, commit) => observed.push(commit));
  assert.deepEqual(observed, [first, second]);
  assert.deepEqual(validatePush(directory, `(delete) ${zero} refs/heads/old ${first}\n`, () => assert.fail('deletion ran checks')), []);
});

test('a failed actual checker refuses the push and removes only its temporary worktree', t => {
  const directory = repository(t, 'process.exit(19);\n');
  const worktrees = git(directory, 'worktree', 'list', '--porcelain');
  assert.throws(() => validatePush(directory, update(git(directory, 'rev-parse', 'HEAD'))), /Source preflight failed/);
  assert.equal(git(directory, 'worktree', 'list', '--porcelain'), worktrees);
  assert.equal(git(directory, 'status', '--porcelain=v1'), '');
});

test('replacement refs cannot substitute an easier tree for the pushed object', t => {
  const directory = repository(t);
  const first = git(directory, 'rev-parse', 'HEAD');
  writeFileSync(resolve(directory, 'value.txt'), 'replacement tree\n');
  git(directory, 'commit', '-qam', 'replacement');
  const second = git(directory, 'rev-parse', 'HEAD');
  git(directory, 'replace', first, second);
  validatePush(directory, update(first), checkout => {
    assert.equal(readFileSync(resolve(checkout, 'value.txt'), 'utf8'), 'first committed value\n');
  });
  assert.equal(git(directory, 'rev-parse', `refs/replace/${first}`), second);
});

test('exported Git worktree/index variables cannot redirect validation or change the user index', t => {
  const directory = repository(t);
  const commit = git(directory, 'rev-parse', 'HEAD');
  const index = git(directory, 'write-tree');
  const keys = ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) process.env[key] = '/nonexistent-foreign-git-state';
    validatePush(directory, update(commit), checkout => assert.equal(git(checkout, 'rev-parse', 'HEAD'), commit));
  } finally {
    for (const key of keys) original[key] === undefined ? delete process.env[key] : process.env[key] = original[key];
  }
  assert.equal(git(directory, 'write-tree'), index);
});

test('shallow history, non-commit tags and missing committed checkers fail closed', t => {
  const directory = repository(t);
  const shallow = resolve(directory, 'shallow');
  git(directory, 'clone', '--quiet', '--depth=1', `file://${directory}`, shallow);
  assert.throws(() => validatePush(shallow, update(git(shallow, 'rev-parse', 'HEAD'))), /full-history/);
  const blob = git(directory, 'rev-parse', 'HEAD:value.txt');
  assert.throws(() => validatePush(directory, update(blob, 'refs/tags/blob')), /Git could not prepare/);
  rmSync(resolve(directory, 'local-tools/ci/local-checks.mjs'));
  git(directory, 'add', '-u');
  git(directory, 'commit', '-qm', 'missing checker');
  assert.throws(() => validatePush(directory, update(git(directory, 'rev-parse', 'HEAD'))), /no regular local source-check/);
});

test('installation is opt-in, idempotent, executable and removable only when unchanged', t => {
  const directory = repository(t);
  const path = resolve(directory, '.git/hooks/pre-push');
  assert(!existsSync(path));
  assert.match(installHook(directory), /Installed/);
  const source = readFileSync(path, 'utf8');
  assert(lstatSync(path).mode & 0o111);
  assert.match(installHook(directory), /already installed/);
  writeFileSync(path, source + '# user addition\n');
  assert.throws(() => installHook(directory, true), /preserved/);
  assert.equal(readFileSync(path, 'utf8'), source + '# user addition\n');
  writeFileSync(path, source);
  assert.match(installHook(directory, true), /Removed only/);
  assert(!existsSync(path));
});

test('existing hooks, hook symlinks and custom hook configurations are preserved', t => {
  const directory = repository(t);
  const path = resolve(directory, '.git/hooks/pre-push');
  writeFileSync(path, '#!/bin/sh\nexit 17\n');
  chmodSync(path, 0o700);
  assert.throws(() => installHook(directory), /preserved/);
  assert.equal(readFileSync(path, 'utf8'), '#!/bin/sh\nexit 17\n');
  assert.equal(lstatSync(path).mode & 0o777, 0o700);
  rmSync(path);
  symlinkSync('/nonexistent-personal-hook', path);
  assert.throws(() => installHook(directory), /preserved/);
  assert(lstatSync(path).isSymbolicLink());
  rmSync(path);
  // The helper used for fixture Git calls intentionally overrides hooks, so set
  // the actual config with a direct command before testing the installer.
  execFileSync('git', ['config', 'core.hooksPath', 'personal-hooks'], { cwd: directory, env: cleanGitEnvironment() });
  assert.throws(() => installHook(directory), /core.hooksPath is already configured/);
  assert(!existsSync(path));
  assert.equal(execFileSync('git', ['config', '--get', 'core.hooksPath'], { cwd: directory, env: cleanGitEnvironment(), encoding: 'utf8' }).trim(), 'personal-hooks');
});

test('a symlinked parent hooks directory is preserved on both install and uninstall', t => {
  const directory = repository(t);
  installHook(directory);
  const source = readFileSync(resolve(directory, '.git/hooks/pre-push'), 'utf8');
  const shared = resolve(directory, 'shared-personal-hooks');
  mkdirSync(shared);
  const sharedHook = resolve(shared, 'pre-push');
  writeFileSync(sharedHook, source, { mode: 0o755 });
  rmSync(resolve(directory, '.git/hooks'), { recursive: true });
  symlinkSync(shared, resolve(directory, '.git/hooks'));
  assert.throws(() => installHook(directory), /shared hooks were preserved/);
  assert.throws(() => installHook(directory, true), /shared hooks were preserved/);
  assert.equal(readFileSync(sharedHook, 'utf8'), source);
  assert(lstatSync(resolve(directory, '.git/hooks')).isSymbolicLink());
});

test('worktree-specific hook configuration is honored without changing shared state', t => {
  const directory = repository(t);
  git(directory, 'config', 'extensions.worktreeConfig', 'true');
  const linked = resolve(directory, 'linked');
  git(directory, 'worktree', 'add', '--quiet', '--detach', linked, 'HEAD');
  execFileSync('git', ['config', '--worktree', 'core.hooksPath', 'personal-linked-hooks'], { cwd: linked, env: cleanGitEnvironment() });
  assert.throws(() => installHook(linked), /core.hooksPath is already configured/);
  assert(!existsSync(resolve(directory, '.git/hooks/pre-push')));
  assert.equal(execFileSync('git', ['config', '--get', 'core.hooksPath'], { cwd: linked, env: cleanGitEnvironment(), encoding: 'utf8' }).trim(), 'personal-linked-hooks');
  git(directory, 'worktree', 'remove', '--force', linked);
});

test('the installed hook refuses a failing local push and transmits a passing one', t => {
  const directory = repository(t, 'process.exit(19);\n');
  writeFileSync(resolve(directory, 'local-tools/ci/pre-push.mjs'), readFileSync(new URL('./pre-push.mjs', import.meta.url)));
  git(directory, 'add', '.');
  git(directory, 'commit', '-qm', 'include hook driver');
  const bare = resolve(directory, 'remote.git');
  git(directory, 'init', '--bare', '--quiet', bare);
  installHook(directory);
  assert.throws(() => execFileSync('git', ['push', bare, 'HEAD:refs/heads/main'], { cwd: directory, env: cleanGitEnvironment(), stdio: 'pipe' }), /Command failed/);
  assert.equal(git(bare, 'for-each-ref', '--format=%(refname)'), '');
  assert.equal(git(directory, 'worktree', 'list', '--porcelain').split('\n').filter(line => line.startsWith('worktree ')).length, 1);
  writeFileSync(resolve(directory, 'local-tools/ci/local-checks.mjs'), 'process.exit(0);\n');
  git(directory, 'add', 'local-tools/ci/local-checks.mjs');
  git(directory, 'commit', '-qm', 'passing checker');
  execFileSync('git', ['push', bare, 'HEAD:refs/heads/main'], { cwd: directory, env: cleanGitEnvironment(), stdio: 'pipe' });
  assert.equal(git(bare, 'rev-parse', 'refs/heads/main'), git(directory, 'rev-parse', 'HEAD'));
});

test('a missing command is a failing prerequisite, never a skipped passing check', () => {
  assert.throws(() => run(['logistics-test-tool-that-does-not-exist'], tmpdir(), process.env, true), /required tool is missing/);
});

test('automatic CI avoids feature-push duplicates while retaining every qualification entry', () => {
  const source = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(source, /push:\n\s+branches: \[dev, staging, main\]/);
  assert.match(source, /\n  pull_request:\n  workflow_dispatch:\n  workflow_call:/);
  assert(!/\n\s+paths(?:-ignore)?:/.test(source));
  for (const job of ['frontend', 'backend-node', 'backend-dotnet', 'release-boundaries', 'qualify-system']) assert.match(source, new RegExp(`\n  ${job}:\n`));
  for (const suite of ['frontend', 'backend-node', 'backend-dotnet', 'release-boundaries']) assert(source.includes(`node local-tools/ci/local-checks.mjs ${suite}`));
  assert(source.includes("cancel-in-progress: ${{ github.event_name == 'push' || github.event_name == 'pull_request' }}"));
  assert(source.includes("(github.event_name != 'push' && github.event_name != 'pull_request') && github.run_id"));
  assert(source.includes('uses: ./.github/workflows/system-qualification.yml'));
  assert(!source.includes('self-hosted'));
});
