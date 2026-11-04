# Consolidated release and legacy repository retirement

## Source of truth

The source is `DruHustle/imsop-app`. Frontend and backend release identities are the **same full consolidated commit SHA**. The frontend/domain preparation originally reviewed in component frontend PR #13 and backend PR #10 is retained through consolidated PR #1. Do not replace it with an older component checkout.

Root workflows are the only active workflows:

- `ci.yml`: locked frontend/Node/.NET builds and tests, dependency audits, image-retention/configuration boundaries, release-boundary tests, and both real-stack suites.
- `system-qualification.yml`: disposable PostgreSQL, gateway, security/upgrades, receiving, email sinks, outbox, forecasts, regression sensitivity, production-mode origin checks, database restore, and paired browser qualification. Both applications come from a single checkout. It never checks out a component repository.
- `publish-backend.yml`: manually dispatched, fully requalified main-only amd64/arm64 image publication. All five original image names are retained. Full SHA tags and digest receipts identify images; no `latest` tag or live container changes occur. Image receipts explicitly say `deployed: false`.
- `deploy-frontend.yml`: manually dispatched, fully requalified main-only Vercel publication. It requires the live API to serve that exact consolidated SHA and contract. It stages a production build without assigning live domains, verifies project ownership and both serving revisions, then promotes that same deployment and repeats public probes without protection bypass. It does not claim authenticated acceptance or rollback verification.

Nested component workflows are removed from the consolidated source, not from the still-operating legacy repositories. Existing CI and deployment on those repositories remains untouched pending cutover.

## Required account configuration

Configure the **existing** production project and deployment identity; do not create a replacement project, expose credentials, or guess identifiers.

In the consolidated repository's protected `production` environment, configure `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` using the existing secret mechanism. Configure `IMSOP_API_ORIGIN` and `IMSOP_WEB_ORIGIN` to the verified serving origins, and `VERCEL_CLI_VERSION` to an approved exact `x.y.z` version. There are deliberately no guessed domain or credential defaults.

For protected staged deployment URLs, configure the existing project-scoped `VERCEL_AUTOMATION_BYPASS_SECRET` through the secret store. Do not disable deployment protection or place the secret in a URL. The verifier confirms deployment ownership against Vercel's API before sending a bypass header to that exact direct deployment hostname. Requests reject redirects. Application authentication remains absent, so protected operational endpoints must still return 401. Ordinary public/API probes never read this secret. Missing protected-deployment access fails before promotion.

The frontend workflow pins external actions to full commit SHAs, disables persisted checkout credentials and installs dependencies/CLI without the Vercel token in their environment. The token is scoped to preflight and authenticated steps, never passed as a command-line argument. `vercel pull` still materializes project environment settings for the trusted production build; keep frontend project variables minimal and never publish `.vercel` or its environment files.

For the existing Vercel project, move its Git linkage to this repository and set Root Directory to `imsop-app-frontend` during the coordinated cutover. Vercel CLI runs from the monorepo root. After `vercel pull`, the workflow checks project/org identity and the pulled root-directory setting before build/publication. Keep the previous deployment and recorded settings for rollback. Avoid enabling an unqualified parallel automatic production deploy; the qualified workflow owns publication.

The existing GHCR packages must grant Actions access to the consolidated repository before backend publication. A token from a different repository does not prove package access. Preserve package/image identity and rollback digests when changing access or repository linkage. Do not delete packages during repository cleanup.

Protect `main` and production environments with the organization's required checks/review policy. Code does not configure GitHub administrative policy or copy secrets automatically.

## Qualification and rollout order

1. Run the complete root CI on the candidate; inspect every job, not only the unit-test jobs. After merge, qualify the exact main SHA again. Browser and database fixtures are disposable, not production users or records.
2. Dispatch `publish-backend.yml` on main, or build the exact committed backend using the established Oracle image-transfer procedure with `APP_REVISION` set to the consolidated SHA. Preserve the OCI manifest digest, architecture and revision label. Registry publication alone is not installation.
3. Use the established [Oracle runbook](../imsop-app-backend/deploy/oracle/README.md), backup/migration principals, deployment lock and retention-aware tooling. Inspect the actual destination host and current private manifest first. The [Onesa candidate](../imsop-app-backend/deploy/onesa/README.md) does not authorize a guessed VM, database switch, Kubernetes rollout or ingress replacement. Do not modify sibling services or prune volumes.
4. Rehearse the previous **compatible scoped** backend image in isolation against the candidate schema; verify readiness, contract, exact identity, data and outbox preservation, then restore the candidate. A database restore drill is a separate test and is not a rollback rehearsal. Record the previous/current immutable image identities and manifest backups.
5. Install the backend through the existing authorized server access. Verify `/version`, `/ready`, configured origins and anonymous rejection, then approved session/role/workspace/recovery/operational acceptance. No legacy ownership inference, customer-data mutation or fabricated production account is allowed.
6. Configure Vercel as above and dispatch `deploy-frontend.yml` on **the same main SHA** using `gh workflow run deploy-frontend.yml --ref main --repo DruHustle/imsop-app`, or `pnpm -C imsop-app-frontend deploy`. The workflow checks the backend before staging and immediately before promotion. A stage ownership, readiness, source, contract or anonymous-denial failure leaves live domains unchanged. Retain the previously qualified deployment before starting.
7. Verify the intended public origin, TLS, first-party cookies, recovery email links/delivery, role and cross-workspace restrictions, live reads and operational workflows using approved test identities. Record published Vercel deployment ID, observed frontend/backend SHAs and test results. No prepared domain or successful `/health` response substitutes for this acceptance.
8. Rehearse the retained compatible frontend rollback and return to the candidate using the established production/isolated acceptance procedure. Record exact deployment IDs and probe/acceptance results; verify the candidate is serving again. Preserve the backend and database data throughout.

Frontend release artifacts contain only deployment URL and sanitized staged/public smoke receipts, not `.vercel`, environment files, production mail, cookies or credentials. A failed post-promotion smoke check requires the retained qualified rollback procedure; do not delete the earlier deployment or repositories. There is no automatic rollback to an unqualified historical image or deployment.

## Retirement gate: every item must have verified evidence

Before retiring **either** component repository, retain a dated release record identifying:

- Consolidated main SHA and all passing qualification run/job URLs.
- Installed backend host identity, exact image/manifest digests, frontend project/deployment ID, public origins and observed source identities.
- Approved authenticated operational and recovery acceptance results, with no secrets in evidence.
- Compatible backend and frontend rollback rehearsals and successful return to the candidate; current and rollback images/deployments remain available without either old repository.
- Complete branch/tag/history reconciliation, including outstanding component PRs, and recoverable repository mirrors with LFS objects where applicable. Preserve issue/release metadata required by the owner.
- Vercel Git linkage/build root, GitHub Actions/reusable workflows, GHCR package grants and source linkage, hooks, status checks, deploy keys, OIDC subjects, server Git remotes, release scripts, integrations and backup/restore jobs no longer depending on either component repository. Documentation links alone are not the whole dependency audit.

Do not mark these as passed from source tests, an image push, a landing page, a historical release report, or a human-authored unchecked boolean. Inspect the actual systems and attach receipts. If any dependency is unknown, retain both repositories. Archive only after the same gate, then delete only with a verified restorable archive and the user's retirement authorization. There is intentionally **no automatic repository deletion workflow**.

## Scope of source consolidation

These changes migrate workflow definitions and release checks, not account secrets or deployed infrastructure. Existing production continues through its retained configuration until the above operating gates are completed. Pending gate evidence is a release blocker, not permission to claim 100% production validation.
