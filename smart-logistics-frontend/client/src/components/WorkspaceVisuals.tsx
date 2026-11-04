import { useState } from "react";
import { Link } from "wouter";
import {
  Shipment,
  OperationalOrder,
  performance,
  isException,
  isStale,
  DEMO_AS_OF,
  formatTime,
} from "@/lib/workspace";
import { statusColor } from "@/lib/overview";
import { AnswerRecord } from "@/lib/assistant";
import { Panel, StatusBadge, Freshness } from "./Workspace";
import { Button } from "./ui/button";

export function OrderStages({
  items,
  selected,
  onSelect,
}: {
  items: OperationalOrder[];
  selected: string;
  onSelect: (s: string) => void;
}) {
  const stages = Array.from(
    new Set(["Pending", "Processing", "Completed", ...items.map(o => o.status)])
  );
  return (
    <Panel
      title="Fulfilment stages"
      description="Current recorded states. Stage positions do not imply unrecorded transitions or completion dates."
    >
      <div
        className="fulfilment-stages"
        role="group"
        aria-label="Filter orders by fulfilment stage"
      >
        {stages.map((stage, i) => {
          const count = items.filter(o => o.status === stage).length;
          return (
            <button
              key={stage}
              aria-pressed={selected === stage}
              onClick={() => onSelect(selected === stage ? "" : stage)}
            >
              <span className="stage-number">{i + 1}</span>
              <span>{stage}</span>
              <strong>{count}</strong>
              <progress
                aria-label={`${count} of ${items.length} orders ${stage}`}
                value={count}
                max={Math.max(1, items.length)}
              />
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
export function CarrierComparison({
  items,
  onSelect,
}: {
  items: Shipment[];
  onSelect: (carrier: string) => void;
}) {
  const groups = Array.from(new Set(items.map(s => s.carrier)))
      .map(carrier => ({
        carrier,
        items: items.filter(s => s.carrier === carrier),
      }))
      .sort((a, b) => b.items.length - a.items.length),
    max = Math.max(1, ...groups.map(g => g.items.length));
  return (
    <figure aria-label="Shipment volume and eligible on-time performance by carrier">
      <div className="carrier-comparison">
        {groups.map(g => {
          const p = performance(g.items),
            delivered = g.items.filter(s => s.status === "Delivered").length;
          return (
            <button
              key={g.carrier}
              onClick={() => onSelect(g.carrier)}
              aria-label={`Filter carrier ${g.carrier}, ${g.items.length} shipments`}
            >
              <span className="carrier-name">{g.carrier}</span>
              <span className="carrier-track">
                <span style={{ width: `${(g.items.length / max) * 100}%` }} />
                <span
                  className="carrier-delivered"
                  style={{ width: `${(delivered / max) * 100}%` }}
                />
              </span>
              <strong>{g.items.length}</strong>
              <small>
                {delivered} delivered · On time {p.onTime}/{p.denominator}{" "}
                eligible
              </small>
            </button>
          );
        })}
      </div>
      <figcaption className="muted text-xs mt-3">
        Bar length: selected shipments. Inner bar: recorded delivered status.
        Select a carrier to filter the comparison and delivery chart.
      </figcaption>
    </figure>
  );
}
export function ReviewEvidence({
  items,
  mode,
}: {
  items: Shipment[];
  mode: "demo" | "live";
}) {
  const [scenario, setScenario] = useState("exceptions"),
    [selected, setSelected] = useState("");
  const exceptions = items.filter(isException),
    now = mode === "demo" ? Date.parse(DEMO_AS_OF) : Date.now();
  const observedOrder = (s: Shipment) => {
    const time = Date.parse(s.observedAt ?? "");
    return Number.isFinite(time) ? time : Infinity;
  };
  const candidates = [...exceptions].sort((a, b) =>
    scenario === "oldest"
      ? observedOrder(a) - observedOrder(b)
      : Number(b.status === "Exception") - Number(a.status === "Exception")
  );
  const record = exceptions.find(s => s.id === selected);
  return (
    <Panel
      title="Review evidence"
      description="Proposed review order based on recorded status and observation age. No estimated savings, confidence scores or predicted causes."
    >
      <div className="actions mb-3">
        <Button
          variant={scenario === "exceptions" ? "default" : "outline"}
          size="sm"
          onClick={() => setScenario("exceptions")}
        >
          Exceptions first
        </Button>
        <Button
          variant={scenario === "oldest" ? "default" : "outline"}
          size="sm"
          onClick={() => setScenario("oldest")}
        >
          Oldest evidence first
        </Button>
      </div>
      <div className="evidence-lanes">
        {(scenario === "oldest"
          ? Array.from(
              new Set([
                ...candidates.map(s => s.status),
                "Exception",
                "Delayed",
              ])
            )
          : ["Exception", "Delayed"]
        ).map(status => (
          <div key={status}>
            <h3>
              <i style={{ background: statusColor(status) }} />
              {status}{" "}
              <span>{exceptions.filter(s => s.status === status).length}</span>
            </h3>
            {candidates
              .filter(s => s.status === status)
              .map(s => (
                <button
                  key={s.id}
                  aria-pressed={selected === s.id}
                  onClick={() => setSelected(s.id)}
                >
                  <strong>{s.trackingNumber}</strong>
                  <span>
                    {s.origin} → {s.destination}
                  </span>
                  <small>
                    {!s.observedAt
                      ? "Observation unavailable"
                      : isStale(s, now)
                        ? "Observation stale"
                        : "Recent observation"}{" "}
                    · {formatTime(s.observedAt)}
                  </small>
                </button>
              ))}
          </div>
        ))}
      </div>
      {!exceptions.length && (
        <p className="muted">
          No recorded exceptions in the authorized selection.
        </p>
      )}
      {record && (
        <div className="map-record-context">
          <strong>{record.trackingNumber}</strong>
          <Freshness shipment={record} />
          <p>
            Proposed next step: review the recorded event and document
            follow-up. A cause or corrective route has not been inferred.
          </p>
          <Link
            className="record-link"
            href={`/supply-chain/shipments/${record.id}`}
          >
            Inspect shipment evidence →
          </Link>
        </div>
      )}
    </Panel>
  );
}
export function AnswerVisual({ records }: { records: AnswerRecord[] }) {
  return (
    <div className="answer-records" aria-label="Answer record context">
      {records.map(r => (
        <Link className="answer-record" key={r.key} href={r.href}>
          <span className="answer-record-icon" aria-hidden="true">
            {r.kind === "shipment" ? "↗" : "▤"}
          </span>
          <div>
            <strong>{r.identifier}</strong>
            <p>{r.route}</p>
            <span className="muted text-xs">
              {r.kind === "shipment" ? "Observed" : "Created"}{" "}
              {formatTime(r.observedAt)}
            </span>
          </div>
          <StatusBadge value={r.status} />
        </Link>
      ))}
    </div>
  );
}
export interface HealthNode {
  name: string;
  status: string;
  evidence: string;
  checkedAt: string | null;
}
export function HealthTopology({ nodes }: { nodes: HealthNode[] }) {
  const [selected, setSelected] = useState("");
  const node = nodes.find(n => n.name === selected);
  return (
    <div className="health-topology">
      <div className="topology-root">
        <span className="topology-glyph" aria-hidden="true">
          ◈
        </span>
        <strong>API boundary</strong>
        <span className="muted text-xs">Logical check relationships</span>
      </div>
      <div className="topology-branches">
        {nodes.map(n => (
          <button
            key={n.name}
            onClick={() => setSelected(n.name)}
            aria-pressed={selected === n.name}
          >
            <span className={`health-light ${n.status.toLowerCase()}`} />
            <strong>{n.name}</strong>
            <StatusBadge value={n.status} />
          </button>
        ))}
      </div>
      <p className="muted text-xs">
        Edges show which checks describe the API. They do not represent measured
        network traffic or provider connectivity.
      </p>
      {node && (
        <div className="map-record-context" role="status">
          <strong>{node.name}</strong>
          <p>{node.evidence}</p>
          <p>Checked {formatTime(node.checkedAt)}</p>
        </div>
      )}
    </div>
  );
}
export function ConnectionFlow({
  sources,
  mode,
  loading,
  error,
}: {
  sources: {
    provider: string;
    enabled: boolean;
    signatureConfigured: boolean;
    lastReceivedAt?: string;
  }[];
  mode: string;
  loading: boolean;
  error: string;
}) {
  const [selected, setSelected] = useState("");
  const item = sources.find(s => s.provider === selected);
  return (
    <Panel
      title="Observation flow"
      description="Configuration and stored receipts, separated from connectivity evidence."
    >
      {loading ? (
        <p role="status">Reading connection configuration…</p>
      ) : error ? (
        <p className="muted">
          Connection evidence unavailable. Retry the source read.
        </p>
      ) : (
        <>
          <div className="connection-flow">
            <div className="flow-sources">
              {sources.length ? (
                sources.map(s => (
                  <button
                    key={s.provider}
                    aria-pressed={selected === s.provider}
                    onClick={() => setSelected(s.provider)}
                  >
                    <strong>{s.provider}</strong>
                    <StatusBadge
                      value={
                        s.enabled && s.signatureConfigured
                          ? "Configured"
                          : "Not configured"
                      }
                    />
                  </button>
                ))
              ) : (
                <div className="flow-unavailable">
                  No provisioned carrier source
                </div>
              )}
            </div>
            <span className="flow-arrow" aria-hidden="true">
              →
            </span>
            <div className="flow-gate">
              <span aria-hidden="true">◇</span>
              <strong>Signed intake</strong>
              <small>Workspace binding required</small>
            </div>
            <span className="flow-arrow" aria-hidden="true">
              →
            </span>
            <div className="flow-destination">
              <strong>Workspace records</strong>
              <small>Observations → reviews</small>
            </div>
          </div>
          <p className="muted text-xs mt-3">
            {mode === "demo"
              ? "Demonstration flow. No carrier or production connection is asserted."
              : "Configured intake does not confirm current connectivity. Only stored receipts establish past intake."}
          </p>
          {item && (
            <div role="status" className="map-record-context">
              <strong>{item.provider}</strong>
              <p>
                Signature {item.signatureConfigured ? "configured" : "missing"}{" "}
                · Intake {item.enabled ? "enabled" : "disabled"}
              </p>
              <p>Last received {formatTime(item.lastReceivedAt ?? null)}</p>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
