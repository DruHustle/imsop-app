#!/usr/bin/env node
// Voluntary local guard, not a GitHub check receipt or an untrusted-code sandbox.
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checkerPath = 'local-tools/ci/local-checks.mjs';
const hook = `#!/bin/sh
# Smart Logistics exact-commit source preflight, version 1.
set -eu
root=$(git rev-parse --show-toplevel)
if [ ! -f "$root/local-tools/ci/pre-push.mjs" ]; then
  printf '%s\\n' 'Local pre-push validator is absent from this checkout; push refused.' >&2
  exit 1
fi
exec node "$root/local-tools/ci/pre-push.mjs" run "$@"
`;

export function cleanGitEnvironment(environment = process.env) {
  return { ...Object.fromEntries(Object.entries(environment).filter(([name]) => !name.startsWith('GIT_'))), GIT_NO_REPLACE_OBJECTS: '1' };
}

function git(directory, args) {
  const result = spawnSync('git', ['--no-replace-objects', '-c', 'core.hooksPath=/dev/null', ...args], {
    cwd: directory, env: cleanGitEnvironment(), encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error('Git could not prepare the exact pushed commit. No source checks passed.');
  return result.stdout.trim();
}

export function parseUpdates(input, objectLength = 40) {
  if (Buffer.byteLength(input) > 1024 * 1024) throw new Error('Pre-push input is too large.');
  const oid = new RegExp(`^[a-f0-9]{${objectLength}}$`);
  const zero = '0'.repeat(objectLength);
  const updates = [];
  for (const line of input.split('\n')) {
    if (line === '') continue;
    const fields = line.split(' ');
    if (fields.length !== 4 || fields.some(field => !field || /\s/.test(field))) throw new Error('Malformed Git pre-push input.');
    const [localRef, localOid, remoteRef, remoteOid] = fields;
    if (!oid.test(localOid) || !oid.test(remoteOid) || !remoteRef.startsWith('refs/') || remoteRef.includes('..')) throw new Error('Malformed Git pre-push input.');
    if (localOid === zero) {
      if (localRef !== '(delete)' || remoteOid === zero) throw new Error('Malformed Git deletion update.');
      continue;
    }
    if (localRef === '(delete)') throw new Error('Malformed Git deletion update.');
    updates.push({ localOid, remoteRef });
  }
  return updates;
}

export function validatePush(directory, input, validate) {
  const format = git(directory, ['rev-parse', '--show-object-format']);
  if (!['sha1', 'sha256'].includes(format)) throw new Error('Unsupported Git object format.');
  const updates = parseUpdates(input, format === 'sha1' ? 40 : 64);
  if (updates.length === 0) return [];
  if (git(directory, ['rev-parse', '--is-shallow-repository']) !== 'false') {
    throw new Error('Use a full-history clone before validating a push; the hook never fetches or rewrites history.');
  }
  const commits = [...new Set(updates.map(({ localOid }) => git(directory, ['rev-parse', '--verify', '--end-of-options', `${localOid}^{commit}`])))];
  for (const commit of commits) {
    const temporary = mkdtempSync(resolve(tmpdir(), 'smart-logistics-pre-push-'));
    const checkout = resolve(temporary, 'checkout');
    let added = false;
    try {
      git(directory, ['worktree', 'add', '--quiet', '--detach', checkout, commit]);
      added = true;
      if (git(checkout, ['rev-parse', 'HEAD']) !== commit) throw new Error('Detached checkout did not match the pushed commit.');
      const checker = resolve(checkout, checkerPath);
      try {
        if (!lstatSync(checker).isFile()) throw new Error('not regular');
      } catch {
        throw new Error('The pushed commit has no regular local source-check entry point; push refused.');
      }
      console.log(`Checking pushed commit ${commit} in a separate temporary worktree.`);
      if (validate) {
        // Dependency injection is only an import-level test seam, never a CLI bypass.
        validate(checkout, commit);
      } else {
        const result = spawnSync(process.execPath, [checker, 'all'], {
          cwd: checkout, env: cleanGitEnvironment(), stdio: 'inherit',
        });
        if (result.error || result.status !== 0) throw new Error(`Source preflight failed for ${commit}; push refused.`);
      }
    } finally {
      if (added) git(directory, ['worktree', 'remove', '--force', checkout]);
      rmSync(temporary, { recursive: true, force: true });
    }
  }
  return commits;
}

export function installHook(directory, remove = false) {
  // Do not change core.hooksPath or touch shared/custom hooks. Read without the
  // temporary hook override used for all other Git calls in this module.
  const configured = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
    cwd: directory, env: cleanGitEnvironment(), encoding: 'utf8',
  });
  if (configured.error || ![0, 1].includes(configured.status)) throw new Error('Cannot inspect the existing hook configuration.');
  if (configured.status === 0) throw new Error('core.hooksPath is already configured. Preserve it and deliberately chain the validator from your existing pre-push hook; no configuration was changed.');
  const common = realpathSync(resolve(directory, git(directory, ['rev-parse', '--git-common-dir'])));
  const current = realpathSync(resolve(directory, git(directory, ['rev-parse', '--git-dir'])));
  // Default hooks outlive a linked checkout and affect every worktree in the
  // clone. Manage them only from the primary checkout, never a temporary one.
  if (current !== common) {
    throw new Error('Install or remove the hook from the primary checkout; linked worktrees share its Git hooks. No hook was changed.');
  }
  const path = resolve(common, 'hooks/pre-push');
  const hooksDirectory = dirname(path);
  // Check the parent before either reading or removing a hook. A symlinked
  // default hooks directory may belong to a different clone or hook manager.
  try {
    if (!lstatSync(hooksDirectory).isDirectory()) throw new Error('The default hooks directory must be a regular directory; shared hooks were preserved.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (remove) return 'No generated pre-push hook is installed.';
    mkdirSync(hooksDirectory);
  }
  let existing;
  try { existing = lstatSync(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing) {
    if (!existing.isFile() || readFileSync(path, 'utf8') !== hook || !(existing.mode & 0o111)) {
      throw new Error('An existing pre-push hook was preserved. Deliberately chain this validator; no hook was overwritten.');
    }
    if (remove) unlinkSync(path);
    return remove ? 'Removed only the unchanged generated pre-push hook.' : 'The exact generated pre-push hook is already installed.';
  }
  if (remove) return 'No generated pre-push hook is installed.';
  writeFileSync(path, hook, { flag: 'wx', mode: 0o755 });
  return 'Installed the local pre-push hook for this clone. Hosted checks and branch protections remain required.';
}

export function main(args) {
  const directory = git(process.cwd(), ['rev-parse', '--show-toplevel']);
  if (args.length === 1 && ['install', 'uninstall'].includes(args[0])) {
    console.log(installHook(directory, args[0] === 'uninstall'));
  } else if (args[0] === 'run' && args.length === 3) {
    const commits = validatePush(directory, readFileSync(0, 'utf8'));
    console.log(commits.length ? 'All pushed ref tips passed local source preflight; GitHub qualification still runs independently.' : 'No non-deleted ref tips to validate.');
  } else if (args[0] === 'check' && args.length === 2) {
    const commit = git(directory, ['rev-parse', '--verify', '--end-of-options', `${args[1]}^{commit}`]);
    validatePush(directory, `HEAD ${commit} refs/heads/local-source-check ${'0'.repeat(commit.length)}\n`);
  } else {
    throw new Error('Usage: node local-tools/ci/pre-push.mjs install|uninstall|check <commit> (run is reserved for Git).');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
