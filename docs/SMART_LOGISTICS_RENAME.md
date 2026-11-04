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
- The existing Vercel project must use this canonical repository and
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

The retention helper accepts both the historical `IMSOP backend` image title
and the new `Smart Logistics backend` title. Exact repository ownership,
container protections, the deployment lock and the compatible rollback
requirement still apply. Do not rename live state with global string replacement.
Existing website path aliases continue to work. The old API route remains in
baseline routing until the destination backend and `logistics-api.onesa.eu`
have passed qualification; deployment preparation sets the verified route.

Only `DruHustle/imsop-app-frontend` and `DruHustle/imsop-app-backend` are the
separate legacy component repositories eligible for eventual retirement.
Their exact names/IDs and preservation gates remain unchanged.
