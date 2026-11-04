# IMSOP-only Activepieces (optional)

Use this as an **unapplied candidate**, not a ready-made production deployment.
Deploy a completely separate IMSOP Activepieces release, namespace, encryption
keys, credentials, database, Redis and ingress. The app is fully functional
without Activepieces, and all critical logistics records remain in IMSOP.

For the official chart and version-specific instructions:
https://www.activepieces.com/docs/install/options/helm

The included values file demonstrates external secret references only.
Review the real chart version with Helm, choose a pinned version/image, validate
\`helm template\`, and configure proper CPU/memory quotas. Upstream recommends
at least 2 vCPU and 4 GiB RAM for a self-hosted installation, so do **not**
add another copy to the existing Oracle VM until capacity is measured.

Use Activepieces only for approved email/Teams/SAP/ERP/maintenance workflows,
never for raw warehouse PLC safety decisions or GPS location ingestion. No flows
are automatically installed, and Activepieces is not yet connected to outgoing
IMSOP events in this candidate.
