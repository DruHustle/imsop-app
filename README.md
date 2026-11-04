# Smart Logistics app

- `smart-logistics-frontend/` contains the responsive frontend.
- `smart-logistics-backend/` contains the Node API, .NET services and backend deployment tooling.
- `local-tools/` contains local tools, release evidence and consolidated release checks.

Both original Git histories are retained. The root workflows now qualify both applications from **one consolidated commit**, including PostgreSQL/gateway tests, browser workflows, dependency audits and a disposable database restore drill. Component `.github/workflows` directories have been removed; GitHub Actions only uses the root workflows.

See [consolidated release and retirement gates](docs/CONSOLIDATED_RELEASE.md) before publishing. The two manual root publication workflows replace component-repository dispatch and cross-repository `main` lookups. They do not install a backend on Oracle, migrate a database, change DNS, configure Vercel/Resend, or prove a production rollback.

**Production migration remains gated.** Keep `DruHustle/imsop-app-frontend` and `DruHustle/imsop-app-backend` intact until the consolidated deployment, authenticated acceptance, compatible rollback rehearsal and external dependency audit all have recorded passing evidence. A green source check or a published image is not that evidence.

Public website: **https://logistics.onesa.eu**. See [naming and compatibility](docs/SMART_LOGISTICS_RENAME.md) for the repository rename and preserved recovery identifiers.
