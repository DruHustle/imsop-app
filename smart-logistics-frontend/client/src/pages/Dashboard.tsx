import { lazy, Suspense, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";
import {
  PageHeader,
  Panel,
  Metric,
  SourceNote,
  SourceState,
  StatusBadge,
  Freshness,
  EmptyState,
} from "@/components/Workspace";
import { EvidenceTimeline } from "@/components/Board";
import { isException, DEMO_AS_OF } from "@/lib/workspace";
import { extractIdentifiers } from "@/lib/assistant";
import { useHashQuery } from "@/lib/hash-location";
import {
  overviewScope,
  overviewItems,
  ordersInScope,
  shipmentActivity,
  utcDay,
  statusGroups,
  statusColor,
} from "@/lib/overview";
const ActivityChart = lazy(() =>
  import("@/components/OverviewCharts").then(m => ({
    default: m.ActivityChart,
  }))
);
const StatusDonut = lazy(() =>
  import("@/components/OverviewCharts").then(m => ({ default: m.StatusDonut }))
);
const ShipmentMap = lazy(() =>
  import("@/components/Map").then(m => ({ default: m.MapView }))
);
export default function Dashboard() {
  const { shipments, orders, mode } = useData(),
    params = useHashQuery(),
    [, navigate] = useLocation();
  const [query, setQuery] = useState(""),
    [mapExpanded, setMapExpanded] = useState(!!params.get("selected"));
  const scope = overviewScope(params, mode),
    items = overviewItems(shipments.items, params, scope),
    scopedOrders = ordersInScope(orders.items, scope),
    ready = shipments.status === "ready";
  const attention = items.filter(isException),
    active = items.filter(s => !["Delivered", "Cancelled"].includes(s.status)),
    pending = scopedOrders.filter(o => o.status === "Pending");
  const activity = shipmentActivity(
    items,
    scope.from,
    scope.to,
    utcDay(mode === "demo" ? DEMO_AS_OF : Date.now())
  );
  const maxCreated = Math.max(1, ...activity.points.map(p => p.created));
  const update = (changes: Record<string, string>) => {
    const q = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes))
      value ? q.set(key, value) : q.delete(key);
    q.delete("selected");
    navigate("/" + (q.size ? "?" + q : ""), { replace: true });
  };
  const select = (id: string) => {
    const q = new URLSearchParams(params);
    id ? q.set("selected", id) : q.delete("selected");
    navigate("/?" + q, { replace: true });
  };
  const list = (status = "") => {
    const q = new URLSearchParams();
    if (scope.from) q.set("from", scope.from);
    if (scope.to) q.set("to", scope.to);
    for (const key of ["q", "carrier", "mode"])
      if (params.get(key)) q.set(key, params.get(key)!);
    if (status || params.get("status"))
      q.set("status", status || params.get("status")!);
    return "/supply-chain/shipments" + (q.size ? "?" + q : "");
  };
  const detail = (id: string) =>
    `/supply-chain/shipments/${encodeURIComponent(id)}?return=${encodeURIComponent("/" + (params.size ? "?" + params : ""))}`;
  const selected = items.find(s => s.id === params.get("selected"));
  const located = items.filter(
    s =>
      s.latitude !== null &&
      s.longitude !== null &&
      Number.isFinite(s.latitude) &&
      Number.isFinite(s.longitude) &&
      Math.abs(s.latitude!) <= 90 &&
      Math.abs(s.longitude!) <= 180
  );
  const assets = located.map(s => ({
    id: s.id,
    label: s.trackingNumber,
    position: { lat: s.latitude!, lng: s.longitude! },
    href: detail(s.id),
    status: s.status,
    observedAt: s.observedAt,
  }));
  const ids = extractIdentifiers(
      query,
      items.map(s => s.trackingNumber)
    ),
    context =
      ids.length === 1
        ? items.find(
            s => s.trackingNumber.toLowerCase() === ids[0].toLowerCase()
          )
        : undefined;
  const recent = [
    ...items
      .filter(s => s.observedAt)
      .map(s => ({
        id: "shipment:" + s.id,
        title: `${s.trackingNumber} · ${s.status}`,
        date: s.observedAt,
        detail: "Recorded shipment observation",
      })),
    ...scopedOrders
      .filter(o => o.createdAt)
      .map(o => ({
        id: "order:" + o.id,
        title: `Order ${o.orderNumber}`,
        date: o.createdAt,
        detail: "Order created",
      })),
  ]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 3);
  const source = !ready || !items.length;
  return (
    <div className="graphical-overview">
      <PageHeader
        title="Operational overview"
        description="A visual pulse of your supply chain"
        actions={
          <label className="field overview-period">
            <span className="sr-only">Overview period</span>
            <select
              aria-label="Overview period"
              value={scope.period}
              onChange={e =>
                update({ period: e.target.value, from: "", to: "" })
              }
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All available dates</option>
              <option value="custom">Custom dates</option>
            </select>
          </label>
        }
      />
      {scope.period === "custom" && (
        <div className="filter-toolbar">
          <label className="field">
            Created from
            <input
              type="date"
              aria-label="Overview created from"
              value={scope.from}
              max={scope.to || undefined}
              onChange={e => update({ period: "custom", from: e.target.value })}
            />
          </label>
          <label className="field">
            Created through
            <input
              type="date"
              aria-label="Overview created through"
              value={scope.to}
              min={scope.from || undefined}
              onChange={e => update({ period: "custom", to: e.target.value })}
            />
          </label>
        </div>
      )}
      {!scope.valid && (
        <p role="alert">
          Select valid dates with the start at or before the end.
        </p>
      )}
      <SourceNote
        count={ready ? items.length : undefined}
        total={shipments.total}
      />
      {(params.get("status") || params.get("carrier")) && (
        <div className="actions">
          <span className="muted text-sm">
            Selection: {params.get("status")} {params.get("carrier")}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => update({ status: "", carrier: "" })}
          >
            Clear record filters
          </Button>
        </div>
      )}
      <div className="metric-grid overview-kpis">
        <Metric
          kind="shipments"
          label="Shipments in scope"
          value={ready ? items.length : "—"}
          description="Matching selected creation dates"
          href={list()}
          visual={
            ready && activity.points.length > 1 && activity.createdTotal > 0 ? (
              <svg
                className="kpi-sparkline"
                viewBox="0 0 100 24"
                role="img"
                aria-label="Recorded shipment creations over the selected period"
              >
                <polyline
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="1.8"
                  points={activity.points
                    .map(
                      (p, i) =>
                        `${(i / (activity.points.length - 1)) * 100},${22 - (p.created / maxCreated) * 20}`
                    )
                    .join(" ")}
                />
              </svg>
            ) : undefined
          }
        />
        <Metric
          kind="active"
          label="Active shipments"
          value={ready ? active.length : "—"}
          description="Excludes delivered and cancelled"
          href={list("active")}
          visual={
            ready ? (
              <progress
                aria-label={`${active.length} of ${items.length} shipments active`}
                value={active.length}
                max={Math.max(1, items.length)}
              />
            ) : undefined
          }
        />
        <Metric
          kind="attention"
          label="Needs attention"
          value={ready ? attention.length : "—"}
          description="Delayed or exception"
          href={list("attention")}
          visual={
            ready ? (
              <progress
                className="attention-progress"
                aria-label={`${attention.length} of ${items.length} need attention`}
                value={attention.length}
                max={Math.max(1, items.length)}
              />
            ) : undefined
          }
        />
        <Metric
          kind="orders"
          label="Pending orders"
          value={orders.status === "ready" ? pending.length : "—"}
          description={
            orders.status === "forbidden"
              ? "Unavailable for your role"
              : "Pending orders in the date scope"
          }
          href={
            orders.status === "ready"
              ? `/supply-chain/orders?status=Pending&from=${scope.from}&to=${scope.to}`
              : undefined
          }
          visual={
            orders.status === "ready" ? (
              <progress
                aria-label={`${pending.length} of ${scopedOrders.length} orders pending`}
                value={pending.length}
                max={Math.max(1, scopedOrders.length)}
              />
            ) : undefined
          }
        />
      </div>
      <div className="overview-main">
        <Panel
          title="Shipment activity"
          description={`Created shipments by UTC ${activity.bucket}`}
          className="overview-chart-panel"
          actions={
            <div className="segmented">
              {["7", "30"].map(p => (
                <Button
                  size="sm"
                  variant={scope.period === p ? "default" : "outline"}
                  aria-pressed={scope.period === p}
                  key={p}
                  onClick={() => update({ period: p, from: "", to: "" })}
                >
                  {p}D
                </Button>
              ))}
            </div>
          }
        >
          {source ? (
            <SourceState
              source={{ ...shipments, items }}
              empty="No matching shipments"
            />
          ) : (
            <Suspense fallback={<p role="status">Loading shipment chart…</p>}>
              <ActivityChart
                {...activity}
                onBucket={day => {
                  const end = new Date(day + "T00:00:00Z");
                  if (activity.bucket === "week")
                    end.setUTCDate(end.getUTCDate() + 6);
                  if (activity.bucket === "year")
                    end.setUTCFullYear(end.getUTCFullYear() + 1, 0, 0);
                  if (activity.bucket === "month")
                    end.setUTCMonth(end.getUTCMonth() + 1, 0);
                  const q = new URLSearchParams(list().split("?")[1] ?? "");
                  q.set(
                    "from",
                    scope.from && scope.from > day ? scope.from : day
                  );
                  const until = utcDay(end);
                  q.set("to", scope.to && scope.to < until ? scope.to : until);
                  navigate("/supply-chain/shipments?" + q);
                }}
              />
            </Suspense>
          )}
          <p className="muted text-xs">
            Creation cohort in the selected dates. Delivery series uses explicit
            actual arrivals only.
            {activity.missingCreation > 0
              ? ` ${activity.missingCreation} records have no creation timestamp and cannot be plotted.`
              : ""}
          </p>
        </Panel>
        <Panel
          title="Shipment locations"
          description={`${located.length} of ${items.length} selected shipments have source coordinates`}
          className={`overview-map-panel ${mapExpanded ? "is-expanded" : ""}`}
          actions={
            <Button
              className="mobile-map-toggle"
              size="sm"
              variant="outline"
              aria-expanded={mapExpanded}
              onClick={() => setMapExpanded(v => !v)}
            >
              {mapExpanded ? "Collapse map" : "Explore map"}
            </Button>
          }
        >
          <div className="overview-map-content">
            {source ? (
              <SourceState
                source={{ ...shipments, items }}
                empty="No matching shipments"
              />
            ) : (
              <Suspense fallback={<p role="status">Loading shipment map…</p>}>
                <ShipmentMap
                  assets={assets}
                  selectedId={selected?.id}
                  onSelect={select}
                  compact
                />
              </Suspense>
            )}
            {selected && (
              <div className="map-record-context" aria-live="polite">
                <div className="flex justify-between gap-2">
                  <strong>{selected.trackingNumber}</strong>
                  <StatusBadge value={selected.status} />
                </div>
                <p>
                  {selected.origin} → {selected.destination}
                </p>
                <Freshness shipment={selected} />
                <Link className="record-link" href={detail(selected.id)}>
                  Open shipment →
                </Link>
              </div>
            )}
            <div className="spatial-legend">
              {statusGroups(located).map(g => (
                <span key={g.status}>
                  <i style={{ background: statusColor(g.status) }} />
                  {g.status}
                </span>
              ))}
            </div>
          </div>
        </Panel>
      </div>
      <div className="overview-lower">
        <Panel
          title="Shipment status"
          description="Same selected records as the summary cards"
        >
          {source ? (
            <SourceState
              source={{ ...shipments, items }}
              empty="No matching shipments"
            />
          ) : (
            <Suspense fallback={<p role="status">Loading status chart…</p>}>
              <StatusDonut
                items={items}
                selected={params.get("status") || ""}
                onSelect={status =>
                  update({
                    status: params.get("status") === status ? "" : status,
                  })
                }
              />
            </Suspense>
          )}
        </Panel>
        <Panel
          title="Needs attention"
          actions={
            <Link className="record-link text-xs" href={list("attention")}>
              View all →
            </Link>
          }
        >
          {!ready ? (
            <SourceState source={shipments} />
          ) : attention.length ? (
            <div className="exception-cards">
              {attention.slice(0, 3).map(s => (
                <article key={s.id}>
                  <div className="flex justify-between gap-2">
                    <Link className="record-link" href={detail(s.id)}>
                      {s.trackingNumber}
                    </Link>
                    <StatusBadge value={s.status} />
                  </div>
                  <p>
                    {s.origin} → {s.destination}
                  </p>
                  <Freshness shipment={s} />
                  <Link className="record-link text-xs" href={detail(s.id)}>
                    Review shipment →
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recorded exceptions"
              description="No delayed or exception shipments in this selection."
            />
          )}
        </Panel>
        <Panel title="Ask your data">
          <p className="muted text-sm mb-3">
            Find a record or explore an exception
          </p>
          <form
            className="query-box"
            onSubmit={e => {
              e.preventDefault();
              if (query.trim())
                navigate(
                  `/insights/assistant?q=${encodeURIComponent(query)}${context ? "&item=shipment:" + context.id : ""}`
                );
            }}
          >
            <label className="sr-only" htmlFor="overview-query">
              Ask Assistant
            </label>
            <input
              id="overview-query"
              className="query-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask about a shipment…"
            />
            <Button
              type="submit"
              aria-label="Open Assistant with query"
              disabled={!query.trim()}
            >
              <ArrowRight size={18} />
            </Button>
          </form>
          <p className="muted text-xs mt-2">
            Review your query before sending.
          </p>
          <div className="overview-recent">
            <h3>Recent activity</h3>
            {recent.length ? (
              <EvidenceTimeline items={recent} />
            ) : (
              <p className="muted text-sm">
                No timestamped activity is available in this selection.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
