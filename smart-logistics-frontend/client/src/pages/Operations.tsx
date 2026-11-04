import { RecordPreview } from "@/components/Board";
import { lazy, Suspense, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useData } from "@/contexts/DataContext";
import {
  PageHeader,
  Panel,
  SourceNote,
  SourceState,
  StatusBadge,
  Freshness,
  EmptyState,
} from "@/components/Workspace";
import {
  emptyFilters,
  filterShipments,
  Filters,
  formatTime,
  Shipment,
} from "@/lib/workspace";
import { useHashQuery } from "@/lib/hash-location";
import { ExportActions } from "@/components/ExportActions";
import { List, MapPin, Plus } from "lucide-react";
const ShipmentMap = lazy(() =>
  import("@/components/Map").then(m => ({ default: m.MapView }))
);
export default function Operations() {
  const { shipments } = useData();
  const [path, navigate] = useLocation();
  const params = useHashQuery();
  const [view, setView] = useState<"list" | "map">("list");
  const [advanced, setAdvanced] = useState(false);
  const filters: Filters = {
    ...emptyFilters,
    ...Object.fromEntries(
      Object.keys(emptyFilters).map(k => [
        k,
        params.get(k) ?? emptyFilters[k as keyof Filters],
      ])
    ),
  };
  const visible = filterShipments(shipments.items, filters);
  const selected = visible.find(item => item.id === params.get("selected"));
  const pages = Math.max(1, Math.ceil(visible.length / 10));
  const page = Math.min(
    pages,
    Math.max(1, Math.floor(Number(params.get("page"))) || 1)
  );
  const slice = visible.slice((page - 1) * 10, page * 10);
  const set = (key: string, value: string) => {
    const q = new URLSearchParams(params);
    value ? q.set(key, value) : q.delete(key);
    if (key !== "page") q.delete("page");
    navigate(path + (q.size ? "?" + q : ""), { replace: key !== "page" });
  };
  const suffix = params.size ? "?" + params : "";
  const detail = (s: Shipment) =>
    `/supply-chain/shipments/${encodeURIComponent(s.id)}?return=${encodeURIComponent(path + suffix)}`;
  const exportRows = visible.map(s => ({
    ...s,
    observation: s.observedAt ?? "Unknown",
    source: s.provider ?? "Not supplied",
  }));
  return (
    <>
      <PageHeader
        title="Shipments"
        description="Track progress and resolve exceptions"
        actions={
          <div className="flex flex-wrap gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus size={15} />
                  Connect shipment source
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Shipment integration required</DialogTitle>
                <DialogDescription>
                  Production shipment creation is not supported by this
                  application. Authorized logistics webhooks populate the
                  shipment store. Ask your integration administrator to
                  configure the existing logistics event contract before
                  onboarding shipments.
                </DialogDescription>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <SourceNote
        count={
          shipments.status === "ready" ? shipments.items.length : undefined
        }
        total={shipments.total}
      />
      <div
        className={selected ? "records-layout has-preview" : "records-layout"}
      >
        <Panel>
          <div className="filter-toolbar">
            <label className="field">
              Search shipments
              <input
                type="search"
                placeholder="Tracking number, route, carrier…"
                value={filters.q}
                onChange={e => set("q", e.target.value)}
              />
            </label>
            <label className="field">
              Status
              <select
                value={filters.status}
                onChange={e => set("status", e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="attention">Needs attention</option>
                <option value="active">Active shipments</option>
                {Array.from(new Set(shipments.items.map(s => s.status)))
                  .sort()
                  .map(s => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </label>
            <Button
              className="mobile-filter-toggle"
              variant="outline"
              aria-expanded={advanced}
              aria-controls="filter-carrier filter-mode filter-dates"
              onClick={() => setAdvanced(v => !v)}
            >
              {advanced ? "Fewer filters" : "More filters"}
            </Button>
            <label
              id="filter-carrier"
              className={`field advanced-filter ${advanced ? "expanded" : ""}`}
            >
              Carrier
              <select
                value={filters.carrier}
                onChange={e => set("carrier", e.target.value)}
              >
                <option value="">All carriers</option>
                {Array.from(new Set(shipments.items.map(s => s.carrier)))
                  .sort()
                  .map(s => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </label>
            <label
              id="filter-mode"
              className={`field advanced-filter ${advanced ? "expanded" : ""}`}
            >
              Transport mode
              <select
                value={filters.mode}
                onChange={e => set("mode", e.target.value)}
              >
                <option value="">All modes</option>
                {Array.from(new Set(shipments.items.map(s => s.transportMode)))
                  .sort()
                  .map(s => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </label>
          </div>
          <div
            id="filter-dates"
            className={`filter-secondary advanced-filter ${advanced ? "expanded" : ""}`}
          >
            <label className="field">
              Created from
              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={e => set("from", e.target.value)}
              />
            </label>
            <label className="field">
              Created through
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={e => set("to", e.target.value)}
              />
            </label>
            <label className="field">
              Sort by
              <select
                value={filters.sort}
                onChange={e => set("sort", e.target.value)}
              >
                <option value="newest">Newest created</option>
                <option value="tracking">Tracking number</option>
                <option value="eta">Earliest ETA</option>
              </select>
            </label>
            <Button
              variant="ghost"
              onClick={() => navigate(path, { replace: true })}
            >
              Reset filters
            </Button>
          </div>
          <div className="list-summary">
            <span aria-live="polite">
              {shipments.status === "ready"
                ? `${visible.length} matching · ${visible.filter(s => ["Delayed", "Exception"].includes(s.status)).length} need attention`
                : shipments.status === "loading"
                  ? "Loading source…"
                  : "Record count unavailable"}
            </span>
            <div className="actions">
              <Button
                size="sm"
                variant={view === "list" ? "secondary" : "ghost"}
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <List size={14} />
                List
              </Button>
              <Button
                size="sm"
                variant={view === "map" ? "secondary" : "ghost"}
                aria-pressed={view === "map"}
                onClick={() => setView("map")}
              >
                <MapPin size={14} />
                Map
              </Button>
            </div>
          </div>
          {shipments.status !== "ready" || !shipments.items.length ? (
            <SourceState source={shipments} />
          ) : !visible.length ? (
            <EmptyState
              title="No matching shipments"
              description="Try another search or reset the filters."
              action={
                <Button
                  variant="outline"
                  onClick={() => navigate(path, { replace: true })}
                >
                  Reset filters
                </Button>
              }
            />
          ) : view === "map" ? (
            <Suspense fallback={<p role="status">Loading coordinate view…</p>}>
              <ShipmentMap
                assets={visible.flatMap(s =>
                  s.latitude === null || s.longitude === null
                    ? []
                    : [
                        {
                          id: s.id,
                          label: s.trackingNumber,
                          status: s.status,
                          observedAt: s.observedAt,
                          position: { lat: s.latitude, lng: s.longitude },
                          href: detail(s),
                        },
                      ]
                )}
              />
            </Suspense>
          ) : (
            <>
              <div className="desktop-records">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "19%" }}>Shipment</th>
                      <th style={{ width: "27%" }}>Route</th>
                      <th style={{ width: "16%" }}>Carrier / mode</th>
                      <th style={{ width: "19%" }}>ETA / observation</th>
                      <th style={{ width: "14%" }}>Status</th>
                      <th style={{ width: "5%" }}>
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map(s => (
                      <tr
                        key={s.id}
                        className={selected?.id === s.id ? "selected-row" : ""}
                      >
                        <td>
                          <Link href={detail(s)} className="record-link">
                            {s.trackingNumber}
                          </Link>
                          <button
                            className="record-preview-button"
                            data-preview-key={`shipment:${s.id}`}
                            onClick={() => set("selected", s.id)}
                            aria-label={`Preview ${s.trackingNumber}`}
                          >
                            Preview →
                          </button>
                        </td>
                        <td className="route-cell">
                          {s.origin}
                          <span>→ {s.destination}</span>
                        </td>
                        <td>
                          {s.carrier}
                          <span className="freshness">{s.transportMode}</span>
                        </td>
                        <td>
                          {formatTime(s.estimatedArrival)}
                          <Freshness shipment={s} compact />
                        </td>
                        <td>
                          <StatusBadge value={s.status} />
                        </td>
                        <td>
                          <Link
                            href={detail(s)}
                            className="record-link"
                            aria-label={`Open ${s.trackingNumber}`}
                          >
                            ↗
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-records">
                {slice.map(s => (
                  <article className="shipment-card" key={s.id}>
                    <div className="card-top">
                      <Link href={detail(s)} className="record-link">
                        {s.trackingNumber}
                      </Link>
                      <StatusBadge value={s.status} />
                    </div>
                    <button
                      className="record-preview-button"
                      data-preview-key={`shipment:${s.id}`}
                      onClick={() => set("selected", s.id)}
                      aria-label={`Preview ${s.trackingNumber}`}
                    >
                      Preview →
                    </button>
                    <div className="route-cell">
                      {s.origin}
                      <span>→ {s.destination}</span>
                    </div>
                    <div className="card-bottom">
                      <div>
                        ETA {formatTime(s.estimatedArrival)}
                        <Freshness shipment={s} compact />
                      </div>
                      <Link
                        href={detail(s)}
                        className="record-link"
                        aria-label={`Open ${s.trackingNumber}`}
                      >
                        Open ↗
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
              <div className="pagination">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => set("page", String(page - 1))}
                >
                  Previous
                </Button>
                <span>
                  Page {page} of {pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pages}
                  onClick={() => set("page", String(page + 1))}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </Panel>
        {selected && (
          <RecordPreview
            shipment={selected}
            onClose={() => set("selected", "")}
            href={detail(selected)}
          />
        )}
      </div>
      <div className="actions">
        <ExportActions
          items={shipments.status === "ready" ? exportRows : []}
          name="shipments"
          columns={[
            { key: "trackingNumber", label: "Tracking number" },
            { key: "id", label: "Stable record ID" },
            { key: "origin", label: "Origin" },
            { key: "destination", label: "Destination" },
            { key: "status", label: "Status" },
            { key: "carrier", label: "Carrier" },
            { key: "transportMode", label: "Transport mode" },
            { key: "estimatedArrival", label: "ETA" },
            { key: "observation", label: "Observed at" },
            { key: "source", label: "Observation provider" },
          ]}
          scope={`Filtered ${visible.length} of ${shipments.items.length} matching shipments; created ${filters.from || "any"} through ${filters.to || "any"}; ${JSON.stringify(filters)}`}
        />
      </div>
      <p className="muted text-xs">
        Dates filter creation time. Observation times refer to the latest stored
        logistics event, and do not timestamp every snapshot field. Events older
        than 24 hours are marked stale. A successful read does not establish
        real-time tracking.
      </p>
    </>
  );
}
