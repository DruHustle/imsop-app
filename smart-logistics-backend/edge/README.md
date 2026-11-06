# Smart Logistics standalone logistics edge

**Software candidate; not commissioned or production-deployed.** Smart Logistics owns its
Node-RED deployment, Python agent, secrets, API, database and business-automation
installation. It has **no runtime dependency** on Smart Factory or Smart Farmer.

## Data paths

- Warehouse sensors / RFID / scanner gateways / weighbridges / cold rooms
  → commissioned Node-RED adapters → Python edge agent
  → **signed HTTPS/TLS** → Smart Logistics workspace-scoped PostgreSQL observations.
- Truck GPS / fleet telematics → Node-RED protocol/vendor adapter → Python agent
  → signed HTTPS/TLS → Smart Logistics workspace-scoped GPS event history.
- Smart Logistics business workflows (carrier APIs, ERP/SAP, forecasts, escalations)
  → separately deployable **Activepieces** with reviewed event/API permissions.

The current vertical slice is **signed HTTPS**, not a cloud MQTT subscriber.
MQTT is an optional edge-side Node-RED source; add cloud MQTT/TLS only after a
secured broker, subscribed service and outage qualification exist. No shipment
status, geofence breach, actual delivery, warehouse inventory or business action
is inferred by this intake. Its source/received times are preserved. GPS quality
and driver identity are **unverified** until physical commissioning.

## API commissioning

The Node API accepts POST \`/api/edge/:gatewayId/events\` with exact JSON:
\`schemaVersion: 1\`, UUID \`eventId\`, allowed \`sourceId\`,
\`observedAt\` with offset, and either:

- \`truck_gps\`: \`data: {vehicleId,latitude,longitude,accuracyM?,speedKph?,trackingNumber?}\`;
- \`warehouse_sensor\`: \`data: {warehouseId,assetId,metric,value,unit}\`.

The source is bound to **one workspace**, not chosen by the event. The server
checks HMAC-SHA256 over \`timestamp + "." + raw body\`, a five-minute freshness
window, schema, source allowlist and stable event ID before database acceptance.
Duplicate identical events return 202; conflicting event ID/payload returns 409.
The API does not expose a command endpoint.

Provision a reviewed private \`IMSOP_EDGE_GATEWAYS\` JSON setting:

\`\`\`json
{
  "truck-gateway-1": {
    "workspaceId": "<existing-authorized-workspace-uuid>",
    "secret": "<distinct-random-secret-at-least-32-characters>",
    "sources": ["truck-42", "warehouse-temp-1"]
  }
}
\`\`\`

Do not expose this mapping to browsers or Activepieces. Migration
\`server/migrations/006_edge_observations.sql\` is additive and is now a readiness
requirement. Apply it through the existing checksum-locked migrator after
independent backup/restore qualification.

GET \`/api/edge/observations\` requires a current, independently verified
Smart Logistics session, active workspace membership and the admin/engineer/analyst role.
It returns at most 100 events **only** for that workspace. Exact truck locations
are sensitive; do not make this endpoint public. Browser/UI integration should
use a role-checked map with explicit location-age and uncertainty.

## Gateway commissioning

On each independent Linux gateway, use a dedicated service account and
private environment based on \`edge/.env.example\`. Match
\`EDGE_OUTBOUND_SECRET\` with the server's reviewed gateway secret.
\`EDGE_INGRESS_TOKEN\` is distinct and grants only Node-RED → local Python
admission. The Python agent listens on \`127.0.0.1:18779\`, verifies
commissioned sources and strict GPS/sensor shapes, then records data in SQLite
with WAL + FULL synchronous journaling before acknowledging ingress.

Start with \`python3 edge/agent.py\` under a supervised systemd unit after
exporting the private environment. Run Node-RED using
\`docker compose --env-file .env up -d\` from \`edge/node-red\` after setting its
private configuration. This Linux-specific Compose uses host networking for
loopback access and must be covered by a restrictive OT firewall and a dedicated
unprivileged host; it is not an internet-facing editor. Use an SSH tunnel to the
loopback Node-RED editor at 1882. The sample GPS flow is intentionally
**disabled** and uses a \`demo-truck\` identity; never treat its zero coordinates
as a live truck position.

The Python spool retains an event after a temporary API outage. Each send uses
a **new timestamp and HMAC signature**, preserving the original event ID and
observation time. Permanent application rejections are quarantined locally, not
deleted. Back up the SQLite state and retain recovery evidence. The queue cannot
prove delivery until the API accepts it. Python records local rejected-source
and authentication evidence but does not assert cybersecurity compliance.

## Optional Python AI/cybersecurity

Passive policy/identity rejection evidence already exists in the Python agent.
AI inference is **not automatically enabled**. A separately commissioned,
read-only Python plugin may analyze GPS anomalies (impossible jumps, stale fixes,
route deviation) or cold-chain patterns, but must retain quality/provenance,
explicit units and independent human review. Never infer vehicle theft or cargo
condition from one unverified fix. No AI agent may start a vehicle, change a
warehouse PLC or approve ERP transactions.

## Business automation

Activepieces is separate from edge telemetry and separate from other Onesa apps.
Use the included **candidate Helm values** only after reviewing the currently
supported chart, provisioning **Smart Logistics-only** PostgreSQL/Redis/secret resources and
qualifying the target cluster. Do not feed raw truck location into an arbitrary
external workflow: only reviewed, authorization-scoped business events should
become triggers. Existing Smart Logistics notification and logistics transaction paths
remain authoritative.

## Qualification

\`\`\`sh
cd smart-logistics-backend/edge
python3 -m unittest discover -s . -p 'test_*.py' -v
cd ../server
pnpm build && pnpm test
\`\`\`

Before live enablement: warehouse and telematics adapter tests, location/time
accuracy, duplicate/out-of-order GPS, SIM/roaming outage, power loss and
restart, event queue restore, workspace permission isolation, retention/privacy
policy, field calibration, and proof that no Node-RED command reaches machinery
outside its controller safety layer.

## Optional package management

Individual administrators can review and add exact Node-RED node/plugin package
versions on explicitly enrolled gateways in their live workspace. See
[Node-RED package management](../docs/NODE_RED_PACKAGE_MANAGEMENT.md) for private
route commissioning, narrow credentials, durable uncertain outcomes and release
gates. It defaults off and does not commission a gateway or change its flows.
