# Onesa Logistics domain migration

Requested frontend: `https://logistics.onesa.eu`. The proposed Oracle backend
hostname is `https://logistics-api.onesa.eu`; verify its exact routing and TLS
before use. This source change prepares deployment and does not attach domains,
change DNS, move data or declare a production release.

The current backend remains documented on Software Engineering Backend; the
requested Onesa UG backend is a distinct destination. Verify both actual host
identities through the owner's host inventory before declaring the backend moved.
A working domain, matching
application revision or ready response does not identify the underlying VM,
container image or database primary. Qualify the companion backend on the intended
Onesa host first. Preserve its Node and .NET PostgreSQL schemas, identity mappings,
recovery delivery key, signing keys, outbox and provider secrets. A new hostname
does not prove that a backend has moved.

## Deploying the qualified domains

1. Add `logistics.onesa.eu` to the existing Vercel project. Publish the exact
   project-provided records at the authoritative DNS provider; confirm certificate
   issuance. Verify that Cloudflare is authoritative before editing its zone.
2. Configure the candidate backend origin with exact frontend CORS/trusted origins,
   reset/invite links, callbacks and provider webhooks. Keep the existing mailbox
   provider MX records. Resend sending-subdomain records must come from its API or
   dashboard; do not invent DKIM keys or enable inbound mail as part of sending.
3. Run the backend's existing isolated system, migration and rollback checks.
   Verify `/version`, contract 2 and required capabilities, then `/ready` and
   anonymous rejection against the new backend URL.
4. Set repository variables `IMSOP_API_ORIGIN` and `IMSOP_WEB_ORIGIN` to the two
   qualified HTTPS origins. Without variables, the current URLs remain active.
5. The existing protected CI path now checks the selected backend, runs
   `scripts/prepare-deployment.mjs`, builds and publishes the frontend, then
   verifies the selected public URL and exact source identities. All five proxy
   paths move together, including purchasing and readiness. API cache protections,
   the SPA fallback and disabled independent Git publishing are preserved.
6. Test login/logout, password recovery links, workspace permissions, shipments,
   purchasing/receiving, notifications, Assistant context and mobile navigation
   through the new first-party proxy. Check that old URLs redirect correctly only
   after the new domain is functional; keep rollback references and data.

The preparation script rewrites only a deployment checkout's `vercel.json` and
canonical/social/schema URLs in `client/index.html`. Run it on a clean checkout;
do not commit its generated target configuration unless making the canonical
cutover explicit in a separately reviewed change. It validates HTTPS origins and
rejects incomplete API routing before writing files. Backend verification must
precede it. It never calls a hosting API.

For manual preparation after qualification:

```sh
IMSOP_API_ORIGIN=https://logistics-api.onesa.eu \
IMSOP_WEB_ORIGIN=https://logistics.onesa.eu \
node scripts/prepare-deployment.mjs
```

The single-label API hostname is compatible with standard `*.onesa.eu` edge
certificate coverage. `api.logistics.onesa.eu` needs separate deeper-subdomain
certificate handling. Cloudflare DNS-only is suitable for the Vercel frontend;
if proxying is intentionally enabled, use Full (strict), preserve certificate
validation paths and avoid caching authenticated API responses.

References: [Vercel and Cloudflare](https://vercel.com/kb/guide/can-i-use-a-proxy-on-top-of-my-vercel-deployment),
[Cloudflare certificate scope](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/),
and [Resend DNS setup](https://resend.com/docs/guides/dns/cloudflare).
