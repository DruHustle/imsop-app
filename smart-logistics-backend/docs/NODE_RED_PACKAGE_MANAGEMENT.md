# Optional Node-RED package management

Smart Logistics already owns the Node-RED/Python gateway candidate described in
[the edge guide](../edge/README.md): warehouse sensors, RFID/scanners, weighbridges,
cold rooms and truck GPS adapters feed signed, workspace-scoped observations.
This feature adds an administrator workflow for **node libraries and plugins** on
those gateways. It introduces no dependency on Smart Factory or Smart Farmer.
No gateway, package, tunnel or production environment is commissioned by merging
or deploying this code. Management defaults off.

## What an administrator can do

In the live workspace, **Preferences → Node-RED packages** lists only gateways
bound to that workspace by the existing `IMSOP_EDGE_GATEWAYS` configuration.
The browser first checks the optional `node-red-package-management-v1` capability;
an older compatible backend receives no management requests. Demo identities and
non-administrators have no management controls. The API independently requires
an unrevoked, unexpired administrator session, current role/session version,
active workspace and membership. It checks those facts again in the durable
reservation transaction and immediately before sending an installation request.

The workflow is: read inventory, enter an npm name and exact version, review that
version's registry metadata, acknowledge code execution, and request installation.
Reviews expire after ten minutes and are signed for the individual administrator,
session, workspace, gateway, runtime UUID, enrollment revision, package and version.
A different account, session, gateway configuration or version needs a new review.

Only normal npm package names (including scoped names) and exact SemVer versions
are accepted. Tags, ranges, aliases, URLs, paths, archives, arbitrary commands and
extra input fields are rejected. Metadata must declare Node-RED nodes or plugins.
The broker sends `POST /admin/nodes` with separate `module` and `version` fields.
It does not expose package removal, updates/reinstalls, flow deployment, credentials,
editor proxying, runtime restart, arbitrary Function-node dependencies or a saved
flow library. Those remain separate gateway maintenance/commissioning activities.

**Installing a package executes third-party code with the gateway runtime's access.**
It can affect existing flows, credentials and connected equipment. A restricted
HTTP broker is not isolation from package code. Registry metadata, a matching
version and an inventory read-back do not establish package trust, safe device
behavior or successful operational commissioning.

## Enroll an existing commissioned gateway

This is an operator task under the existing private-access and gateway change
process. Do not create a public Node-RED port or a new administrative network
source as part of application deployment.

1. Commission the existing Logistics edge pipeline and verify its workspace and
   source allowlist. Preserve its `/data` volume, installed package lockfile,
   `NODE_RED_CREDENTIAL_SECRET`, editor administrator, authenticated `/flows`
   endpoints and Python ingress credential. The runtime still binds
   `127.0.0.1:1882`; its admin root remains `/admin`.
2. Review and pin the supported Node-RED **4.1.4** image/version. Another runtime
   version requires an API/policy compatibility review before this version
   constraint changes. Generate a stable,
   lowercase runtime UUID and a separate cryptographically random 32-byte token
   represented as 64 hexadecimal characters in the approved secret manager.
   Set the gateway's `NODE_RED_RUNTIME_ID` and `NODE_RED_ADMIN_TOKEN` together.
   Do not reuse its flow-encryption secret, edge HMAC secret, ingress token or
   editor password. Leaving both unset retains the existing editor behavior.
3. The optional gateway policy identifies responses with
   `X-Smart-Logistics-Node-RED-Runtime`. The dedicated token grants exactly
   `nodes.read`, `nodes.write`, `plugins.read`, and `settings.read`; the separate
   editor login stays intact. The enrolled palette permits additions and rejects
   updates and archive uploads, including races with another editor. The service
   refuses a different runtime identity/version or broader credential permissions.
4. Commission a supervised private SSH forward using an already approved SSH
   identity, narrowly permitted forwarding destination and pinned host key. Its
   listener must share the **API container's network namespace**. A host-side
   loopback listener is not automatically reachable from a bridge-networked API.
   The only supported URL form is `http://127.0.0.1:PORT/admin` (or literal IPv6
   loopback with an explicit port), with no user info, query or fragment.
   DNS names, LAN/public editor URLs and browser-supplied routes are rejected.
5. If the existing Oracle Compose topology is used, the optional
   [management tunnel overlay](../deploy/oracle/compose.node-red-management.yaml)
   is a reviewable template for one gateway, with listener `127.0.0.1:18882`
   inside the `app` network namespace and remote destination `127.0.0.1:1882`.
   It requires an immutable, operator-reviewed SSH client image, non-root UID/GID,
   and a read-only private SSH configuration directory. Its config must define
   `Host logistics-node-red-gateway`, the existing destination/user, an identity
   under `/run/node-red-ssh/`, and `UserKnownHostsFile` under that same directory.
   The `node-red-management` profile is off and is not included by any normal
   release script. No port is published. Explicit operator review is required
   before commissioning this additional cloud-to-gateway management route.
