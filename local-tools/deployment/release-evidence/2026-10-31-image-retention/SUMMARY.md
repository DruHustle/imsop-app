# IMSOP image retention — 31 October 2026

Removed **22 obsolete local images** and **5 obsolete Oracle images**. No unused IMSOP cleanup candidates remain on either host. The running application was not redeployed or restarted; the exact qualified Oracle/Vercel release still passes its strict version/readiness/anonymous-access verifier.

Oracle retains only its running ARM64 image `sha256:e15bf05050a762b720b1e6016e6a13fbca9b9ee723794dd119a5be6768791839` and the rehearsed compatible rollback `sha256:68a33836b22888a4ec214d5ac57cf1deedf958b16244cdae61b5b3c104f8ee48`. The local cache retains the qualified `def73e5` release index plus the four images referenced by the development containers. Images belonging to unrelated projects, all containers, volumes, database data and backups were preserved. No registry artifacts were deleted. Physical layer reclamation is shared and is not represented by the sum of image sizes.

[Machine receipt](receipt.json), [local reviewed plan](local-plan.json), [all 22 local IDs verified absent](local-removal-verification.json), [local final protection check](local-cleanup.json), [Oracle removals](oracle-cleanup.json), [Oracle final inventory](oracle-final-plan.json), [unchanged live application](live-release-verification.json).

## Future deployments

Merged [backend PR #9](https://github.com/DruHustle/imsop-app-backend/pull/9), source commit `e70a70de22bd0bc241d3580a329d936145647951`. The clean local main includes the deployment/cleanup tools, mandatory repository instructions and updated Oracle/local runbook. Application code and the deployed runtime image are unchanged by this operational update.

Use [scripts/deploy_compose.py](../../imsop-app-backend/scripts/deploy_compose.py) for local and Oracle Compose deployments, following [the runbook](../../imsop-app-backend/deploy/oracle/README.md). It captures the previous service images, waits for readiness, checks API contract 2 and the exact production revision, then records current/rollback identities and removes older unused IMSOP images. The previous verified image is retained per changed service. An unchanged service preserves its rollback. Failed deployment/verification does not run cleanup.

The same scripts are installed in `/opt/imsop-app-backend/tools/` on Oracle. Its mode-0600 `.image-retention.json` is seeded with the verified current/rollback pair. Scripts and existing release operations share `.deployment.lock`. [Installed file checksums and policy](installed-tools.json).

Standalone [scripts/image_retention.py](../../imsop-app-backend/scripts/image_retention.py) defaults to dry-run and requires explicit retained images. Cleanup recognizes exact IMSOP repositories or the exact IMSOP backend title, protects running/stopped containers and shared aliases, handles platform/reference aliases, retries complete snapshots and rechecks protection before each deletion. Images are removed by immutable ID without force or parent/global pruning. Missing rollback or unconfirmed protection stops cleanup; Docker refusal/timeouts are reported without overriding protection. No scheduled global Docker cleanup was installed.

## Validation and operational note

All **16 safety tests** passed locally and in [retention CI](https://github.com/DruHustle/imsop-app-backend/actions/runs/41145725735). [Backend PR qualification](https://github.com/DruHustle/imsop-app-backend/actions/runs/41145725949), including the real PostgreSQL/gateway and recovery checks, passed. [Tests](tests.log), [CI test log](retention-ci.log), [qualification log](qualification-ci.log).

The first local apply removed the reviewed images but failed while taking its final container snapshot. A subsequent complete protection snapshot succeeded with all 80 containers unchanged during that verification pass, no additional removals and no remaining obsolete candidates. All 22 planned immutable IDs were separately verified absent. The Oracle cleanup recorded all 14 container identities unchanged and readiness healthy. The snapshot retry added for this case is bounded and never accepts partial protection data.

Earlier release receipts describe additional images that were retained at that time. Those superseded images are now retired from local/Oracle caches. Use the current/rollback pair above and the latest release's saved manifest; older images remain recoverable from the existing registry where published.
