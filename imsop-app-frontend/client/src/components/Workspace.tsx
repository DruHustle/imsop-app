import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { useData, Source } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { routes, permitted, routeFor } from "@/lib/routes";
import { DEMO_AS_OF, formatTime, isStale, Shipment } from "@/lib/workspace";
import {
  Truck,
  Package,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  BarChart3,
  Activity,
  Clock3,
  AlertCircle,
  ArrowUpRight,
  Database,
  RefreshCw,
} from "lucide-react";
const metricIcons = {
  shipments: Truck,
  active: Package,
  attention: AlertTriangle,
  orders: ClipboardList,
  delivered: CheckCircle2,
  performance: BarChart3,
  health: Activity,
  time: Clock3,
  database: Database,
};
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}
export function Panel({
  title,
  description,
  children,
  actions,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-header">
          <div>
            <h2>{title}</h2>
            {description && <p className="muted text-sm">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}
export function Metric({
  label,
  value,
  description,
  href,
  kind,
  visual,
}: {
  kind?: keyof typeof metricIcons;
  visual?: ReactNode;
  label: string;
  value: ReactNode;
  description: string;
  href?: string;
}) {
  const Icon = kind ? metricIcons[kind] : undefined;
  const content = (
    <>
      {Icon && (
        <Icon className={`metric-icon ${kind}`} size={24} aria-hidden="true" />
      )}
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="muted text-xs">{description}</span>
      {visual && <div className="metric-visual">{visual}</div>}
      {href && <ArrowUpRight className="metric-arrow" size={16} />}
    </>
  );
  return href ? (
    <Link href={href} className="metric">
      {content}
    </Link>
  ) : (
    <div className="metric">{content}</div>
  );
}
export function StatusBadge({ value }: { value: string }) {
  const tone = ["Healthy", "Delivered", "Completed"].includes(value)
    ? "good"
    : ["Exception", "Unavailable", "Degraded"].includes(value)
      ? "bad"
      : [
            "Delayed",
            "Pending",
            "Stale",
            "Unknown",
            "Not configured",
            "open",
            "acknowledged",
          ].includes(value)
        ? "warn"
        : "neutral";
  return (
    <span className={`status-badge ${tone}`}>
      <span aria-hidden="true" />
      {value}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <AlertCircle size={24} aria-hidden="true" />
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}
export function SourceState<T>({
  source,
  empty = "No records in this source",
}: {
  source: Source<T>;
  empty?: string;
}) {
  const { refresh } = useData();
  if (source.status === "loading")
    return (
      <div className="empty-state" role="status">
        <RefreshCw className="animate-spin" />
        <p>Loading authorized records…</p>
      </div>
    );
  if (source.status === "forbidden")
    return (
      <EmptyState
        title="Access denied"
        description={
          source.error ??
          "Your role cannot read this source. Ask your administrator for access."
        }
      />
    );
  if (source.status === "unavailable")
    return (
      <div role="alert">
        <EmptyState
          title="Source unavailable"
          description={source.error ?? "No records could be read."}
          action={
            <Button variant="outline" onClick={refresh}>
              Retry read
            </Button>
          }
        />
      </div>
    );
  if (!source.items.length)
    return (
      <EmptyState
        title={empty}
        description="The source returned zero records. No demonstration records have been substituted."
      />
    );
  return null;
}
export function SourceNote({
  count,
  total,
}: {
  count?: number;
  total?: number;
}) {
  const { mode, lastShipmentReadAt, refresh } = useData();
  return (
    <div
      data-mode={mode}
      className={`source-note ${mode === "demo" ? "demo-note" : ""}`}
    >
      <Database size={14} aria-hidden="true" />
      <span>
        {mode === "demo"
          ? `Demo dataset · As of ${formatTime(DEMO_AS_OF)}`
          : "Live · Workspace records"}
        {count !== undefined &&
          ` · ${count} ${count === 1 ? "record" : "records"} in scope${total !== undefined ? ` of ${total}` : ""}`}
        {mode === "live" &&
          ` · Complete matching selection · Last read: ${formatTime(lastShipmentReadAt)}`}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={refresh}
        aria-label="Refresh workspace records"
      >
        <RefreshCw size={14} /> Refresh
      </Button>
    </div>
  );
}
export function SectionNav() {
  const [path] = useLocation();
  const { user } = useAuth();
  const current = routeFor(path);
  if (!current || ["Account", "Workspace"].includes(current.group)) return null;
  return (
    <nav className="section-nav" aria-label={`${current.group} sections`}>
      {routes
        .filter(r => r.group === current.group && permitted(r, user))
        .map(r => (
          <Link
            key={r.id}
            href={r.href}
            aria-current={current.id === r.id ? "page" : undefined}
          >
            {r.label}
          </Link>
        ))}
    </nav>
  );
}
export function Freshness({
  shipment,
  compact = false,
}: {
  shipment: Shipment;
  compact?: boolean;
}) {
  const { mode } = useData();
  const observation = shipment.observedAt
    ? compact
      ? new Date(shipment.observedAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "UTC",
        }) + " UTC"
      : formatTime(shipment.observedAt)
    : null;
  return (
    <span className="freshness" title={formatTime(shipment.observedAt)}>
      {shipment.observedAt
        ? `${isStale(shipment, mode === "demo" ? DEMO_AS_OF : Date.now()) ? "Stale · " : ""}Observed ${observation}`
        : "Observation time unknown"}
    </span>
  );
}
