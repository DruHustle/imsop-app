import { CarrierComparison } from "@/components/WorkspaceVisuals";
import { useLocation } from "wouter";
import { useHashQuery } from "@/lib/hash-location";
import { DeliveryTrend } from "@/components/Board";
import { useData } from "@/contexts/DataContext";
import {
  PageHeader,
  Panel,
  Metric,
  SourceNote,
  SourceState,
  EmptyState,
} from "@/components/Workspace";
import { filterShipments, emptyFilters, performance } from "@/lib/workspace";
import { ExportActions } from "@/components/ExportActions";
export default function AnalyticsPage() {
  const { shipments } = useData();
  const [path, navigate] = useLocation();
  const params = useHashQuery();
  const from = params.get("from") || "",
    to = params.get("to") || "",
    carrier = params.get("carrier") || "";
  const set = (key: string, value: string) => {
    const q = new URLSearchParams(params);
    value ? q.set(key, value) : q.delete(key);
    navigate(path + (q.size ? "?" + q : ""), { replace: true });
  };
  const setFrom = (value: string) => set("from", value),
    setTo = (value: string) => set("to", value),
    setCarrier = (value: string) => set("carrier", value);
  const items = filterShipments(shipments.items, {
    ...emptyFilters,
    from,
    to,
    carrier,
  });
  const metrics = performance(items);
  const ready = shipments.status === "ready";
  const statuses = Array.from(new Set(items.map(s => s.status)))
    .sort()
    .map(status => ({
      status,
      shipments: items.filter(s => s.status === status).length,
    }));
  const rows = items.map(s => ({
    trackingNumber: s.trackingNumber,
    createdAt: s.createdAt,
    status: s.status,
    carrier: s.carrier,
    estimatedArrival: s.estimatedArrival,
    promisedArrival: s.promisedArrival,
    actualArrival: s.actualArrival,
    observedAt: s.observedAt,
    provider: s.provider,
  }));
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Understand recorded delivery performance"
      />
      <SourceNote
        count={
          shipments.status === "ready" ? shipments.items.length : undefined
        }
        total={shipments.total}
      />
      <Panel>
        <div className="filter-toolbar">
          <label className="field">
            Created from
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={e => setFrom(e.target.value)}
            />
          </label>
          <label className="field">
            Created through
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={e => setTo(e.target.value)}
            />
          </label>
          <label className="field">
            Carrier
            <select value={carrier} onChange={e => setCarrier(e.target.value)}>
              <option value="">All carriers</option>
              {Array.from(new Set(shipments.items.map(s => s.carrier)))
                .sort()
                .map(s => (
                  <option key={s}>{s}</option>
                ))}
            </select>
          </label>
          <button
            className="record-link text-xs self-end p-2"
            onClick={() => {
              navigate(path, { replace: true });
            }}
          >
            Reset scope
          </button>
        </div>
      </Panel>
      <div className="metric-grid metric-grid-three">
        <Metric
          kind="shipments"
          label="Shipments in scope"
          value={ready ? items.length : "—"}
          description="Created within selected dates"
        />
        <Metric
          kind="delivered"
          label="Delivered"
          value={
            ready ? items.filter(s => s.status === "Delivered").length : "—"
          }
          description="Recorded delivered status"
        />
        <Metric
          kind="performance"
          label="On-time deliveries"
          value={
            ready && metrics.rate !== null
              ? `${metrics.rate.toFixed(1)}%`
              : "Not available"
          }
          description={`${metrics.onTime} / ${metrics.denominator} eligible deliveries`}
        />
      </div>
      {!ready || !shipments.items.length ? (
        <Panel>
          <SourceState source={shipments} />
        </Panel>
      ) : !items.length ? (
        <Panel>
          <EmptyState
            title="No matching shipments"
            description="Change the dates or carrier to explore another scope."
          />
        </Panel>
      ) : (
        <div className="two-column">
          <Panel
            title="Carrier comparison"
            description={`${items.length} filtered records; counts include every record in scope.`}
          >
            <CarrierComparison items={items} onSelect={setCarrier} />
          </Panel>
          <Panel
            title="Delivery performance"
            description="Recorded actual-arrival dates in the selected shipment scope"
          >
            <DeliveryTrend items={items} />
          </Panel>
        </div>
      )}
      <details className="source-details">
        <summary>How on-time performance is calculated</summary>
        <p>
          Eligible deliveries have both explicit actual arrival and the original
          retained promise. On time means actual arrival at or before that
          promise. ETA revisions do not improve the baseline. Filters select
          shipment creation dates in UTC; the chart groups these selected
          deliveries by actual-arrival date.
        </p>
      </details>
      <div className="actions">
        <ExportActions
          items={ready ? rows : []}
          name="shipment-analytics"
          columns={[
            { key: "trackingNumber", label: "Tracking number" },
            { key: "createdAt", label: "Created at (UTC)" },
            { key: "status", label: "Recorded status" },
            { key: "carrier", label: "Carrier" },
            { key: "estimatedArrival", label: "Current ETA" },
            { key: "promisedArrival", label: "Original promise" },
            { key: "actualArrival", label: "Actual arrival" },
            { key: "observedAt", label: "Observed at" },
            { key: "provider", label: "Observation provider" },
          ]}
          scope={`Filtered records: ${items.length}; created ${from || "any date"} through ${to || "any date"} UTC; carrier ${carrier || "all"}; on-time ${metrics.onTime}/${metrics.denominator}; within ${shipments.items.length} matching shipments`}
        />
      </div>
    </>
  );
}
