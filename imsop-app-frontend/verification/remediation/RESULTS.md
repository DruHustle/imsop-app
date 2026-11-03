# Initial IMSOP remediation verification — 27 October 2026

Historical initial verification. See [follow-up completion](FOLLOWUP.md) for current application revisions and the completed purchasing/email/forecast workflows.

This current record supplements the dated historical `verification/RESULTS.md`. Historical screenshots remain intact; new evidence lives here. See the [full supplied review](../../docs/remediation/REVIEW-2026-10-26.txt), [IMS-01–IMS-18 closure matrix](../../docs/remediation/CLOSURE.md) and [implemented design reference](../../docs/remediation/DESIGN_REFERENCE.md).

## Revisions and scope

Frontend application source: **`5d1971070703d002f5eb28495d1da6345e7d93d1`**. Backend runtime source: **`d2e78b391d5772e3b8ac2b8d919e8aabb40b3012`**. Later test/document/evidence commits do not change those application files. Both independent repositories use branch `fix/imsop-remediation-20261027`; no histories/remotes were combined. Both initial working trees were clean. Original branches were preserved. Baselines were frontend `367f4abfc10d681d60c38244865a831d78be7588` and backend `10da3ed91fd820660c1210dac4f2970b86e68788`, freshly fetched main rather than a reset to older review snapshots.

