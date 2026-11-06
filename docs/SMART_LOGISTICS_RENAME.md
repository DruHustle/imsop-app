# Smart Logistics naming and compatibility

The canonical repository is `DruHustle/smart-logistics` (GitHub repository ID
1444796010). Its previous `DruHustle/imsop-app` URL redirects to this same
repository. It is never an additional obsolete repository to delete.
The product is **Smart Logistics**, at **https://logistics.onesa.eu**.
New transactional messages use
`Smart Logistics <notifications-logistics@onesa.eu>` once the deployed sender
and queues have been qualified.

## Active source and release configuration

- Source roots: `smart-logistics-frontend/` and `smart-logistics-backend/`.
- .NET solution/assemblies/namespaces: `SmartLogistics`.
- GitHub release variables: `SMART_LOGISTICS_WEB_ORIGIN` and
  `SMART_LOGISTICS_API_ORIGIN`. Use verified routes; no credentialed wildcard.
- Vercel project: `smart-logistics` (ID `prj_W9oH4fYMiTNlb7MAu0wKFoKFuQYE`).
  Its retained `imsop-app.vercel.app` domain is a compatibility alias; the public
  canonical website remains `https://logistics.onesa.eu`.
- This Vercel project must use the canonical repository and
  `smart-logistics-frontend` as its root during the qualified cutover. Preserve
  its project ID, domains, protections and retained deployments.
- Production publication still requires the exact canonical main SHA, full CI,
  hosted acceptance, compatible rollback and an observed matching backend.

## Stable compatibility identifiers

Changing a product name must not invalidate sessions, lose private files, fork
production databases, start a duplicate writer, or invalidate recovery evidence.
These legacy identifiers intentionally remain until an explicitly qualified
protocol/storage migration replaces them:

- Existing `imsop_access` cookies, JWT issuer/audience strings, browser storage
  keys/events, demo fixture identities and edge protocol/schema identifiers.
- Existing managed database names/roles, migrations, runtime Compose project,
  host directories/networks, GHCR package names and immutable image digests.
- Existing Backblaze bucket/object paths and encrypted recovery manifests.
- Historical release receipts, verification logs and archived source snapshots.
  Their original bytes and names describe the releases that actually ran.

The retention helper accepts the exact local image repository
`smart-logistics-backend` as well as the retained legacy repository names. It
also recognizes both the historical `IMSOP backend` image title and the new
`Smart Logistics backend` title for untagged images. Exact repository ownership,
container protections, the deployment lock and the compatible rollback
requirement still apply. Do not rename live state with global string replacement.
Existing website path aliases continue to work. The baseline Vercel rewrites and
deployment preparation now use the qualified `https://logistics-api.onesa.eu`
destination. Browser requests stay on the frontend origin; the Vercel proxy owns
API routing. Retained historical deployments keep their original configuration
for rollback and must be checked before retiring the previous host.

Only `DruHustle/imsop-app-frontend` and `DruHustle/imsop-app-backend` are the
separate legacy component repositories eligible for eventual retirement.
Their exact names/IDs and preservation gates remain unchanged.

Historical SQL migration files retain their exact original bytes, including names
in comments, because existing database ledgers validate the full file checksum.
The root CI protects the eight migrations released before this rename. Schema
changes must use a new forward migration rather than editing those files.
