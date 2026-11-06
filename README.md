# Smart Logistics app

- `smart-logistics-frontend/` contains the responsive frontend.
- `smart-logistics-backend/` contains the Node API, .NET services and backend deployment tooling.
- `local-tools/` contains local tools, release evidence and consolidated release checks.

Both original Git histories are retained. The root workflows now qualify both applications from **one consolidated commit**, including PostgreSQL/gateway tests, browser workflows, dependency audits and a disposable database restore drill. Component `.github/workflows` directories have been removed; GitHub Actions only uses the root workflows.

See [consolidated release and retirement gates](docs/CONSOLIDATED_RELEASE.md) before publishing. The two manual root publication workflows replace component-repository dispatch and cross-repository `main` lookups. They do not install a backend on Oracle, migrate a database, change DNS, configure Vercel/Resend, or prove a production rollback.

**Production migration remains gated.** Keep `DruHustle/imsop-app-frontend` and `DruHustle/imsop-app-backend` intact until the consolidated deployment, authenticated acceptance, compatible rollback rehearsal and external dependency audit all have recorded passing evidence. A green source check or a published image is not that evidence.

Public website: **https://logistics.onesa.eu**. See [naming and compatibility](docs/SMART_LOGISTICS_RENAME.md) for the repository rename and preserved recovery identifiers.

## Local validation before push

Use a persistent development workstation with **Node.js 22.12 or newer in the
22.x release line, Corepack, pnpm 10.34.5
(resolved from each committed `packageManager` pin), Python 3.10+, .NET SDK 8,
Bash, Git and the Docker Compose CLI**. Linux/macOS on x64/ARM64 are supported.
The backend `global.json` selects the latest installed stable .NET 8 feature
band. Docker is needed only for configuration rendering in this source profile;
the hook does not start containers or contact production. Dependency installation
uses frozen lockfiles, and package/NuGet audits require network access.

After reviewing this source, install the optional hook once from your clone's
primary checkout:

```sh
node local-tools/ci/pre-push.mjs install
```

The hook reads Git's actual proposed ref updates. Each distinct non-deleted ref
tip (including a tag pointing to a commit) is checked in a fresh detached temporary
worktree, using that commit's source and check commands. It does not substitute
your current `HEAD`, index, dirty files or untracked files, and it does not rewrite
branches or history. Intermediate ancestors are retained, not individually rebuilt.
Full-history clones are required; there is no automatic fetch. Deleted refs need
no build. Missing tools, a missing committed validator or a failed check refuse the
whole push. The temporary worktree is removed after a normal success or failure.

For the same exact-commit check without a push, run:

```sh
node local-tools/ci/pre-push.mjs check HEAD
```

The shared source profile runs release-boundary checks, frontend type/build/unit
tests and dependency audit, Node build/unit/edge/deployment-boundary tests and
audit, and .NET restore/build/tests with NuGet audit warnings treated as errors.
`local-tools/ci/local-checks.mjs` is also called by the corresponding hosted jobs.
It **does not replace** hosted Chromium, real PostgreSQL/gateway, restore-drill or
paired browser qualification, nor prove a deployment or production rollback.
It executes the committed source with your user privileges; it is not a sandbox
for untrusted public pull requests.

Git's default hook belongs to the clone and affects all of its linked worktrees.
Installation and removal from a linked worktree are refused, preserving the shared
hook after temporary checkouts are removed. The generated handler resolves the
checkout being pushed at invocation time; a checkout missing the committed
validator refuses the push.

Installation never changes `core.hooksPath` or overwrites an existing hook. If you
already use a hook manager or custom hook, preserve it and deliberately chain
`node local-tools/ci/pre-push.mjs run "$@"`, forwarding Git's original two arguments
and the complete original stdin to both validators. An earlier hook consuming
stdin must not leave this one an empty input. Uninstall only the unchanged generated
hook from the primary checkout with `node local-tools/ci/pre-push.mjs uninstall`.
Hooks are opt-in per clone
and Git can bypass them; hosted required checks remain independent and mandatory.

## Hosted CI usage

Feature branches qualify on **every pull request**, avoiding a second full suite
on the same feature-branch push. Pushes to the three permanent branch names
`dev`, `staging` and `main` still qualify their exact resulting source, including
post-merge main. This trigger list does not create branches or configure their
protection. There are no path-based gaps in required PR checks. Superseded automatic
runs are cancelled; manual and publication-reused qualification is isolated and
retained. Existing check names and full release qualification remain unchanged.

GitHub currently provides standard hosted-runner compute free for public
repositories; reducing duplicate work saves compute and queue time, without proving
a reduction to this account's bill. Larger runners and storage have separate
billing rules. See [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
No self-hosted Actions runner is registered by this repository, and public PR
jobs remain on GitHub-hosted runners.
