import { User } from "./auth-types";
import {
  LayoutDashboard,
  Truck,
  ShoppingBag,
  BarChart3,
  Sparkles,
  MessageSquare,
  Activity,
  Plug,
  UserRound,
  Settings,
} from "lucide-react";
const all = ["admin", "engineer", "analyst", "user"];
export const routes = [
  {
    id: "overview",
    href: "/",
    label: "Overview",
    group: "Workspace",
    icon: LayoutDashboard,
    roles: all,
    aliases: [],
  },
  {
    id: "shipments",
    href: "/supply-chain/shipments",
    label: "Shipments",
    group: "Supply chain",
    icon: Truck,
    roles: all,
    aliases: ["/operations"],
  },
  {
    id: "orders",
    href: "/supply-chain/orders",
    label: "Orders",
    group: "Supply chain",
    icon: ShoppingBag,
    roles: ["admin", "engineer", "analyst"],
    aliases: [],
  },
  {
    id: "analytics",
    href: "/insights/analytics",
    label: "Analytics",
    group: "Insights",
    icon: BarChart3,
    roles: ["admin", "analyst"],
    aliases: ["/analytics"],
  },
  {
    id: "recommendations",
    href: "/insights/recommendations",
    label: "Recommendations",
    group: "Insights",
    icon: Sparkles,
    roles: ["admin", "engineer", "analyst"],
    aliases: ["/intelligence"],
  },
  {
    id: "assistant",
    href: "/insights/assistant",
    label: "Assistant",
    group: "Insights",
    icon: MessageSquare,
    roles: all,
    aliases: ["/assistant"],
  },
  {
    id: "health",
    href: "/infrastructure/health",
    label: "Service health",
    group: "Infrastructure",
    icon: Activity,
    roles: ["admin", "engineer"],
    aliases: ["/infrastructure"],
  },
  {
    id: "integrations",
    href: "/infrastructure/integrations",
    label: "Integrations",
    group: "Infrastructure",
    icon: Plug,
    roles: ["admin", "engineer"],
    aliases: [],
  },
  {
    id: "settings",
    href: "/settings",
    label: "Preferences",
    group: "Account",
    icon: Settings,
    roles: all,
    aliases: [],
  },
  {
    id: "profile",
    href: "/profile",
    label: "Profile",
    group: "Account",
    icon: UserRound,
    roles: all,
    aliases: [],
  },
];
export const permitted = (route: (typeof routes)[number], user: User | null) =>
  !!user && route.roles.includes(user.role);
export function routeFor(path: string) {
  return routes.find(
    r =>
      path === r.href ||
      (r.href !== "/" && path.startsWith(r.href + "/")) ||
      r.aliases.includes(path)
  );
}
