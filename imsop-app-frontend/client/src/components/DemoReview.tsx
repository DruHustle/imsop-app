import { useState } from "react";
import { Link } from "wouter";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { safeLocalStorage } from "@/lib/storage";
import { isException, formatTime, DEMO_AS_OF } from "@/lib/workspace";
import { Panel, StatusBadge } from "./Workspace";
import { Button } from "./ui/button";
import { EvidenceTimeline } from "./Board";
interface DemoCase {
  state: string;
  owner: string;
  history: { id: string; title: string; date: string; detail?: string }[];
}
export function DemoReview() {
  const { shipments, scope } = useData(),
    { user } = useAuth(),
    items = shipments.items.filter(isException);
  const editable = !!user && ["admin", "engineer"].includes(user.role);
  const key = `imsop:demo-reviews:${scope}`;
  const [cases, setCases] = useState<Record<string, DemoCase>>(() => {
      try {
        return JSON.parse(safeLocalStorage.getItem(key) || "{}");
      } catch {
        return {};
      }
    }),
    [selected, setSelected] = useState(items[0]?.id || ""),
    [note, setNote] = useState(""),
    [notice, setNotice] = useState("");
  const item = items.find(i => i.id === selected),
    record = cases[selected] || { state: "open", owner: "", history: [] };
  const act = (action: string, owner = record.owner) => {
    if (!item) return;
    const history = [
      {
        id: crypto.randomUUID(),
        title: action,
        date: DEMO_AS_OF,
        detail: note.trim() || undefined,
      },
      ...record.history,
    ];
    const updated = {
      ...cases,
      [selected]: {
        state:
          action === "Review resolved"
            ? "resolved"
            : action === "Review acknowledged"
              ? "acknowledged"
              : record.state,
        owner,
        history,
      },
    };
    setCases(updated);
    safeLocalStorage.setItem(key, JSON.stringify(updated));
    setNote("");
    setNotice("Demo case saved on this device. No live shipment was changed.");
  };
  return (
    <div className="review-workbench demo-review">
      <Panel
        title="Review queue"
        actions={<span className="muted text-xs">{items.length} items</span>}
      >
        {items.length ? (
          items.map(s => (
            <article
              key={s.id}
              className={`review-card ${selected === s.id ? "selected-row" : ""}`}
            >
              <div className="flex justify-between gap-2">
                <h3>{s.trackingNumber}</h3>
                <StatusBadge value={s.status} />
              </div>
              <p className="muted text-sm">
                {s.origin} → {s.destination}
              </p>
              <p className="freshness">
                Last observation {formatTime(s.observedAt)}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelected(s.id);
                  setNote("");
                  setNotice("");
                }}
              >
                Review case
              </Button>
            </article>
          ))
        ) : (
          <p className="muted">No exception shipments in this selection.</p>
        )}
      </Panel>
      <Panel title="Shipment review">
        {item ? (
          <>
            <h3>{item.trackingNumber}</h3>
            <StatusBadge value={record.state} />
            <dl className="preview-facts mt-4">
              <dt>Route</dt>
              <dd>
                {item.origin} → {item.destination}
              </dd>
              <dt>Last observation</dt>
              <dd>{formatTime(item.observedAt)}</dd>
            </dl>
            <label className="field mt-4">
              Owner
              <select
                disabled={!editable}
                value={record.owner}
                onChange={e => act("Assignment updated", e.target.value)}
              >
                <option value="">Unassigned</option>
                <option value={user!.id}>{user!.name}</option>
              </select>
            </label>
            <label className="field mt-4">
              Review note
              <textarea
                disabled={!editable}
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={2000}
                placeholder="Add a note about this case…"
              />
            </label>
            <div className="actions mt-4">
              <Button
                disabled={!editable || record.state !== "open"}
                onClick={() => act("Review acknowledged")}
              >
                Acknowledge review
              </Button>
              <Button
                variant="outline"
                disabled={!editable || !note.trim()}
                onClick={() => act("Note added")}
              >
                Save note
              </Button>
              <Button
                variant="outline"
                disabled={!editable || record.state === "resolved"}
                onClick={() => act("Review resolved")}
              >
                Resolve review
              </Button>
            </div>
            {!editable && (
              <p className="muted text-xs mt-3">
                An operator role is required to save review actions.
              </p>
            )}
            {notice && (
              <p role="status" className="muted text-xs mt-3">
                {notice}
              </p>
            )}
            <Link
              className="record-link block mt-4"
              href={`/supply-chain/shipments/${item.id}/tracking`}
            >
              Review event evidence ↗
            </Link>
            <h3 className="mt-6 mb-3">Review history</h3>
            <EvidenceTimeline
              items={
                record.history.length
                  ? record.history
                  : [
                      {
                        id: "created",
                        title: "Demo case created",
                        date: DEMO_AS_OF,
                        detail: "System · Recorded exception",
                      },
                    ]
              }
            />
            <p className="muted text-xs mt-4">
              Demonstration · Local review actions use the demo as-of time.
              Carrier status is unchanged.
            </p>
          </>
        ) : (
          <p className="muted">Choose a shipment to review.</p>
        )}
      </Panel>
    </div>
  );
}
