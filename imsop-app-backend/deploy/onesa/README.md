# Onesa Logistics migration candidate

These files prepare `https://logistics.onesa.eu` and the requested Onesa UG
backend consolidation. They are **source candidates**. They do not change the
serving backend, databases, release tooling or image
retention policy.

## Application domain, identity and email

Merge relevant fields from `runtime.env.example` into the existing private
runtime configuration; it is deliberately incomplete. Preserve JWT signing
material, the independent 64-hex `RESET_DELIVERY_KEY`, workspace ownership,
provider/webhook identities, scoped integrations and process ports. Keep actual
runtime files, keys, certificates and dumps outside the checkout and image
contexts. URL-encode URI credentials and preserve the existing runtime's escaping.

Both `ALLOWED_ORIGIN` and `CORS_ALLOWED_ORIGINS` identify
`https://logistics.onesa.eu`. `PASSWORD_RESET_BASE_URL` uses the actual
`https://logistics.onesa.eu/#/reset-password` route. Preserve the existing
first-party frontend API proxy. Qualify cookies, allowed/denied origins, session
revocation, cross-workspace denial, recovery delivery, exact `/version` and real
`/ready` responses before cutover.

Resend uses `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and **`EMAIL_FROM`**,
not `RESEND_FROM`, in this application. The requested single-domain sender is
`Onesa Logistics <notifications-logistics@onesa.eu>`. Verify the exact `onesa.eu`
sending identity and that the selected API key is authorized for it before updating
the private runtime. An existing `mail.onesa.eu` identity does not establish that
this requested address is configured. Preserve inbound MX and unrelated sender
identities; obtain the required sending DNS values from the actual provider.
No domain provisioning, API key or email delivery is qualified by these examples.
Operational notifications remain off for the candidate and require the existing
workspace opt-in; recovery delivery is qualified separately.

A successful landing page, `/health` or `/ready` response does not establish that
the new browser origin is accepted. Verify the actual deployed Node and .NET
allowlists with the exact `https://logistics.onesa.eu` origin, reject an unrelated
origin, and complete the existing session and recovery acceptance through the
first-party proxy. Read-only preflight checks can inspect the allowlist before
authorized authenticated acceptance; they do not prove login or mail delivery.

Node and .NET retain separate database owners and migration histories. Apply
reviewed forward migrations through their existing separate migration principals;
both runtime migration switches remain false. The examples preserve an external
`DATABASE_URL` option with verified TLS, and .NET uses `SSL Mode=VerifyFull`.
The CA path must be provisioned into the actual app image/runtime. Use scoped
non-superuser runtime credentials; never put migration credentials in this sample.

## Optional PostgreSQL container

`compose.database.yaml` is a separate, unapplied Compose project with the
`candidate-database` profile. It joins only an internal database network and
publishes no host ports. Its external named volume must already exist on reviewed
durable storage; Compose does not create a differently named replacement or own
its deletion. Never prune data volumes. A volume on the same VM is not an
independent backup.

The optional `compose.application-database.yaml` adds only the database
network and a read-only CA certificate mount to the retained Oracle `app`
service. The existing explicit ingress network remains through Compose merging.
It changes no app image, environment, port or dependency. The mounted CA path
`/run/onesa-db-ca/root.crt` is referenced by both Node and .NET examples.
For an existing external provider, preserve its qualified TLS/secret mechanism;
do not attach this candidate network merely to change a hostname.

Restore the Node public schema and .NET schema/ledgers under their separate
owners. Preserve users, workspace mapping, recovery material, leases, outbox and
provider identities. A successful empty-container startup is not a migration.
After an actual verified deployment, follow `scripts/deploy_compose.py` and the
existing image-retention policy with the same deployment lock. Keep compatible
current/rollback images and every image used by any container; never globally
prune or remove data volumes.

Before starting even an isolated candidate:

1. Inspect the source PostgreSQL major version, extensions, encoding, collation,
   database names and roles. Pin an official `postgres` image **by digest**,
   with its actual platform and named postgres UID/GID. No image version,
   architecture, UID, capacity or volume is selected in these examples.
