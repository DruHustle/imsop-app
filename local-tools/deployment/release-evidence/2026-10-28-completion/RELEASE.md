# IMSOP production completion — 28 October 2026

Oracle and Vercel now serve the qualified completion release. This receipt supersedes the earlier `2026-10-28-def73e5` receipt for the installed image, runtime roles, Pages and adapter support. Production provisioning and external activation remain separate pending configuration items under the owner's explicit instruction.

| Component | Verified installed identity |
| --- | --- |
| Frontend | `85aa203f182ece15854430cac13656710f6692c5` |
| Backend | `d577908528b3a69ce3bba9c02ee0af7f7f82180a` |
| Installed ARM64 manifest | `sha256:e15bf05050a762b720b1e6016e6a13fbca9b9ee723794dd119a5be6768791839` |
| Multi-platform index | `sha256:26f892efd24ce3263428896b4deef2fde938d195bb4abfd043a768cbb99d1b5f` |
| Canonical frontend | https://imsop-app.vercel.app |
| Oracle API | https://imsop-api.152-70-22-84.sslip.io |
| Vercel deployment | https://imsop-m0h343kn1-druhustles-projects.vercel.app |
| Vercel status | Ready; canonical alias confirmed |

Oracle installed at **2026-10-28T14:53:10Z**. Vercel reported Ready at **14:58:24 UTC**. The unchanged strict release verifier independently passed at **2026-10-28T14:59:04.277Z**, with the exact frontend and backend revisions. [Machine receipt](deployment-receipt.json), [live verifier](live-release-verification.json), [Oracle deployment](oracle-deployment.json).

`/version` reports API contract **2**, Node schema `005_provisioning_audit.sql`, supply-chain schema `202610270002_PurchaseReceiving`, and all four capabilities: `optional-adapters-v1`, `purchase-pagination-v1`, `scoped-reviews-v1`, `customer-order-search-v1`. `/ready` reports **ready** with all three dependencies healthy. Seventeen anonymous auth/operational/purchasing requests returned **401**, including both new adapter/status endpoints. Six preflights confirmed only the Vercel origin is permitted; GitHub Pages and unrelated origins are denied. [Public API checks](oracle-live-verification.json).

## Implementation and verification

- Explicit forecast/SAP enablement, strict startup configuration, bounded server-side credential-file references, SAP read-only OData metadata receipts and validated Service Bus configuration are implemented and tested. Credentials, provider URLs and mappings stay server-side. Disabled/unavailable dispatch preserves orders and actual durable outbox states; transport acceptance never implies fulfillment. [Activation requirements](../../imsop-app-backend/docs/OPTIONAL_INTEGRATIONS.md).
- Integration cards distinguish Not configured, Configured, Not authorized and Unavailable, clear stale results, and expose actual authorized outbox counts. SAP checks are manual and bounded. SAP business synchronization is not implemented or claimed.
- Graphical dashboards, descriptive charts, recorded-location maps, historical replay and 3D globe remain operational without a forecast provider. Camera rotation is opt-in, pauses on manual input, honors reduced motion and does not invent shipment movement. Demonstrations remain explicitly labelled.
- Authentication/recovery/revocation, workspace boundaries, signed intake, shipment/order reads/search, reviews/history, notification opt-in, Assistant retrieval, analytics/export, purchase/receipt idempotency and inventory effects passed isolated qualification. No approved production accounts exist, so authenticated production mutations were not used for testing.
- **122** desktop/mobile browser checks and **10** paired real-stack browser workflows passed for this exact source pair. The backend passed **22** Node tests, **12** .NET tests, PostgreSQL/gateway/completion checks, mutation sensitivity, production boot/origin checks, dependency audits and a populated restore drill. All five images published for ARM64 and AMD64.
- A native Oracle restore rehearsal passed **31 authenticated workflow requests** with restricted roles in an internal Docker network with outbound connectivity blocked. It proved disabled adapters, durable disabled outbox state, cross-workspace denial and exactly-once receipt inventory effects. The retained scoped rollback image also reached ready and rejected anonymous requests with these roles. Temporary rehearsal containers and network were removed. [Native receipt](native-role-rehearsal.json).
- Published canonical UI smoke passed **16 checks on each of desktop/mobile**, including actual WebGL orbit/zoom/rotation, reduced motion, descriptive charts, local demo exports, review evidence, Assistant, integrations, navigation and all themes. **Zero production API writes and zero browser page errors.** Screenshots were visually reviewed. [Browser receipt](live-browser-smoke.json), [desktop globe](desktop-live-globe.png), [mobile globe](mobile-live-globe.png).

## Production configuration and preservation

The approved `imsop_node_runtime` and `imsop_supply_runtime` service logins replaced database-owner runtime connections. Persistent DDL, deletion, provisioning/control-table writes, migration writes and cross-service business data are denied. The schema owner remains only in protected operator/migration configuration. Credential files and deployment secrets stay on Oracle in mode-0600 files; no production credentials were exported locally.

