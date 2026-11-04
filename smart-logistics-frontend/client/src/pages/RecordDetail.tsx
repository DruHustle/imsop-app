import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "wouter";
import { ReadError, readSource, useData } from "@/contexts/DataContext";
import { demoShipments, demoOrders, demoEvents } from "@/lib/demo-data";
import {
  normalizeShipment,
  normalizeOrder,
  Shipment,
  OperationalOrder,
  TrackingEvent,
  formatTime,
} from "@/lib/workspace";
import {
  PageHeader,
  Panel,
  SourceNote,
  StatusBadge,
  EmptyState,
  Freshness,
} from "@/components/Workspace";
import { Button } from "@/components/ui/button";
import { useHashQuery } from "@/lib/hash-location";
const ShipmentChronology = lazy(
  () => import("@/components/ShipmentChronology")
);
interface Props {
  kind: "shipments" | "orders";
  id: string;
  tracking?: boolean;
}
export default function RecordDetail(props: Props) {
  const { mode } = useData();
  return (
    <Detail
      key={`${mode}:${props.kind}:${props.id}:${props.tracking}`}
      {...props}
    />
  );
}
function Detail({ kind, id, tracking = false }: Props) {
  const { mode } = useData();
  const [record, setRecord] = useState<Shipment | OperationalOrder | null>(
    null
  );
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [error, setError] = useState<ReadError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [eventPage, setEventPage] = useState(0);
  const query = useHashQuery();
  const returnTo = query.get("return");
  const back =
    returnTo &&
    (returnTo === `/supply-chain/${kind}` ||
      returnTo.startsWith(`/supply-chain/${kind}?`) ||
      returnTo === "/" ||
      returnTo.startsWith("/?"))
      ? returnTo
      : `/supply-chain/${kind}`;
  useEffect(() => {
    const c = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => c.abort(), 10000);
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        if (mode === "demo") {
          const found = (
            kind === "shipments" ? demoShipments : demoOrders
          ).find(s => s.id === id);
          if (!found) throw new ReadError(404, "Record not found.");
          setRecord(found);
          setEvents(tracking ? demoEvents(id) : []);
        } else {
          const data = await readSource(
            `/api/operations/${kind}/${encodeURIComponent(id)}`,
            c.signal
          );
          if (disposed) return;
          setRecord(
            kind === "shipments"
              ? normalizeShipment(data)
              : normalizeOrder(data)
          );
          if (tracking) {
            const result = await readSource(
              `/api/operations/shipments/${encodeURIComponent(id)}/events?limit=50&offset=${eventPage * 50}`,
              c.signal
            );
            if (!disposed) setEvents(result.items);
          }
        }
      } catch (e) {
        if (!disposed)
          setError(e instanceof Error ? e : new Error("Source unavailable."));
      } finally {
        clearTimeout(timeout);
        if (!disposed) setLoading(false);
      }
    };
    void load();
    return () => {
      disposed = true;
      clearTimeout(timeout);
      c.abort();
    };
  }, [id, kind, mode, tracking, retry, eventPage]);
  const isShipment = record && "trackingNumber" in record;
  const shipment = isShipment ? (record as Shipment) : null;
  const order = record && !isShipment ? (record as OperationalOrder) : null;
  const base = `/supply-chain/${kind}/${encodeURIComponent(id)}`;
  const suffix = returnTo ? "?return=" + encodeURIComponent(back) : "";
  return (
    <>
      <Link className="record-link text-xs" href={back}>
        ← Return to filtered {kind}
      </Link>
      <PageHeader
        eyebrow={kind === "shipments" ? "Shipment detail" : "Operational order"}
        title={
          shipment?.trackingNumber ?? order?.orderNumber ?? "Record detail"
        }
        description={`Review ${kind === "shipments" ? "shipment" : "order"} ${id}, its latest evidence and next steps.`}
      />
      <SourceNote />
      {kind === "shipments" && (
        <nav className="detail-tabs" aria-label="Shipment sections">
          <Link
            href={base + suffix}
            aria-current={!tracking ? "page" : undefined}
          >
            Overview
          </Link>
          <Link
            href={base + "/tracking" + suffix}
            aria-current={tracking ? "page" : undefined}
          >
            Tracking / events
          </Link>
        </nav>
      )}
      {loading ? (
        <Panel>
          <p role="status">
            Loading record{tracking ? " and tracking events" : ""}…
          </p>
        </Panel>
      ) : error ? (
        <Panel>
          <EmptyState
            title={
              error instanceof ReadError && error.status === 403
                ? "Access denied"
                : error instanceof ReadError && error.status === 404
                  ? "Record not found"
                  : "Source unavailable"
            }
            description={error.message}
            action={
              <Button variant="outline" onClick={() => setRetry(v => v + 1)}>
                Retry read
              </Button>
            }
          />
        </Panel>
      ) : (
        record && (
          <>
            {tracking ? (
              <Panel
                title="Tracking events"
                description="Provider observation and receipt times are preserved. No event payload is interpreted as a current provider connection."
              >
                {events.length > 0 && (
                  <Suspense
                    fallback={<p role="status">Loading event chronology…</p>}
                  >
                    <ShipmentChronology events={events} href={base + suffix} />
                  </Suspense>
                )}
                {events.length ? (
                  events.map(e => (
                    <article className="event-row" key={e.id}>
                      <h3>{e.eventType}</h3>
                      <p>Provider: {e.provider}</p>
                      <p>Occurred: {formatTime(e.occurredAt)}</p>
                      <p>Received: {formatTime(e.receivedAt)}</p>
                      <p>
                        Source:{" "}
                        {mode === "demo"
                          ? "Demo event fixture"
                          : "node.logistics_events"}{" "}
                        · Event #{e.id}
                      </p>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    title="No tracking events in this page"
                    description="No provider event history was returned. A shipment database record alone does not prove active tracking."
                  />
                )}
                {mode === "live" && (
                  <div className="pagination">
                    <Button
                      variant="outline"
                      disabled={eventPage === 0}
                      onClick={() => setEventPage(v => v - 1)}
                    >
                      Previous events
                    </Button>
                    <span>Page {eventPage + 1}</span>
                    <Button
                      variant="outline"
                      disabled={events.length < 50}
                      onClick={() => setEventPage(v => v + 1)}
                    >
                      Older events
                    </Button>
                  </div>
                )}
              </Panel>
            ) : (
              <Panel title="Overview">
                <dl className="detail-grid">
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <StatusBadge value={record.status} />
                    </dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatTime(record.createdAt)}</dd>
                  </div>
                  {shipment && (
                    <>
                      <div>
                        <dt>Origin</dt>
                        <dd>{shipment.origin}</dd>
                      </div>
                      <div>
                        <dt>Destination</dt>
                        <dd>{shipment.destination}</dd>
                      </div>
                      <div>
                        <dt>Carrier / transport mode</dt>
                        <dd>
                          {shipment.carrier} / {shipment.transportMode}
                        </dd>
                      </div>
                      <div>
                        <dt>Estimated arrival</dt>
                        <dd>{formatTime(shipment.estimatedArrival)}</dd>
                      </div>
                      <div>
                        <dt>Actual arrival</dt>
                        <dd>{formatTime(shipment.actualArrival)}</dd>
                      </div>
                      <div>
                        <dt>Latest recorded event evidence</dt>
                        <dd>
                          {shipment.provider ?? "Provider not supplied"}
                          <Freshness shipment={shipment} />
                          Received {formatTime(shipment.receivedAt)}
                        </dd>
                      </div>
                      <div>
                        <dt>Coordinates supplied by source</dt>
                        <dd>
                          {shipment.latitude !== null &&
                          shipment.longitude !== null
                            ? `${shipment.latitude}, ${shipment.longitude}`
                            : "Not supplied"}
                        </dd>
                      </div>
                    </>
                  )}
                  {order && (
                    <>
                      <div>
                        <dt>Customer ID</dt>
                        <dd>{order.customerId ?? "Not supplied"}</dd>
                      </div>
                      <div>
                        <dt>Source amount</dt>
                        <dd>
                          {order.totalAmount ?? "Not supplied"} ·{" "}
                          {order.currency ?? "Currency unknown"}
                        </dd>
                      </div>
                      <div>
                        <dt>Source identity</dt>
                        <dd>node.orders · Numeric ID {order.id}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </Panel>
            )}
            <Panel title="Available context">
              <p className="muted text-xs">
                {shipment
                  ? "This shipment contract has no authorized order or document association."
                  : "Line items, supplier and shipment associations are not supplied."}
              </p>
              <Link
                className="record-link inline-block mt-3 text-xs"
                href={`/insights/assistant?item=${encodeURIComponent((shipment ? "shipment:" : "order:") + id)}&q=${encodeURIComponent("Look up " + (shipment?.trackingNumber ?? order?.orderNumber))}`}
              >
                Ask Assistant about this record ↗
              </Link>
            </Panel>
          </>
        )
      )}
    </>
  );
}