2. Measure CPU, memory, shared memory, connection counts and storage growth.
   Complete every required field in `database.env.example`, retaining host and
   application headroom. Confirm the existing application image is compatible
   with the actual destination architecture.
3. Use a new, empty rehearsal volume preowned by the selected image's postgres
   UID/GID. The non-root container cannot repair arbitrary ownership. The data
   directory, socket directory, shared memory and /tmp are the writable paths.
   Keep the bootstrap password file and TLS key private and readable by that UID.
   Compose file-backed secrets preserve host ownership; `uid`/`mode` settings
   do not repair unreadable host files.
4. The manifest explicitly sets `PGDATA=/var/lib/postgresql/data/pgdata` beneath
   its retained mount. PostgreSQL 18+ images changed their default layout; verify
   this override with the selected image's entrypoint and fresh-start/restart
   behavior. Do not remove the override while retaining this mount or swap a
   major version over populated data. A layout/major change needs its own restore
   qualification.
5. Mount existing `server.crt` and `server.key` files before startup. The
   certificate must cover `logistics-postgres`, or the actual selected connection
   hostname. The key belongs only to the DB identity; clients receive the
   issuing CA certificate. Network sessions require TLS 1.2+ and SCRAM.
6. Bootstrap administration uses the named postgres OS identity over its local
   socket. The HBA rejects network login for the role named `postgres`; it does
   **not** identify all possible restored superusers by privilege. Audit restored
   roles and exclude/disable additional administrative logins before connecting
   applications. Never give an app a superuser connection.
7. Validate with
   `docker compose --env-file <private-env> -f deploy/onesa/compose.database.yaml --profile candidate-database config --quiet`
   from this repository. Never print resolved private configuration. The env
   file supplies Compose interpolation; it does not inject the application env
   examples into the running app. Use the existing private runtime mechanism.

Only the bootstrap postgres database is initialized. A populated PGDATA skips
bootstrap; changing `POSTGRES_*` variables does not rotate existing passwords
or migrate data. Preserve a failed initialization for inspection instead of
deleting source data. The `pg_isready` check is process readiness, and can also
answer during temporary initialization; it does not prove authenticated app
access, completed restore, TLS validation or data integrity.

## Data, release and recovery gates

Keep the existing external primary selected until a consistent backup has been
restored into a disposable candidate and verified. The app connection remains
configurable for an external database or a qualified container; this preparation
does not add double-write, replication or automatic failover.

Verify schema/migration ledgers, owners, identities and record counts; valid and
invalid CA/hostname outcomes; plaintext rejection; least-privilege app access;
restart and container-recreation persistence; and measured resource use. Restore
a backup of the candidate again. Retain encrypted database-native backups
outside the VM with separately retained decryption keys and a reviewed retention
policy. Logical dumps recover to their backup point; tighter recovery objectives
need a qualified base-backup/WAL-archive scheme. No external backup provider is
selected here. Backblaze B2, if selected later, stores backup objects and is not a
live relational database.

Pause source writers for the final copy and coordinate one active primary.
Retain source data and compatible rollback images. After new writes, reconcile
those writes before reverting a database; changing DNS alone is not a data
rollback. Keep the existing release/readiness/compatibility gates and unrelated
services intact.

## What source checks establish

`python3 scripts/test_onesa_migration_config.py --require-compose` runs boundary
checks and Docker Compose **configuration-only** checks with temporary synthetic
inputs. It does not pull/start database images, initialize a database, perform
TLS handshakes or restore data. CI validates this newly authored source; it does
not reproduce or certify the earlier unpublished local preparation.

The actual image digest, init permissions, restore, private network isolation,
mail delivery and destination runtime remain unqualified. Kubernetes installation
requires the measured host, owner access and approved operating contract. Archived
manifests do not become production-ready merely because a cluster is requested.

Primary references:
[official PostgreSQL image](https://github.com/docker-library/docs/blob/master/postgres/README.md),
[image initialization](https://github.com/docker-library/postgres/blob/master/docker-entrypoint.sh),
[PostgreSQL backup methods](https://www.postgresql.org/docs/current/backup.html),
and [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/).
