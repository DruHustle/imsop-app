# Oracle backend

The current source prepares independent Smart Logistics ingress at
`https://logistics-api.onesa.eu`. It does not install a service, change provider
configuration or move live traffic. Inspect the authorized destination and its
existing private runtime before staging this candidate.

- Retained Compose project/service: `imsop-app-backend` / `app`
- Retained application alias: `imsop-app-backend-api`
- Logistics-owned Compose network: `imsop-app-backend-runtime`
- Readiness: `/ready`; liveness: `/health`
- Diagnostic port: `127.0.0.1:11001` (never public)
- Independent connector: `onesa-logistics-tunnel.service`

The app keeps its existing pinned image selection, resources and loopback mapping
`127.0.0.1:11001:10000`. The optional database overlay keeps the existing
`onesa-logistics-database` network. Preserve the installed runtime directory,
private manifests, `.deployment.lock`, retention policy, database identities,
queues and credentials; an ingress change does not relocate or copy them.

## Historical source binding — October 2026

The October deployment used the separate **Software Engineering Backend** VM,
hostname `software-engineering-backend`, ARM64, at `152.70.22.84`, with runtime
directory `/opt/imsop-app-backend`. Its API was
`https://imsop-api.152-70-22-84.sslip.io`, and the initial source revision was
`6eff140eafb7d9455a957ad86354fe5b157b1591`. The former external network
`imsop-app-backend-ingress` exposed `imsop-app-backend-api:10000` to Caddy under
`/opt/smart-factory-basyx`. These identifiers explain the dated receipts. They
are not the current ingress or rollback procedure, and do not prove what still
runs on either VM.

## Build and deploy

Run the repository checks first. Build a clean checkout for ARM64 using
`docker build --platform linux/arm64 --build-arg APP_REVISION=<sha> -f deploy/oracle/Dockerfile -t imsop-app-backend:oracle-<sha> .`.
For Smart Logistics, the existing Dockerfile starts the .NET gateway, operations and supply
chain services plus the Node API; all internal service ports stay private.
The ARM64/amd64 runtime base is pinned to the Microsoft .NET 8 Ubuntu 24.04
image index; qualify and scan image updates before replacing that digest.
Exclude local environment files, `.git`, dependencies, build output and private
files from the context. Transfer with `docker save`, verify the archive checksum
and load with `sudo docker load` on the VM. No registry credentials are needed.

Back up the installed manifest before updating its pinned image. Production
variables live in mode-600 `compose.runtime.json`, an untracked environment
override preserving the existing managed database, signing keys, CORS origins
and provider configuration. This candidate does not copy or delete a database. Never print or
commit this file. JSON strings must escape `$` as `$$` for Compose interpolation.

From the runtime directory, validate with
`sudo docker compose -f compose.yaml -f compose.runtime.json config --quiet`,
then update through the retention-aware deployment command below.
If using this repository template directly, set `APP_IMAGE` to the tested tag.
Verify readiness, anonymous authentication rejection and allowed/denied origins
through both Oracle HTTPS and the frontend. Do not run destructive database
migrations or create production users to test deployment. Keep CORS restricted
to the actual production frontend origins; do not use a wildcard.

## Independent tunnel candidate

[`onesa-logistics-tunnel.service`](onesa-logistics-tunnel.service) runs the pinned
`/usr/local/lib/onesa-tunnel/cloudflared-2026.10.3` binary with a dedicated
`DynamicUser`. Systemd loads the dedicated root-owned credential from
`/etc/onesa/backends/tunnel-logistics.token` using `LoadCredential`; do not place
the token in this checkout, a command argument or release evidence. The unit
opens no inbound port 80 or 443 and requires no Factory or Portal application,
checkout, runtime configuration or certificate state. Its unit/binary layout
follows the shared Onesa host tunnel pattern; that platform provenance is not a
Portal application dependency.

The approved raw Linux ARM64 binary is the
[official cloudflared 2026.10.3 release](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.3),
37,652,905 bytes, SHA-256
`89297ebfb9e8c99c0dc013a1140601453cf3798d8306c5591651f4a3f5210be8`.
The checker verifies this exact asset and its installed custody; it has no
caller-supplied checksum bypass. A package archive or another architecture is
not this binary.

