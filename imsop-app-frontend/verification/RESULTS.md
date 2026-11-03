# IMSOP redesign verification — 26 October 2026

This is a **local implemented result**. Neither repository was pushed or deployed. No production shipments/orders were created, providers contacted for test data, live notification settings changed, or infrastructure deployed.

## Repository state and review basis

- Frontend: `DruHustle/imsop-app-frontend`, branch `feat/operational-workspace-redesign`, based on `cb548fb8bed08dbcb019cc46ba1ae482b186ab33`.
- Backend: `DruHustle/imsop-app-backend`, branch `feat/operational-read-workflows`, based on `903b0e63ad5773975cf1ee60279d39307037d299`.
- `git ls-remote origin refs/heads/main` confirmed those remain the respective remote main heads. GitHub showed no open PRs in either repository.
- No applicable AGENTS.md files were found. Both independent working trees were clean before work. Histories/remotes/deployment boundaries and the backend's divergent local `main` branch were preserved; no branch was reset.

## Commits

- Frontend `80cc32f`: shared workspace, workflows, source state and interaction tests.
- Frontend `9d05869`: brand/image optimization and audited dependency patches.
- Backend `38174a7`: authorized bounded reads, details/events, tests and contract documentation.
- A final frontend evidence commit contains this report, raw logs and screenshots.

No PR link exists because no branch was published.

## Implemented behavior

A shared accessible shell organizes Overview, Supply chain (Shipments/Orders), Insights (Analytics/Recommendations/Assistant), and Infrastructure (Service health/Integrations). Profile and preferences are in the account menu, with labelled notifications and global theme/data-mode controls in the header. Wouter is retained; old hash URLs and password-reset query-token handling remain compatible.

Shipments default to a searchable list. Filters, sorting, bounded pagination, URL persistence, stable-ID details, event history, return links and filtered exports function. Mobile cards keep status, route, ETA/event freshness and Open visible; advanced filters and the map are secondary. Orders use authorized Node operational records and never masquerade as .NET PurchaseOrders. Production creation is unavailable with a visible explanation.

Shared data mode covers every operational page, map, demo alert, Assistant response and export. Live starts loading, has independent source failure/permission states, and never silently substitutes fixtures. Demo fixtures are fixed at 2026-10-26 09:00 UTC. Summary counts, exception drill-downs and analytics use the selected scope. On-time delivery uses eligible timestamped deliveries as the denominator. Revenue/cost/accuracy claims unsupported by contracts were removed.

The deterministic Assistant supports scoped record lookups, counts and exceptions with record/source/event-time references. Queries opened from Overview/details require an explicit send. Cancellation and source retry are implemented; conversations reset with account/mode changes. No operational action is executed. The full browser suite also verifies cancellation and configured-map marker synchronization through local SDK doubles.

Infrastructure probes distinguish API process liveness/readiness from provider health, mark old checks stale, and aggregate failures consistently. Production connector status, model providers and notifications remain explicitly unavailable/unknown. Demo notifications retain user/mode-scoped read/dismissal state and honour the supported local preference. Logout/account changes clear sensitive local state.

Light/dark palettes, validated persisted theme, system theme changes, effective reduced motion, contrast preferences, named controls, skip navigation, drawer Escape/closing/focus and browser zoom are implemented. Profile no longer invents email verification, enables unsupported production avatar changes, or reports a demo password validation as a real password change.

Reports preserve filtered scope/mode/source/date/filter/generation metadata. Dynamic HTML and titles are escaped; CSV formula prefixes are neutralized. Live exports require the backend report permission check. Print windows are labelled Print / Save as PDF, with blocked-window, empty and failure behavior. Download feedback reports a request rather than claiming browser completion.

## Hosted navigation observation

Using the existing built-in demo admin at `https://imsop-app.vercel.app/`:

- Normal desktop pointer click navigated to `#/operations`.
- Keyboard focus + Enter navigated to `#/analytics`.
- At 390px, the mobile-menu button opened the drawer.

**The reported unresponsive-link/menu product defect was not reproduced. No root cause is asserted.** [Hosted desktop before](hosted-desktop-before.png) and [hosted mobile before](hosted-mobile-before.png) preserve the observation context. The redesigned interactions are tested through real controls, including drawer closing, focus, Escape and Back/Forward.

An initial local E2E attempt reused an unrelated application's existing port 4173. That result was invalid for IMSOP. The unrelated application was left running; Playwright now owns isolated port 4188 with server reuse disabled. Initial sandbox restrictions on Chromium/HTTP listeners/MSBuild pipes were handled by authorized execution. The machine had only .NET 10; a temporary .NET 8 SDK in `/private/tmp/imsop-dotnet8` supplied the correct runtime without changing global installations.

## Exact final checks