The [cross-repository release manifest](https://github.com/DruHustle/imsop-app-backend/blob/fix/imsop-remediation-20261027/verification/release-manifest.json) binds the exact application revisions, API/schema versions and local ARM64 manifest digest. This is isolated qualification. Production merge/deployment, customer records, real email, provider accounts and paid infrastructure were untouched. No hosted running-version or production-backup receipt is claimed.

## Commands and results

Commands ran in this frontend checkout. Required thresholds and assertions were preserved.

| Exact command | Result | Evidence |
|---|---|---|
| `pnpm exec tsc --noEmit` | Passed | [Type check](typecheck.txt); required in both CI workflows |
| `pnpm test` | **33 unit/component tests + 3 deployment regression tests passed** | [Unit/deployment log](unit-tests.txt) |
| `VITE_BASE_PATH=/ pnpm build` | Passed; deployment verifier checked 31 browser chunks for retired endpoints | [Build and verification](build.txt) |
| `pnpm e2e --reporter=line` | **80 desktop/mobile fixture browser checks passed** | [Mocked-browser log](mocked-browser.txt) |
| `pnpm audit --prod --audit-level=moderate` | Passed unchanged threshold; **2 low** findings remain | [Audit](audit.txt) |
| `pnpm exec playwright test --config playwright.system.config.ts` | **9 real-stack browser checks passed** | [Real-browser log](real-browser.txt) |

The ordinary browser suite uses labelled demo/HTTP fixtures. It covers desktop/mobile routes, legacy aliases, history, filters/return context, role/forbidden behavior, 401 cleanup/sign-out failures, recovery malformed/missing/short/reload paths, exact Assistant comparisons, actual board controls, named dialogs/focus, keyboard menus, preview close/restore, reduced motion, contrast/zoom preferences and theme persistence.

The real suite does not fulfill API responses. It uses the actual local first-party preview proxy on 4189 → YARP/Node/.NET ARM64 bundle on 18067 → PostgreSQL 16, with an isolated SMTP sink and development-only broker double. Tests cover signed intake, persisted acknowledge/assignment/note/resolution, reload/audit, per-user notification read persistence after reload, exact longer/missing tracking identities and Parcel mode, the exact emitted recovery link during demo identity with offline retry/replay/reload, and all six signed-out/live/demo × emitted/legacy link cases with real disposable password writes. The 620-record workspace loads a second cursor page, finds the oldest delayed record and exports exactly the same authorized filter/source/time.

Run the backend gateway seed suite and `system/scale-fixture.ts` before real browser qualification as documented in the [backend reproducible commands](https://github.com/DruHustle/imsop-app-backend/blob/fix/imsop-remediation-20261027/docs/TESTING.md). Tests restart only the disposable backend between repeated identity scenarios to preserve the real auth limiter. No production security threshold was relaxed. Real reset URLs stay in sink/browser memory and are removed from the visible URL before screenshots. Tracing is off for recovery credentials.

The backend separately passed **14 Node unit/HTTP fixtures, 11 real PostgreSQL/security/migration checks, 5 actual gateway/.NET/EF/outbox/sink checks and 4 .NET tests**. Its [results](https://github.com/DruHustle/imsop-app-backend/blob/fix/imsop-remediation-20261027/docs/remediation/RESULTS.md) include exact commands, four rejected deliberate breakages, non-UTC behavior, ARM64 digest/running-version/readiness, compatible image rollback, production configuration rejection and a 22-second disposable restore. These are separate test layers, not a combined end-to-end count.

## Screenshots and visual inspection

The user's two IMSOP sheets define layout, spacing, typography and grouped navigation. The original tokens are unchanged: light primary `#087d92`, dark primary `#5ed3e4`, backgrounds `#f3f6fa` / `#0d1725`, sidebar `#112338` / `#101c2c`. Explicit browser assertions verify palette values and Light/Dark/System behavior, including an OS preference change. Only the current navigation tab is active. Shared components calculate metrics and charts from selected authorized records or clearly labelled demo data; illustrative board figures were not copied into live responses.

Both-theme populated/loading/empty/error states were captured at **360, 390, 768, 820 and 1280 px**, with all eight workspaces at desktop/mobile and no body overflow. Forbidden/role behavior has separate browser checks. Long-label hostile records remain in test fixtures. Source failure is shown truthfully, without substituting demo records.

Representative screenshots were opened and inspected, not merely generated. Findings corrected during that inspection included narrow-desktop account clipping, dense route labels (cards now apply through 900 px), duplicate substring Assistant identities, an obstructing login toast, and a hardcoded sidebar surface inconsistent with the original tokens. Final inspection checks hierarchy, spacing, legibility, visible primary controls, current-tab highlight, panel/chart layout and both theme surfaces. Notification screenshots wait for the closing animation before capture.

| Workspace | Light | Dark |
|---|---|---|
| Overview | [Desktop](screenshots/overview-1280-light.png) | [Desktop](screenshots/overview-1280-dark.png) |
| Shipments | [390 px cards](screenshots/populated-390-light.png) | [768 px cards](screenshots/populated-768-dark.png) |
| Orders | [Desktop](screenshots/orders-1280-light.png) | [390 px](screenshots/orders-390-dark.png) |
| Analytics | [Desktop](screenshots/analytics-1280-light.png) | [Desktop](screenshots/analytics-1280-dark.png) |
| Recommendations | [Desktop demo](screenshots/recommendations-1280-light.png) | [390 px demo](screenshots/recommendations-390-dark.png) |
| Assistant | [Desktop comparison](screenshots/assistant-1280-light.png) | [390 px](screenshots/assistant-390-dark.png) |
| Service health | [390 px](screenshots/health-390-light.png) | [Desktop](screenshots/health-1280-dark.png) |
| Integrations | [Desktop](screenshots/integrations-1280-light.png) | [390 px](screenshots/integrations-390-dark.png) |

Actual real-stack evidence: [persisted resolved review](review-desktop.png), [exact Assistant on mobile](assistant-mobile.png), [old record from 620-record selection](real-scale-filter.png), [real recovery success with scrubbed URL](recovery-success.png). Demo review actions are explicitly device-local; the real-stack review screenshot is backed by persisted PostgreSQL actions.

[Browser measurement](real-browser-performance.json) records actual 620→1 selection requests, navigation/resource timing and overflow in the isolated stack. The backend's actual EXPLAIN plans and 30 local samples measured median 8.57 ms / p95 35.66 ms. These small local observations do not establish general production latency, Core Web Vitals, WCAG certification or hosted performance.

## Explicit limits and rollout

Existing hosted backup/monitoring settings and installed/runtime production SHA remain externally unverified. A green CI/probe is not a deployment receipt. No production deployment occurred.

An authorized release needs reviewed legacy workspace/provider ownership mappings, recovery encryption/provider secrets and both forward schema migrations under the existing owners. The compatible backend must precede the dependent frontend; the root-base Vercel first-party proxy remains intact. Purchasing UI stays unavailable until complete item/receiving flows exist; .NET durable intake is API-qualified with real supplier/organization validation. Forecasts and external notifications remain optional/unavailable with documented concrete contracts. The signed-event review and in-app notification cycle are implemented and persist.