6. Apply additive migration `008_node_red_package_management.sql` through the
   established migration principal. If runtime roles use explicit allowlists,
   review `SELECT`, `INSERT`, `UPDATE` on `node_red_install_requests` and
   `node_red_runtime_installs` for the Node API runtime role; it needs no DDL,
   sequence access or DELETE privilege for this feature. This source change does
   not grant production privileges. Readiness requires both the immutable-mail
   ledger and the new ledger. Historical migration bytes remain unchanged.
7. Merge the following **example shape** into retained private API configuration,
   replacing every enrollment value with reviewed evidence. Do not replace the
   live environment with an example file:

   ```dotenv
   IMSOP_NODE_RED_MANAGEMENT_ENABLED=true
   IMSOP_NODE_RED_TARGETS={"warehouse-a":{"commissioned":true,"adminUrl":"http://127.0.0.1:18882/admin","runtimeId":"<lowercase-runtime-uuid>","runtimeVersion":"4.1.4","label":"Warehouse gateway","tokenEnv":"IMSOP_NODE_RED_TOKEN_WAREHOUSE"}}
   IMSOP_NODE_RED_TOKEN_WAREHOUSE_FILE=/run/secrets/logistics-node-red-warehouse
   ```

   `warehouse-a` must already exist in `IMSOP_EDGE_GATEWAYS`; its existing mapping
   is the sole authority for workspace ownership. The token file is an
   operator-controlled absolute path mounted read-only in the API container.
   An inline `IMSOP_NODE_RED_TOKEN_WAREHOUSE` secret is also supported, but do not
   configure both sources. Tokens and gateway configuration never reach the
   browser. Each enrolled target must have a unique runtime UUID, route and token.
   Multiple gateway mappings require separately reviewed private forwards.
8. Qualify inventory, a specifically reviewed package/version, expected
   node/plugin loading, flow behavior, device effects, outage/recovery and rollback
   on that gateway. Do not use a live install as an application smoke test.

## Durable results and uncertain outcomes

`node_red_install_requests` stores immutable request identity, actor, workspace,
gateway, runtime, reviewed revision, exact package/version, timestamps and outcome.
`node_red_runtime_installs` holds one current operation per **global runtime UUID**.
Short PostgreSQL transactions use a runtime advisory lock, with a three-second
statement timeout, so independent API replicas cannot start competing installs.
The reservation commits before the one remote POST; npm/network work holds no
open database transaction. Reusing a request ID returns its original operation
and cannot change its actor, scope, package, version or runtime.

An accepted POST followed by failed verification, a lost response, timeout,
unexpected response or pending/load-error inventory remains `unconfirmed`.
Only an authoritative credential refusal before the Node-RED handler is treated
as a definite POST rejection. A process crash or persistence failure leaves the
saved reservation in place. Reloading the browser or restarting an API process
does not replay it, release it or clear it by age.

**Check saved outcome** is an explicit read-only reconciliation. An actively
installing request must first pass its response window. Reconciliation confirms
`installed` only when the enrolled runtime reports the exact version with no
pending version or load errors. Absence, a different version or unreadable status
cannot prove failure and cannot unlock another install. A late worker result
cannot replace an independently confirmed outcome. Runtime/workspace rebinding
also cannot hide an existing reservation or disclose its contents to another
workspace. Restore/review the original enrollment before resolving it.

There is no automatic retry, abandoned-job unlock, delete-record button or force
release. If gateway files were partly changed, an operator must investigate under
the existing maintenance process. Preserve the durable records and `/data`;
do not erase a reservation simply to make the button available.

## Qualification and release

The regular backend suite covers input/route restrictions, session authorization,
workspace isolation, narrow gateway settings, metadata validation, pinned install
payloads, lost acknowledgements, verification failures, duplicate requests and
read-only recovery with synthetic transports. The consolidated PostgreSQL job
runs `system/node-red-durability.test.ts` in its own loopback-only disposable
`imsop_node_red_test` database, exercising concurrent connections, persistence,
role/session/membership changes, rebinding and late results. It installs no npm
package and contacts no real gateway. The existing browser suite covers review,
explicit acknowledgement, duplicate clicks, lost responses across reload,
read-only reconciliation and zero management calls for demo/non-admin/old APIs.

The normal source, browser, real-stack and exact backend/frontend revision gates
remain required. This optional UI capability does not create an exception to the
matching-source backend gate. Oracle access and gateway commissioning remain
separate from source qualification and merging.

Primary protocol references:

- [Node-RED Admin API: install a node module](https://nodered.org/docs/api/admin/methods/post/nodes/)
- [Node-RED 4.1.4 handler: separate module and version fields](https://github.com/node-red/node-red/blob/4.1.4/packages/node_modules/@node-red/editor-api/lib/admin/nodes.js)
- [Node-RED runtime authentication and fine-grained permissions](https://nodered.org/docs/user-guide/runtime/securing-node-red)