| Check | Result | Evidence |
|---|---|---|
| Frontend `pnpm exec tsc --noEmit` | PASS, exit 0 | [Type check](logs/frontend-types.txt) |
| Frontend `pnpm test` | PASS: 26 Vitest tests + 3 deployment-verifier tests | [Unit log](logs/frontend-unit.txt) |
| Frontend `pnpm build` | PASS, includes verification of 29 browser chunks for retired endpoints | [Default GitHub Pages base build](logs/frontend-build.txt) |
| Root-base production build | PASS as part of Playwright's webServer build (`VITE_BASE_PATH=/`) | [E2E log](logs/frontend-e2e.txt) |
| Frontend `pnpm e2e --workers=2 --reporter=line` | PASS: 74 desktop/mobile tests; subsequent final health-mode fix passed 6 focused checks | [Browser log](logs/frontend-e2e.txt), [final health-mode checks](logs/frontend-health-mode.txt) |
| Frontend `pnpm audit --prod --audit-level=moderate` | PASS, exit 0; 2 low advisories remain | [Audit log](logs/frontend-audit.txt) |
| Backend `server/pnpm test` | PASS: 12 tests, including direct API middleware tests for all roles | [API log](logs/backend-tests.txt) |
| Backend `server/pnpm build` | PASS, exit 0 | [API build](logs/backend-build.txt) |
| .NET `dotnet test src/IMSOP.sln --no-build --configuration Release --verbosity minimal --maxcpucount:1` using temporary .NET 8 | PASS: 4 tests | [Test log](logs/dotnet-tests.txt) |
| .NET `dotnet build src/IMSOP.sln --no-restore --configuration Release --maxcpucount:1` using temporary .NET 8 | PASS: 0 warnings, 0 errors | [Release build](logs/dotnet-release-build.txt) |
| Both repositories `git diff --check` | PASS | Local Git checks |

The existing mandatory frontend audit initially found critical/high advisories. DOMPurify was patched through the existing override mechanism and Zod updated in both repositories; lockfiles are included. No thresholds or tests were weakened. Tautological component tests and random-Assistant/class-only theme expectations were replaced with assertions about contracts, evidence, actual colors and behavior.

## Screenshot evidence

72 full-page PNGs are retained under [screenshots](screenshots/). The state matrix covers populated, empty, held-loading and failed live fixtures at **360, 390, 820 and 1280 CSS pixels**, each in light and dark. Tests assert no document horizontal overflow and one H1. Secondary-page captures cover Overview, shipment detail, Orders, Analytics, Recommendations, grounded Assistant, service health, Integrations, Preferences and Profile at mobile/desktop in both themes.

- [All 32 responsive source states](state-contact-sheet.png)
- [Desktop shipments, light](screenshots/populated-1280-light.png)
- [390px shipments, dark](screenshots/populated-390-dark.png)
- [360px empty, light](screenshots/empty-360-light.png)
- [Tablet loading, dark](screenshots/loading-820-dark.png)
- [Desktop failed source, light](screenshots/error-1280-light.png)
- [Overview, dark](screenshots/overview-1280-dark.png)
- [Analytics, light](screenshots/analytics-1280-light.png)
- [Grounded Assistant, mobile dark](screenshots/assistant-390-dark.png)
- [Shipment detail, light](screenshots/detail-1280-light.png)
- [Health, dark](screenshots/health-1280-dark.png)

The contact sheet and representative original screenshots were visually inspected for structure, wrapping, theme consistency and control visibility. Automated interaction checks cover the remaining pages and state matrix. There are no screenshot-baseline claims about the hosted deployment.

## Measured asset changes

| Measurement | Before | After | Change |
|---|---:|---:|---:|
| Three existing favicon variants, raw bytes | 19,415,262 | 26,136 | −99.87% |
| Four retained JPEG images, raw bytes | 17,456,556 | 959,670 | −94.50% |
| Emitted JavaScript, sum of Vite-reported chunk sizes | 988.50 kB | 500.14 kB | −49.40% |
| Emitted JavaScript, sum of Vite-reported gzip sizes | 292.59 kB | 166.88 kB | −42.96% |

The new separate 180px Apple touch icon is 47,488 bytes. The original raster brand mark is preserved; the SVG favicon is now a small self-contained wrapper. Auth/background imagery is no longer loaded decoratively. The large chart dependency is no longer emitted for fabricated charts; descriptive distribution bars have accessible summaries. Map code stays lazy and the shell remains mounted during route loading.

[Raw asset measurements](asset-measurements.json) use filesystem byte counts. Bundle comparisons sum the rounded sizes emitted by Vite for the same default base before and after. They are not measured navigation, rendering, network-latency, Lighthouse or Core Web Vitals improvements.

## Concrete limits and rollout

- **Independent backend release required:** the new bounded envelopes/detail/event/report-access endpoints must be available before Live workflows work with this frontend. No production rollout, push or PR was performed here.
- Lists, metrics, reporting and Assistant intentionally cover the newest **500 authorized records** by stable ID. Filtering occurs inside that explicit scope, not across an unbounded historical database. Known older stable detail IDs can be opened; whole-history search/analytics is outside this release.
- API tests use deterministic database doubles and real authentication/authorization middleware. PostgreSQL execution, production cookies/proxy configuration, and hosted cross-service readiness were not exercised against production. Live failure/slow/empty/forbidden/stale fixtures are isolated browser responses.
- Shipment snapshot fields can differ from latest stored event evidence. Event times are preserved and explained; ingestion is not changed to reconcile out-of-order provider updates.
- No configured model provider, live forecasts/risk/weather evidence, production notification delivery/preferences, connector-health/sync registry, cloud-management controls, complete purchase-order form, or production shipment-creation workflow is added.
- The .NET PurchaseOrder service and its GUID/envelope/organization/supplier contracts remain separate and unchanged.
- Keyless/provider-failure mapping has an explicitly schematic coordinate/list fallback. Configured Google Maps lifecycle behavior is tested with a local SDK double, not a paid provider or real key.
- Browser print and download completion depend on the browser/user. The interface avoids claiming delivery or a PDF file was produced.
- Two low production dependency advisories remain below the repository's mandatory audit threshold.

## Current remediation record

The report above is dated historical evidence. For the 27 October 2026 remediation and supplied-board implementation, see [current results](remediation/RESULTS.md) and [closure matrix](../docs/remediation/CLOSURE.md). Its former local no-push/no-deploy statement describes that earlier session, not the later merged baseline or this remediation branch.
