export const release = {
  revision: /^[a-f0-9]{40}$/.test(process.env.APP_REVISION || "")
    ? process.env.APP_REVISION
    : "unknown",
  apiContract: 2,
  capabilities: [
    "optional-adapters-v1",
    "purchase-pagination-v1",
    "scoped-reviews-v1",
    "customer-order-search-v1",
    "workspace-edge-observations-v1",
    "immutable-mail-v1",
    "node-red-package-management-v1",
  ],
  nodeSchema: "008_node_red_package_management.sql",
  supplyChainSchema: "202610270002_PurchaseReceiving",
};
