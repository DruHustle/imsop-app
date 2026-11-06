# Read-only production preflight

The consolidated source qualification and a healthy public landing page do not prove that the consolidated revision is installed, that the new browser origin is allowed, or that rollback works. The preflight records those distinctions without creating test accounts, reading customer records or changing the running system.

Run from the consolidated repository using Node 22:

```sh
node --test local-tools/ci/production-preflight.test.mjs
node local-tools/ci/production-preflight.mjs \
  --web-origin https://logistics.onesa.eu \
  --api-origin https://logistics-api.onesa.eu \
  --revision "$(git rev-parse HEAD)" \
  --out public-preflight.json
```

The default API is the qualified Onesa destination. The diagnostic still verifies the actual serving revision and origin policy on every run; a configured domain does not establish current acceptance. Both origins must be HTTPS origins without embedded credentials, paths, query strings or fragments. Requests never follow redirects or send authentication, cookies or protection-bypass headers.

The script reads only public release/version/readiness objects (bounded to 64 KiB). It probes shipment and purchase-order endpoints with no credentials, with the selected browser Origin, and with an untrusted negative-test Origin. It never reads operational response bodies, including an unexpected successful response. The gateway's empty ASP.NET Bearer challenge is recognized; an HTML deployment-login response is not confused with application authentication rejection. Evidence contains selected status/revision/boolean fields, not raw environment variables, response bodies, errors, cookies or secrets.

`production-preflight.yml` runs on changes to the diagnostic and by manual dispatch. It uses GitHub's network rather than a chat execution environment, with a read-only checkout and no production secrets. Its success means evidence was collected, not that release conditions passed. Inspect the report's `status`, `baselinePassed`, `originPolicyPassed`, `candidateRevisionMatched`, `apiChecksPassed` and `publicChecksPassed`. A blocked report is also highlighted in the job summary and a warning.

## Enforcement in the frontend release workflow

`deploy-frontend.yml` runs the preflight with **`--enforce-api` before staging and immediately before promotion**. The direct API must serve the exact consolidated SHA, required contract/capabilities, healthy dependencies, anonymous denial, the actual production browser Origin with credential support, and rejection of the negative-test Origin. These checks have no deployment credentials or bypass headers. They do not use the preview hostname as the approved production Origin.

At this point the previous frontend may correctly still be serving. Therefore the API-only gate checks `apiChecksPassed`, independently of the old frontend identity; it does not claim the entire candidate release is already live. The existing exact backend checks and staged ownership/source/proxy gates remain required.

After promotion the workflow uses **`--enforce`**, which requires the full public release to match and pass, including the first-party proxy. The workflow retains sanitized before-stage, before-promotion and after-promotion reports. It never treats successful diagnostic collection as permission to deploy.

Without either enforcement option, the command is diagnostic and returns zero after writing a report even when blocked. `--enforce` exits nonzero if `publicChecksPassed` is false; `--enforce-api` exits nonzero if `apiChecksPassed` is false. Supplying both requires both to pass.

Neither mode performs or proves authenticated user acceptance, database migration, server identity, deployment, a rollback exercise, or repository dependency reconciliation. `authenticatedAcceptance` and `rollbackVerification` remain `not-run`, and `retirementEligible` is always false. Follow [the consolidated release procedure](CONSOLIDATED_RELEASE.md) for those separate requirements.

## Historical promotion helpers

The historical scripts under `local-tools/deployment/release-evidence/2026-10-28-completion/` are retained evidence for that dated release. In particular, `imsop-promote-completion.py` expects an October 28 release directory and a matching role-rehearsal receipt. Do not run it blindly against a new revision or a different VM. Use the current verified host, private manifests, backups and deployment lock; retain both legacy repositories until deployment and compatible rollback have actually passed.
