import { ReactNode, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  X,
  AlertTriangle,
  Truck,
  CheckCircle2,
  Package,
  ClipboardList,
  Activity,
  Clock3,
  Database,
  BarChart3,
  Plug,
  Mail,
} from "lucide-react";
import { Button } from "./ui/button";
import { Panel, StatusBadge } from "./Workspace";
import {
  Shipment,
  OperationalOrder,
  formatTime,
  performance,
} from "@/lib/workspace";
export function Notice({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="board-notice">
      <AlertTriangle size={22} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}
export const metricIcons = {
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
export function StatusDistribution({
  items,
  stacked = false,
}: {
  items: Shipment[];
  stacked?: boolean;
}) {
  const statuses = [
    "Delivered",
    "In transit",
    "Delayed",
    "Exception",
    "Pending",
    "Cancelled",
  ];
  const counts = statuses
    .map(status => ({
      status,
      count: items.filter(s => s.status === status).length,
    }))
    .filter(s => s.count > 0);
  const other = items.filter(s => !statuses.includes(s.status)).length;
  if (other) counts.push({ status: "Other", count: other });
  return (
    <div
      className="status-distribution"
      role="img"
      aria-label={counts.map(s => `${s.status}: ${s.count}`).join("; ")}
    >
      {stacked && (
        <div className="status-stack">
          {counts.map(s => (
            <div
              key={s.status}
              data-status={s.status}
              style={{ width: `${(s.count / items.length) * 100}%` }}
              title={`${s.status}: ${s.count}`}
            >
              <span className="sr-only">{s.count}</span>
            </div>
          ))}
        </div>
      )}
      <div className={stacked ? "status-legend" : "status-bars"}>
        {counts.map(s => (
          <div key={s.status} className="status-chart-row">
            <span className="status-swatch" data-status={s.status} />
            <span>{s.status}</span>
            {!stacked && (
              <span className="status-track">
                <span
                  data-status={s.status}
                  style={{ width: `${(s.count / items.length) * 100}%` }}
                />
              </span>
            )}
            <strong>{s.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
export function EvidenceTimeline({
  items,
}: {
  items: { id: string; title: string; date: string | null; detail?: string }[];
}) {
  return (
    <ol className="evidence-timeline">
      {items.map(item => (
        <li key={item.id}>
          <strong>{item.title}</strong>
          <time>{formatTime(item.date)}</time>
          {item.detail && <p>{item.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
export function RecordPreview({
  shipment,
  order,
  onClose,
  href,
}: {
  shipment?: Shipment;
  order?: OperationalOrder;
  onClose: () => void;
  href: string;
}) {
  const item = shipment || order;
  const preview = useRef<HTMLElement>(null);
  useEffect(() => {
    preview.current?.focus();
    if (innerWidth < 1100)
      preview.current?.scrollIntoView({ block: "nearest" });
  }, [item?.id]);
  if (!item) return null;
  const close = () => {
    onClose();
    setTimeout(
      () =>
        Array.from(
          document.querySelectorAll<HTMLButtonElement>("[data-preview-key]")
        )
          .find(
            button =>
              button.getClientRects().length>0 && button.dataset.previewKey ===
              (shipment ? "shipment:" : "order:") + item.id
          )
          ?.focus(),
      0
    );
  };
  return (
    <aside
      ref={preview}
      tabIndex={-1}
      onKeyDown={e => {
        if (e.key === "Escape") close();
      }}
      className={`record-preview panel ${order ? "order-preview" : ""}`}
      aria-label={`Preview ${shipment?.trackingNumber || order?.orderNumber}`}
    >
      <div className="preview-heading">
        <div>
          <h2>{shipment?.trackingNumber || order?.orderNumber}</h2>
          {shipment && (
            <p className="muted text-sm">
              {shipment.origin} → {shipment.destination}
            </p>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={close}
          aria-label="Close record preview"
        >
          <X size={17} />
        </Button>
      </div>
      <div className="panel-body space-y-4">
        <StatusBadge value={item.status} />
        <dl className="preview-facts">
          {shipment ? (
            <>
              <dt>Carrier</dt>
              <dd>{shipment.carrier}</dd>
              <dt>Transport</dt>
              <dd>{shipment.transportMode}</dd>
              <dt>ETA</dt>
              <dd>{formatTime(shipment.estimatedArrival)}</dd>
              <dt>Last observation</dt>
              <dd>{formatTime(shipment.observedAt)}</dd>
              <dt>Received</dt>
              <dd>{formatTime(shipment.receivedAt)}</dd>
            </>
          ) : (
            <>
              <dt>Customer</dt>
              <dd>{order!.customerId ?? "Not supplied"}</dd>
              <dt>Amount</dt>
              <dd>
                {order!.totalAmount ?? "Not supplied"}{" "}
                {order!.currency ?? "· Currency unknown"}
              </dd>
              <dt>Created</dt>
              <dd>{formatTime(order!.createdAt)}</dd>
            </>
          )}
        </dl>
        <Link className="record-link" href={href}>
          Open full {shipment ? "shipment" : "order"} ↗
        </Link>
        {shipment && (
          <Link
            className="record-link block"
            href={
              href.replace(/\?/, "/tracking?") +
              (href.includes("?") ? "" : "/tracking")
            }
          >
            Tracking / events ↗
          </Link>
        )}
        <p className="muted text-xs">
          Recorded evidence. Current carrier connectivity is unknown.
        </p>
      </div>
    </aside>
  );
}
export function DeliveryTrend({ items }: { items: Shipment[] }) {
  const delivered = items.filter(
    s => s.status === "Delivered" && s.actualArrival
  );
  const dates = Array.from(
    new Set(delivered.map(s => s.actualArrival!.slice(0, 10)))
  ).sort();
  if (!dates.length)
    return (
      <p className="muted text-sm">
        Delivery-date evidence is not available in this selection.
      </p>
    );
  const points = dates.map(date => {
    const rows = delivered.filter(s => s.actualArrival!.startsWith(date));
    return { date, delivered: rows.length, ...performance(rows) };
  });
  const max = Math.max(1, ...points.map(p => p.delivered)),
    width = 520,
    height = 180,
    step = 460 / points.length;
  return (
    <>
      <svg
        className="delivery-chart"
        viewBox={`0 0 ${width} ${height + 35}`}
        role="img"
        aria-label={points
          .map(
            p =>
              `${p.date}: ${p.delivered} delivered; ${p.rate === null ? "on-time unknown" : p.rate.toFixed(1) + "% on-time"}`
          )
          .join("; ")}
      >
        {[0, 25, 50, 75, 100].map(y => (
          <g key={y}>
            <line
              x1="25"
              x2="490"
              y1={height - (y / 100) * 150}
              y2={height - (y / 100) * 150}
              stroke="var(--border)"
            />
            <text x="495" y={height - (y / 100) * 150 + 4}>
              {y}%
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <g key={p.date}>
            <rect
              x={30 + i * step + step * 0.2}
              y={height - (p.delivered / max) * 140}
              width={Math.max(3, step * 0.4)}
              height={(p.delivered / max) * 140}
              fill="var(--chart-bar)"
            />
            <text
              x={30 + i * step + step * 0.4}
              y={height + 22}
              textAnchor="middle"
            >
              {p.date.slice(5)}
            </text>
            {p.rate !== null && (
              <circle
                cx={30 + i * step + step * 0.4}
                cy={height - (p.rate / 100) * 150}
                r="4"
                fill="var(--primary)"
              />
            )}
          </g>
        ))}
        {points.map((p, i) =>
          i > 0 && p.rate !== null && points[i - 1].rate !== null ? (
            <line
              key={p.date}
              x1={30 + (i - 1) * step + step * 0.4}
              y1={height - (points[i - 1].rate! / 100) * 150}
              x2={30 + i * step + step * 0.4}
              y2={height - (p.rate / 100) * 150}
              stroke="var(--primary)"
              strokeWidth="2"
            />
          ) : null
        )}
      </svg>
      <p className="muted text-xs">
        Bars: deliveries per recorded actual-arrival date · Line: eligible
        on-time rate. Missing promises are excluded from the rate.
      </p>
    </>
  );
}
export function IntegrationCard({
  title,
  description,
  state,
  kind,
  children,
}: {
  title: string;
  description: string;
  state: string;
  kind: "carrier" | "mail" | "forecast" | "source";
  children?: ReactNode;
}) {
  const Icon =
    kind === "carrier"
      ? Truck
      : kind === "mail"
        ? Mail
        : kind === "forecast"
          ? BarChart3
          : Plug;
  return (
    <article className="integration-card">
      <Icon size={28} aria-hidden="true" />
      <div>
        <div className="integration-card-heading">
          <h3>{title}</h3>
          <StatusBadge value={state} />
        </div>
        <p className="muted text-xs">{description}</p>
        {children}
      </div>
    </article>
  );
}
