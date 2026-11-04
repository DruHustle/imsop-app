# Completed follow-up and code review — 27 October 2026

The user authorized completing remaining gaps, reviewing code and pushing to main. This record supersedes the initial product deferrals in RESULTS.md. Application source is frontend `d243b29dda97b8c43ac669663c80524be3e7c12e`, backend `84802bf1c62049a9ba024fa7d7eb950399159b75`. Later commits are test/document/evidence only. Both repositories remain independent; the original working trees were clean. [Frontend PR #7](https://github.com/DruHustle/imsop-app-frontend/pull/7), [backend PR #5](https://github.com/DruHustle/imsop-app-backend/pull/5).

Completed capabilities:

- Actual purchase supplier/product selection and source currency/prices, server-computed exact totals, stable retry identity, persisted order/item/outbox state, review and evidence-based partial warehouse receipts with concurrent stock protection. Node operational orders and .NET purchases remain distinct. Missing legacy evidence is not fabricated.
- Per-workspace review email opt-in and persisted preference; transactional, bounded delivery rechecks current access and opt-out. Default server delivery remains off until explicitly configured. In-app notifications stay independent.
- Source-observation import, configured provider request, strict product/date/unit/snapshot/horizon response validation, persisted forecast evidence and provider limitations. No automatic booking/inventory/infrastructure action and no invented model/history/confidence.
- Production first-party purchasing proxy before SPA fallback, with private/no-store caching. All original navigation labels, eight tabs, theme tokens and Light/Dark/System behavior are preserved.
- Patched both vulnerable KaTeX instances to 0.18.2. The production audit now reports no known vulnerabilities. Mathematical rendering with trust disabled was verified.
- Shared outline/ghost controls explicitly use the foreground token; theme switches do not animate text through the previous low-contrast colour. The browser palette test checks actual account-button foreground in both themes.

| Exact frontend command | Result | Evidence |
|---|---|---|
| `pnpm exec tsc --noEmit` | Passed | [Type check](followup-typecheck.txt) |
| `pnpm test` | 38 unit/component + 4 deployment regressions passed | [Tests](followup-unit.txt) |
| `VITE_BASE_PATH=/ pnpm build` | Passed; deployment verification checked 36 chunks | [Build](followup-build.txt) |
| `pnpm audit --prod --audit-level=low` | No known vulnerabilities | [Audit](followup-audit.txt) |
| `pnpm e2e --reporter=line` | 86 desktop/mobile fixture checks passed | [Fixture browser](followup-mocked-browser.txt) |
| `pnpm exec playwright test --config playwright.system.config.ts` | 10 actual gateway/PostgreSQL/browser workflows passed | [Real browser](followup-real-browser.txt) |

The new real-browser flow saves and reloads a purchase, records physically observed quantities in an authorized warehouse, verifies received state, enables and reloads email preference, imports labelled historical observations and requests/reloads a validated provider response. The original signed-intake/review/notification/read-persistence, exact Assistant, 620-record search/export and six recovery identity/link-format cases remain covered. Responses are not fulfilled with page.route in the real suite. Mail is an isolated SMTP sink and the forecast server explicitly identifies itself as a contract double, not a real prediction model.

Screenshots opened and inspected: [received purchase](purchasing-received.png), [forecast on mobile in dark mode](forecast-mobile-dark.png), plus the existing full responsive light/dark capture matrix under screenshots. The inspection caught a transient shared-button colour issue, corrected in the final source and regression checks. Fields/actions remain visible at mobile widths; body overflow is asserted. The palette was not replaced by board colours.

[Backend review, exact commands and receipt evidence](https://github.com/DruHustle/imsop-app-backend/blob/fix/imsop-remediation-20261027/verification/review/RESULTS.md) includes 14 Node tests, 12 real PostgreSQL/security/migration checks, 5 gateway/outbox/sink checks, 6 completion checks, .NET 8 build/6 tests, ARM64 revision/digest/readiness, four rejected deliberate breakages, and data-preserving rollback/restore over all 23 critical tables. New provisioning tooling defaults to dry-run and refuses existing ownership reassignment. The production mapping itself has been requested rather than guessed.

Production setup remains evidence-dependent: reviewed legacy ownership/membership, recovery encryption key, forward schemas, actual provider configuration and source demand data. No customer backfill, real email, paid account or Oracle VM update occurred during qualification. A main merge/automatic frontend build is not an installed Oracle version receipt. Existing hosted backup/monitoring settings remain unverified.

The owner explicitly requires legacy records to remain unassigned with IDs preserved. Production provisioning is pending verified assignments. Private read-only inventory/review files are outside both application repositories and contain no approved memberships or inferred ownership.

The original sign-in globe photograph from images/hero-bg.jpg was restored using a base-path-aware URL. Existing light/dark form tokens and working sign-in/recovery controls remain. Desktop/mobile light/dark sign-in captures are included.


The graphical Overview restores the historical chart/map composition using the authorized creation cohort: working UTC date periods and bucket drill-down, actual-arrival-only delivery series, exact status donut, synchronized locations, proportionate indicators and recorded activity. Only supported creation history produces a sparkline. Mobile retains compact cards, readable chart and expandable map. The map provides linked selection and an on-demand interactive globe with actual source positions, keyboard orbit/zoom, selected-record focus, and a WebGL-loss fallback. No inferred route path is rendered.

Each workspace has a distinct visual purpose: shipment chronology with explicit-location replay/pause; order stages and receiving progress; carrier comparisons; exception evidence and proposed priority ordering; Assistant record context; logical health check topology; integration observation flow. Existing themes, roles, navigation, workspace/session boundaries, complete-selection caps and live failure states remain. The final review fixed missing observations being described as recent and kept unrelated page updates from resetting globe orientation. No warehouse/container/asset models exist in the current data contracts, so those scenes were not fabricated.

Actual WebGL rendering, keyboard orbit and zoom were verified on desktop and mobile in both themes; context loss retained the keyless map. [Desktop dark globe](spatial-1280-dark.png), [desktop light globe](spatial-1280-light.png), [mobile dark globe](spatial-393-dark.png), [mobile light globe](spatial-393-light.png). The refreshed screenshot matrix includes the graphical Overview and all eight workspaces in both themes. Representative captures were opened and inspected, including Overview desktop/mobile, order stages, carrier comparisons, review lanes, health topology, integration flow and Assistant record context.

The system browser configuration now builds its own root-path preview before starting. Recovery mail lookup snapshots the sink and accepts only newly emitted password-reset messages, so repeated runs cannot accidentally consume an earlier superseded link. Qualification runs serially against an unchanged backend checkout; interrupted branch/preview attempts were discarded and the final complete run passed all 10 cases without relaxing assertions or production rate limits. Backend PR #5 is merged at 22a956100fed2441a31ded1c18aff131b2b86475; the earlier local backend main was preserved on archive/main-before-remediation-20261027 before local main was synchronized.
