# IMSOP deployed release — 26 October 2026

The redesigned frontend is live at **https://imsop-app.vercel.app/**. The repository-base build is also published at **https://druhustle.github.io/imsop-app-frontend/**. The corresponding read API is deployed on the existing Oracle VM at **https://imsop-api.152-70-22-84.sslip.io**.

## Published changes

- [Frontend PR #6](https://github.com/DruHustle/imsop-app-frontend/pull/6), merged as `367f4abfc10d681d60c38244865a831d78be7588`.
- [Backend PR #3](https://github.com/DruHustle/imsop-app-backend/pull/3), merged as `88f2c2f2db54d1a23caca295bea69fcf8e28b955`.
- [Backend UTC follow-up PR #4](https://github.com/DruHustle/imsop-app-backend/pull/4), merged as `10da3ed91fd820660c1210dac4f2970b86e68788`.

The Oracle container uses `imsop-app-backend:oracle-8485056`, built from the UTC fix's tested source commit `848505658dea10df101b6c1216b2975b5a1bc4d9`. Its image digest is `sha256:78b1b19ab46188e03b307977363472ff682fdd6af0bb4e28636ba3ea13613dcc` (Linux ARM64). The transferred archive SHA-256 matched locally and on the VM: `ecd530770284a29d3e0a584698a789e016e6e1bd331262618affb7bac0b75ad6`.

Only the existing IMSOP app container was updated. The private runtime configuration was preserved byte-for-byte. Its existing managed database was reused, with no new migration pending. The prior image `imsop-app-backend:oracle-6eff140` and rollback manifest `/opt/imsop-app-backend/compose.pre-8485056.yaml` are retained. Shared ingress and sibling applications were not restarted.

## Release corrections

1. Vercel's `/health` and `/ready` paths previously reached HTML fallback. They now proxy the corresponding backend checks with no-store caching. Actual production responses are JSON with `ok` / `ready` status.
2. A constant-only read against PostgreSQL proved that raw timestamp subqueries produce values without timezone information. Both evidence timestamps now use their existing column decoders to serialize UTC. A regression exercises the real ORM, controller and HTTP serialization under Europe/Berlin.
3. `ubuntu-latest` had moved to Ubuntu 26.04, unsupported by the locked Playwright version. Workflows now use Ubuntu 24.04 with the matching official Playwright 1.57.0 Noble image. That image also avoids the extremely slow Ubuntu mirror downloads observed during a cancelled setup run. Every existing build, audit, unit and browser check remains enabled.

## Actual deployed verification

[Oracle deployment log](oracle-deployment.txt), [real database/API results](oracle-api-verification.jsonl), [Vercel proxy results](vercel-api-verification.jsonl), [hosted UI results](hosted-ui-results.jsonl).

- Oracle liveness/readiness and Vercel's first-party `/health` and `/ready` return successful JSON responses. Gateway readiness reports the configured Node, Operations and Supply Chain dependencies healthy; this does not establish third-party provider health.
- Database-backed list queries succeed through the internal API, Oracle HTTPS and Vercel proxy. List envelopes, bounds, source identity and missing stable-ID responses were checked.
- Real authorization middleware returned the following results using short-lived, in-memory server-side verification tokens. These principals were not persisted as accounts; no real-user password login was exercised.

| Role | Shipments | Node Orders | Reports |
|---|---:|---:|---:|
| admin | 200 | 200 | 200 |
| engineer | 200 | 200 | 403 |
| analyst | 200 | 200 | 200 |
| user | 200 | 403 | 403 |

Anonymous reads return 401. Both cookie forwarding and bearer authorization work through the production proxy. No credentials, JWT values or business records were written to the evidence files.

The production database currently contains **zero shipments, zero operational orders and zero logistics events**. Live therefore correctly returns empty sources. Positive existing-record detail/event reads cannot be exercised against this empty database; local fixtures and the real ORM regression cover those paths. No demonstration records, production users, orders or shipments were created to make the UI appear populated.

On the actual hosted Vercel app, normal pointer navigation, the mobile drawer and Escape, shipment search, stable-ID detail/tracking navigation, reload, return-to-filtered-results, grounded Assistant responses and light/dark rendering passed at 1280px and 390px. No page exceptions or horizontal document overflow were observed. These screenshots deliberately use clearly labelled Demo data:

- [Desktop light](hosted-shipments-1280-light.png)
- [Desktop dark](hosted-shipments-1280-dark.png)
- [390px light](hosted-shipments-390-light.png)
- [390px dark](hosted-shipments-390-dark.png)

## Checks and evidence

- Frontend PR CI: PASS — [workflow 40387719377](https://github.com/DruHustle/imsop-app-frontend/actions/runs/40387719377). Build and retired-endpoint verification, 26 unit tests, 3 deployment-verifier tests, 74 desktop/mobile E2E tests, and the existing production-audit threshold passed. [Captured log](frontend-ci.txt).
- Backend UTC follow-up CI: PASS — [full solution and Node checks](https://github.com/DruHustle/imsop-app-backend/actions/runs/40386938426), [Node checks](https://github.com/DruHustle/imsop-app-backend/actions/runs/40386938503). All 13 Node tests and the build passed. [Local test log](backend-tests.txt).
- Backend merged main CI and image publication: PASS — [workflow 40387227886](https://github.com/DruHustle/imsop-app-backend/actions/runs/40387227886), [Node workflow](https://github.com/DruHustle/imsop-app-backend/actions/runs/40387227845).
- Vercel reports the frontend merge commit successfully deployed: [production deployment](https://vercel.com/druhustles-projects/imsop-app/BhD9Mr3oJsBjPEnV1U2XBy5tHaPU). Production HTTP and UI checks above verify the outcome independently of that status.

## Final production workflows and secondary hosting

- Frontend main CI/CD and Vercel deployment: **PASS** — [workflow 40388632367](https://github.com/DruHustle/imsop-app-frontend/actions/runs/40388632367), [captured log](frontend-production-ci.txt). Its full 74-test browser suite passed again.
- GitHub Pages build and deploy: **PASS** — [workflow 40388632763](https://github.com/DruHustle/imsop-app-frontend/actions/runs/40388632763), [captured log](pages-production-ci.txt). Its full 74-test browser suite passed again.
- Actual GitHub Pages pointer/mobile navigation, filtered details/reload/return, Assistant and both themes passed at 1280px and 390px under `/imsop-app-frontend/`. [Results](pages/hosted-ui-results.jsonl), [desktop screenshot](pages/hosted-shipments-1280-light.png), [mobile screenshot](pages/hosted-shipments-390-dark.png). These secondary-host UI checks use isolated Demo identities; real password authentication on Pages was not exercised.
- The Vercel real-database/role probe was rerun successfully after the production workflow completed. [Final API results](vercel-api-final-verification.jsonl).

The Pages REST resource's legacy `status` field still reports `errored`; this differs from the successful workflow/environment deployment and the public serving checks. No public UI failure was reproduced, and no root cause for that metadata discrepancy is asserted.

## Remaining product limits

The newest-500-record scope remains explicit for lists, analytics, reporting and Assistant. Production creation, model-backed forecasts, notification delivery/preferences and connector status remain unavailable unless supported/configured; .NET PurchaseOrders remain separate from Node operational orders. No provider account was connected and no business or infrastructure action was executed by Assistant.

The original `verification/RESULTS.md` in the frontend repository is the historical pre-release local-verification snapshot. This document records the subsequent published deployment and real-database verification.