[`tunnel-config.json`](tunnel-config.json) is a **remotely managed Cloudflare
provider configuration payload**, not a local cloudflared configuration file.
It defines exactly `logistics-api.onesa.eu` to `http://127.0.0.1:11001`, followed
by a terminal HTTP 404 rule, with private WARP routing disabled. Select the
existing approved account and dedicated Logistics tunnel through authorized
provider access; no account ID, tunnel UUID or token is guessed by these files.
Installing the unit does not apply this provider payload or create a DNS route.

### Read-only checks

Run from the backend source directory:

```sh
python3 scripts/check_logistics_ingress.py
```

This validates the source payload only. For a provider configuration comparison,
obtain a fresh authorized
[configuration GET response](https://developers.cloudflare.com/api/resources/zero_trust/subresources/tunnels/subresources/cloudflared/subresources/configurations/methods/get/)
for the independently selected account and tunnel, and keep it outside the
checkout. Record its retrieval time and provenance privately. A configuration
creation timestamp is not its capture time. Supply the full API response,
including `result.account_id`, `result.tunnel_id` and `result.source=cloudflare`:

```sh
python3 scripts/check_logistics_ingress.py \
  --provider-config /private/path/PRIVATE_API_GET_RESPONSE.json \
  --account-id REVIEWED_ACCOUNT_ID --tunnel-id REVIEWED_UUID
```

On the selected Linux ARM64 host, existing authorized root access can add local
unit, binary and container prerequisite checks:

```sh
sudo python3 scripts/check_logistics_ingress.py \
  --provider-config /private/path/PRIVATE_API_GET_RESPONSE.json \
  --account-id REVIEWED_ACCOUNT_ID --tunnel-id REVIEWED_UUID \
  --check-host --expect-revision FULL_BACKEND_SHA
```

Host checks use the fixed local Docker socket, require Docker Engine 28 or newer,
and compare the installed unit, approved binary custody and selected Logistics
container/network against the reviewed source and exact application revision.
The credential file is checked through metadata without reading its token.
The checker installs or restarts nothing and performs no provider, DNS,
configuration, token or secret writes. Supplied provider JSON establishes only
snapshot consistency; the checker does not independently authenticate its
provenance or freshness. Every mode explicitly reports `liveVerified=false`.

Commissioning still requires the provider connector to be bound to the selected
account/tunnel and actual host; correct DNS and public TLS; refusal of external
access to the loopback origin, including from another host on the local network;
forwarded-header spoofing and rate-limit checks; and approved cookie, CORS,
session, role and cross-workspace browser acceptance through the first-party
frontend proxy. Test independent rollback as described below. Source checks or a
healthy connector alone do not satisfy these gates.

## Network cutover and independent rollback

Stage and review the merged manifest before changing the installed network.
Preserve all selected private overrides and any qualified database overlay;
blindly replacing `compose.yaml` can retain an old network through an override
or remove required connectivity. Keep the existing directory and deployment
lock, record the current image/manifest and review the application recreation
needed for the network change. Coordinate one active application writer and
dispatcher; do not start a second copy against an unreviewed database or duplicate
queues. Preserve database endpoints, roles, durable volumes and encryption keys.

Before cutover, retain and rehearse a previous compatible Logistics image with
an independent Logistics manifest and its Logistics-only tunnel route. Restore
that image/manifest through the same deployment lock, retaining the private
runtime and qualified database state, then check exact revision, readiness and
scoped browser acceptance. The route remains the dedicated Logistics connector
to the loopback gateway. A historical manifest tied to the Factory edge must be
adapted and independently qualified as a rollback candidate before use; keep its
original receipt intact. Rollback must not require starting Factory, restoring
its edge configuration or reading another application's certificates. Database
rollback or reconciliation after new writes remains a separate reviewed action.

Oracle releases remain independent from frontend releases. The October 2026
runbook recorded the former Render service suspended with automatic deployment
disabled; that historical status is not a currently verified rollback route.
No live tunnel, provider, DNS or application cutover is performed by this source
change.

## Remediation release verification

The immutable build label and `/version` must agree with the backend SHA in the release manifest. `/health` is liveness; `/ready` now checks required Node migration and service readiness. A historical healthy result is not a revision receipt. Build using an exact committed source and retain the OCI manifest digest from `--metadata-file`; inspect `docker image inspect --format '{{.Architecture}} {{index .Config.Labels "org.opencontainers.image.revision"}}' IMAGE` before transfer.

Recovery requires `RESET_DELIVERY_KEY` (64 hex characters, kept in the existing secret mechanism) in addition to the existing mail and reset-URL settings. Run Node migrations separately with `MIGRATION_DATABASE_URL`; runtime migration is disabled unless `RUN_NODE_MIGRATIONS=true`. Apply the separate .NET EF upgrades under their schema owner, then leave production `Database__AutoMigrate=false`. See [provisioning](../../docs/PROVISIONING.md) before assigning historical rows or restoring internal-user access.

Record installed image digest, mounted manifest identity and observed `/version` after an authorized rollout. Check first-party browser cookies, a permitted source read, a cross-workspace denial and report permissions using approved non-customer test accounts only. Backend compatibility precedes frontend release. Keep all internal ports private; the existing diagnostic mapping remains loopback-only. No provider accounts or customer records are needed for isolated qualification.

Rollback rehearsal uses a previous **compatible scoped** image on the isolated stack, verifies version/readiness, then restores the candidate. Preserve migrations, outbox messages and operational records. An earlier image that exposes unassigned operational rows is not a safe security rollback. A destructive migration reversal is never implied by image rollback.

## Image retention after every deployment

Keep the installed release and one rehearsed compatible rollback. Once a deployment
passes readiness and exact revision verification, discard older unused Smart Logistics
images on both the development host and Oracle. Do not retain every historical
release or rejected candidate. Shared base layers may remain while still used.

Install `scripts/image_retention.py` and `scripts/deploy_compose.py` together in
the existing Logistics runtime's `tools/` directory on Oracle. Keep the current
runtime location and lock rather than creating a second installation. After
qualification, backup, migration and rollback rehearsal, pin the new image in
the existing manifest. From that verified runtime directory, retaining any
additional qualified Compose files in the command, run:

```sh
sudo python3 ./tools/deploy_compose.py \
  --project-directory . \
  --file compose.yaml --file compose.runtime.json --service app \
  --origin http://127.0.0.1:11001 --expect-revision FULL_BACKEND_SHA
```

For the local development Compose stack, run from the backend repository:

```sh
python3 scripts/deploy_compose.py --file docker-compose.yml \
  --origin http://127.0.0.1:8080 --build
```

The command snapshots each service's previous image before updating, waits for
Compose and gateway readiness, and verifies contract 2 plus the exact SHA on
Oracle. Only then does it update the mode-0600 `.image-retention.json` policy and
remove older images. An unchanged service keeps its prior rollback. Failed
deployment/verification leaves the existing policy and images intact. Both tools
use `.deployment.lock`, shared with the existing Oracle release tooling. Keep the
policy across releases; missing rollback images stop cleanup rather than guessing.
This command does not replace qualification, backups, migration procedures or
compatibility rehearsal. Use the saved manifest to roll back if promotion fails.

When relocating to an approved destination with no Logistics containers, retain
the reviewed source `.image-retention.json` with both referenced image archives,
verify their transfer, and preserve the policy's private ownership and permissions.
If the first destination release changes the saved current image, that image is
retained as rollback; installing the same image retains its existing rollback.
An observed destination container takes precedence over the saved current field.
A missing retained image stops policy replacement and cleanup; the tool does not
silently select an older fallback. This retention behavior does not establish
host identity, migration completion or rollback compatibility. Those require the
source/destination, runtime, data and acceptance checks above.

To review cleanup without deploying or restarting anything, use the cleanup tool
with explicit installed current and rollback references. It defaults to a dry run:

```sh
python3 scripts/image_retention.py --keep CURRENT_IMAGE --keep ROLLBACK_IMAGE
# After reviewing the plan, repeat with --apply.
```

Cleanup recognizes only the explicit Smart Logistics repository names and the exact
`Smart Logistics backend` or historical `IMSOP backend` image title. Every running or stopped container's image is
protected, including platform-manifest aliases. Images shared with other
repositories are retained. Ownership and references are checked again immediately
before removal by immutable ID, without `--force` or parent-image pruning.
Docker conflicts are reported, never overridden. Containers, volumes, database
data, backups, registry artifacts and unrelated applications are not removed.
No global `docker system prune` or `docker image prune -a` is used.
