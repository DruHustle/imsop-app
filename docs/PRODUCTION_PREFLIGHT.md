# Read-only production preflight

The consolidated source qualification and a healthy public landing page do not prove that the consolidated revision is installed, that the new browser origin is allowed, or that rollback works. The preflight records those distinctions without creating test accounts, reading customer records or changing the running system.

Run from the consolidated repository using Node 22:

```sh
node --test local-tools/ci/production-preflight.test.mjs
node local-tools/ci/production-preflight.mjs \
  --web-origin https://logistics.onesa.eu \
  --api-origin https://imsop-api.152-70-22-84.sslip.io \
  --revision "$(git rev-parse HEAD)" \
  --out public-preflight.json
```

The example API is the historically documented serving origin, not a claim that the Onesa migration is complete. Use the actually verified API destination after migration. Both origins must be HTTPS origins without embedded credentials, paths, query strings or fragments. Requests never follow redirects or send authentication, cookies or protection-bypass headers.

The script reads only public release/version/readiness objects (bounded to 64 KiB). It probes shipment and purchase-order endpoints with no credentials, with the selected browser Origin, and with an untrusted negative-test Origin. It never reads operational response bodies, including an unexpected successful response. The gateway's empty ASP.NET Bearer challenge is recognized; an HTML deployment-login response is not confused with application authentication rejection. Evidence contains selected status/revision/boolean fields, not raw environment variables, response bodies, errors, cookies or secrets.

`production-preflight.yml` runs on changes to the diagnostic and by manual dispatch. It uses GitHub's network rather than a chat execution environment, with a read-only checkout and no production secrets. Its success means evidence was collected, not that release conditions passed. Inspect the report's `status`, `baselinePassed`, `originPolicyPassed`, `candidateRevisionMatched` and `publicChecksPassed`. A blocked report is also highlighted in the job summary and a warning.

For use as an explicit public release gate, add `--enforce`; a blocked result then exits nonzero. Without it the command is diagnostic and returns zero after successfully writing a report. Neither mode performs or proves authenticated user acceptance, database migration, server identity, deployment, a rollback exercise, or repository dependency reconciliation. `authenticatedAcceptance` and `rollbackVerification` remain `not-run`, and `retirementEligible` is always false. Follow [the consolidated release procedure](CONSOLIDATED_RELEASE.md) for those separate requirements.

The historical scripts under `local-tools/deployment/release-evidence/2026-10-28-completion/` are retained evidence for that dated release. In particular, `imsop-promote-completion.py` expects an October 28 release directory and a matching role-rehearsal receipt. Do not run it blindly against a new revision or a different VM. Use the current verified host, private manifests, backups and deployment lock; retain both legacy repositories until deployment and compatible rollback have actually passed.