`FORECAST_ENABLED`, `SAP_ENABLED`, `ServiceBus__Enabled`, `EMAIL_NOTIFICATIONS_ENABLED`, `RUN_NODE_MIGRATIONS` and `Database__AutoMigrate` are all **false**. The sole allowed origin is `https://imsop-app.vercel.app`. Existing database destinations, signing/encryption/mail keys and reset route are retained. The final container is healthy with **zero restarts**, uses `127.0.0.1:11001` and the existing ingress network, and sibling container identities were unchanged during promotion. [Installed runtime](installed-runtime-final.json), [role policy](runtime-role-policy.cjs).

A consistent PostgreSQL 18 custom-format backup was taken on Oracle before this promotion and restored for the native rehearsal. It remains protected at `/opt/imsop-app-backend/release-d577908-20261028/database-before-hardening.dump`, SHA-256 **4f6bdbb4869d7d2ab7471bead445cb14302299bb95158add69e1b3196c39f596**. Exact pre-promotion manifests and runtime configuration are retained in the same root-only release directory. No new schema migrations were required beyond the earlier documented Node 001–005 and .NET durable-order/receiving migrations. Forward schemas and existing data were preserved. The earlier pre-migration dump and managed snapshot remain available; see the historical receipt for their recovery points.

The actual Oracle target's read-only final counts remain **0 users, 0 workspaces, 0 memberships, 0 unassigned shipments and 0 unassigned orders**. No production identities, memberships, roles for application users, workspace associations, record ownership or connector assignments were created or inferred. The [private provisioning review draft](../../.private-remediation/production-provisioning-review-20261028.json) is non-executable, contains the target fingerprint/counts and leaves all unsupported assignments blank. [Public review template](../../imsop-app-backend/docs/provisioning-review.template.json).

Existing Gmail TLS/SMTP authentication was verified with **zero messages sent**. No inbox-delivery guarantee is claimed. No paid services, provider resources, subscriptions or guessed integration targets were introduced. Unused Docker build cache was removed to resolve the VM's low-space condition; images, containers, volumes, backups and sibling applications were preserved. More than 21 GiB remained free after the final image pull.

## Separate pending configuration

| Item | Pending input and current behavior |
| --- | --- |
| Production provisioning | No account emails, workspace names, application roles or organization mappings are approved. Preserve legacy IDs and keep unassigned records inaccessible through ordinary workspace APIs. Review and separately authorize an explicit evidenced plan before application. |
| Forecast activation | No approved provider URL/name, credential reference or source observations. Disabled; descriptive charts and labelled demonstrations continue to work. |
| Service Bus activation | No approved queue, namespace or credential reference. Disabled; orders/outbox remain durable and expose actual stored states. |
| SAP activation | No approved service root, credential reference, workspace allowlist or business entity mapping. Disabled; implemented support is read-only metadata inspection, not business synchronization. |
| Operational mail | Remains disabled pending explicit workspace/user opt-in and authorized activation. Existing recovery transport authentication is verified; no production message was sent. |

Implemented and tested adapter support does **not** establish a verified production connection. Production provisioning and external activation are not marked complete.

## Publication, source and rollback

GitHub Pages was unpublished at the owner's request; its public URL returns **404**, the workflow was disabled and removed from main, and the Pages CLI dependency was removed. `deploy.sh` now dispatches the qualified Vercel workflow. Automatic Vercel Git production publishing on main remains disabled. [Pages receipt](pages-retirement.json).

- [Backend final main CI and all five image publications](https://github.com/DruHustle/imsop-app-backend/actions/runs/40702622591): success. [Log](backend-final-main-ci.log).
- [Frontend qualification and Vercel production publishing](https://github.com/DruHustle/imsop-app-frontend/actions/runs/40702676806): success, attempt **3**. Successful qualification jobs were retained when rerunning only publishing. [Publishing log](frontend-final-publish.log), [qualification log](frontend-final-qualification.log).
- Merged [backend adapter support #7](https://github.com/DruHustle/imsop-app-backend/pull/7), [gateway identity regression fix #8](https://github.com/DruHustle/imsop-app-backend/pull/8), and [frontend completion #12](https://github.com/DruHustle/imsop-app-frontend/pull/12). Both original clean local main worktrees were fast-forwarded, preserving history and untracked configuration. [Local source receipt](local-source-state.json).

Native acceptance caught an omitted gateway capability before promotion; the shared identity and regression coverage were fixed and fully requalified. The first final frontend attempt correctly stopped against the older Oracle revision. After Oracle promotion, the second deployed successfully but its immediate canonical check observed the old alias during propagation. Independent strict verification then passed; the third publishing attempt and its final check passed without weakening assertions. The failed observations are retained as evidence.

**Rehearsed backend rollback:** `def73e5418909341c38c98b54eb8e2c905dd6b35`, ARM64 manifest `sha256:68a33836b22888a4ec214d5ac57cf1deedf958b16244cdae61b5b3c104f8ee48`. Saved manifest: `/opt/imsop-app-backend/release-d577908-20261028/installed-before-compose.yaml`; pair it with the **current** `/opt/imsop-app-backend/compose.runtime.json` to preserve restricted roles, keys and disabled migrations. Keep the forward schema/data. Coordinate with frontend `ee9c207154a6f90523cfe50adf90972356a7b9a5`, recorded by the prior successful deployment `https://imsop-lm9mrajwk-druhustles-projects.vercel.app`. Frontend rollback promotion and post-promotion verification would be a separate operation; no production rollback was needed.
