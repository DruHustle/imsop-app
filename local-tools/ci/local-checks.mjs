#!/usr/bin/env node
// Portable source preflight shared by local Git hooks and hosted qualification.
// PostgreSQL/gateway/restore and real-browser qualification remain hosted jobs.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const suites = ['release-boundaries', 'frontend', 'backend-node', 'backend-dotnet'];
export const pnpmVersion = '10.34.5';
const frontend = 'smart-logistics-frontend';
const backend = 'smart-logistics-backend';
const server = `${backend}/server`;

export function run(command, cwd, env = process.env, quiet = false) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd, env, encoding: 'utf8', stdio: quiet ? 'pipe' : 'inherit',
    timeout: 20 * 60 * 1000, maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    // Do not echo environment values or captured package-manager output here.
    throw new Error(`${command[0]} failed${result.error?.code === 'ENOENT' ? ': required tool is missing' : ''}${result.signal ? ` (${result.signal})` : ''}. Local source preflight did not pass.`);
  }
  return result.stdout?.trim();
}

export function commandsFor(suite, directory = root) {
  const pnpm = (...args) => ['corepack', 'pnpm', ...args];
  const step = (cwd, command, env = {}) => ({ cwd, command, env });
  const install = cwd => step(cwd, pnpm('install', '--frozen-lockfile'));
  switch (suite) {
    case 'frontend': return [
      install(frontend),
      step(frontend, pnpm('exec', 'tsc', '--noEmit')),
      step(frontend, pnpm('build'), { VITE_BASE_PATH: '/' }),
      step(frontend, pnpm('test')),
      step(frontend, pnpm('audit', '--prod', '--audit-level=moderate')),
      step(frontend, pnpm('audit', '--audit-level=high')),
    ];
    case 'backend-node': return [
      install(server),
      step(server, pnpm('build')),
      step(server, pnpm('test')),
      step(`${backend}/edge`, ['python3', '-m', 'unittest', 'discover', '-s', '.', '-p', 'test_*.py', '-v']),
      step(server, ['node', '--check', '../edge/node-red/settings.js']),
      step(server, ['python3', '-m', 'json.tool', '../edge/node-red/flows.example.json', '/dev/null']),
      step(server, pnpm('audit', '--prod', '--audit-level=low')),
      step(backend, ['python3', '-m', 'unittest', 'discover', '-s', 'scripts', '-p', 'test_image_retention.py', '-v']),
      step(backend, ['python3', 'scripts/test_onesa_migration_config.py', '--require-compose']),
      step(backend, ['python3', '-m', 'unittest', 'discover', '-s', 'scripts', '-p', 'test_logistics_ingress.py', '-v']),
    ];
    case 'backend-dotnet': return [
      step(backend, ['dotnet', 'restore', 'src/SmartLogistics.sln', '-p:NuGetAudit=true', '-p:NuGetAuditMode=all', '-warnaserror:NU1901,NU1902,NU1903,NU1904']),
      step(backend, ['dotnet', 'build', 'src/SmartLogistics.sln', '--no-restore', '--configuration', 'Release']),
      step(backend, ['dotnet', 'test', 'src/SmartLogistics.sln', '--no-build', '--configuration', 'Release', '--verbosity', 'normal']),
    ];
    case 'release-boundaries': return [
      step('.', ['node', '--test', ...readdirSync(resolve(directory, 'local-tools/ci')).filter(name => name.endsWith('.test.mjs')).sort().map(name => `local-tools/ci/${name}`)]),
      step('.', ['bash', '-n', `${frontend}/deploy.sh`]),
    ];
    default: throw new Error('Unknown local source-check suite.');
  }
}

export function checkPrerequisites(selected, directory = root, execute = run) {
  if (!['linux', 'darwin'].includes(process.platform) || !['x64', 'arm64'].includes(process.arch)) {
    throw new Error('Local source preflight supports Linux/macOS on x64/ARM64. Hosted Linux qualification is still required.');
  }
  const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
  if (nodeMajor !== 22 || nodeMinor < 12) throw new Error('Use Node.js 22.12 or newer in the 22.x release line, matching the repository workflow.');
  const childNode = /^v22\.(\d+)\.\d+$/.exec(execute(['node', '--version'], directory, process.env, true));
  if (!childNode || Number(childNode[1]) < 12) {
    throw new Error('Put Node.js 22.12 or newer in the 22.x release line on PATH so child commands use the same project runtime.');
  }
  for (const [suite, cwd] of [['frontend', frontend], ['backend-node', server]]) {
    if (!selected.includes(suite)) continue;
    const metadata = JSON.parse(readFileSync(resolve(directory, cwd, 'package.json'), 'utf8'));
    const committedPin = /^pnpm@(\d+\.\d+\.\d+)(?:\+sha512\.[a-f0-9]+)?$/.exec(metadata.packageManager ?? '');
    if (committedPin?.[1] !== pnpmVersion) {
      throw new Error('The committed package-manager pin changed; review local and hosted tooling together.');
    }
    if (execute(['corepack', 'pnpm', '--version'], resolve(directory, cwd), process.env, true) !== pnpmVersion) {
      throw new Error(`Corepack must resolve the committed pnpm ${pnpmVersion} pin.`);
    }
  }
  if (selected.includes('backend-node')) {
    execute(['python3', '-c', 'import sys; assert sys.version_info >= (3, 10), "Python 3.10+ is required"'], directory, process.env, true);
    execute(['docker', 'compose', 'version'], directory, process.env, true);
  }
  if (selected.includes('backend-dotnet') && !/^8\.0\./.test(execute(['dotnet', '--version'], resolve(directory, backend), process.env, true))) {
    throw new Error('Install .NET SDK 8; the committed global.json selects its latest installed stable feature band.');
  }
  if (selected.includes('release-boundaries')) execute(['bash', '--version'], directory, process.env, true);
}

export function main(args) {
  if (args.length !== 1 || ![...suites, 'all'].includes(args[0])) {
    throw new Error(`Usage: node local-tools/ci/local-checks.mjs <all|${suites.join('|')}>`);
  }
  const selected = args[0] === 'all' ? suites : args;
  // Check every prerequisite before doing any install or running any tests.
  checkPrerequisites(selected);
  for (const suite of selected) {
    console.log(`Local/hosted source checks: ${suite}`);
    for (const step of commandsFor(suite)) run(step.command, resolve(root, step.cwd), { ...process.env, ...step.env });
  }
  console.log('Selected source checks passed. Hosted browser, PostgreSQL/gateway, restore and release qualification are still required.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
