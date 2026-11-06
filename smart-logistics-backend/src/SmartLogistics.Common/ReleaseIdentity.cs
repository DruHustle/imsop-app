namespace SmartLogistics.Common;
public static class ReleaseIdentity {
 public static object Current => new { revision=System.Text.RegularExpressions.Regex.IsMatch(Environment.GetEnvironmentVariable("APP_REVISION")??"","^[a-f0-9]{40}$") ? Environment.GetEnvironmentVariable("APP_REVISION") : "unknown",apiContract=2,capabilities=new[]{"optional-adapters-v1","purchase-pagination-v1","scoped-reviews-v1","customer-order-search-v1","workspace-edge-observations-v1", "immutable-mail-v1", "node-red-package-management-v1"},nodeSchema="008_node_red_package_management.sql",supplyChainSchema="202610270002_PurchaseReceiving" };
}
