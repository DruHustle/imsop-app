import { useEffect, useState, useCallback, useRef } from "react";
import { requestJSON } from "@/lib/requests";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { readSource } from "@/contexts/DataContext";
import { API_ORIGIN } from "@/lib/api-origin";
import { formatTime } from "@/lib/workspace";
import { Panel, StatusBadge } from "./Workspace";
import { Button } from "./ui/button";
interface Review {
  id: number;
  shipmentId: number;
  trackingNumber: string;
  state: string;
  version: number;
  assigneeId: number | null;
  updatedAt: string;
}
export function OperationalReview() {
  const { user } = useAuth();
  const editable = !!user && ["admin", "engineer"].includes(user.role);
  const [items, setItems] = useState<Review[]>([]),
    [operators, setOperators] = useState<{ id: number; name: string }[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Review | null>(null),
    [note, setNote] = useState(""),
    [history, setHistory] = useState<
      {
        id: number;
        action: string;
        actorName: string;
        note: string | null;
        occurredAt: string;
      }[]
    >([]);
  const historyRequest = useRef<AbortController | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [offset, setOffset] = useState(0),
    [state, setState] = useState(""),
    [total, setTotal] = useState(0);
  useEffect(() => () => historyRequest.current?.abort(), []);
  const load = useCallback(async () => {
    setLoading(true);
    const c = new AbortController(),
      t = setTimeout(() => c.abort(), 10000);
    try {
      const data = await readSource(
        `/api/operations/reviews?limit=100&offset=${offset}${state ? "&state=" + state : ""}`,
        c.signal
      );
      setItems(data.items);
      setTotal(data.total ?? data.items.length);
      if (editable)
        setOperators(
          (await readSource("/api/operations/reviews/operators", c.signal))
            .items
        );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reviews unavailable");
    } finally {
      clearTimeout(t);
      setLoading(false);
    }
  }, [editable, offset, state]);
  useEffect(() => {
    void load();
  }, [load]);
  const inspect = async (item: Review) => {
    historyRequest.current?.abort();
    const c = new AbortController();
    historyRequest.current = c;
    setSelected(item);
    setNote("");
    setHistory([]);
    setHistoryLoading(true);
    setError("");
    try {
      const data = await requestJSON(
        `/api/operations/reviews/${item.id}/actions`,
        "GET",
        undefined,
        undefined,
        c.signal
      );
      if (!c.signal.aborted) setHistory(data.items);
    } catch (e) {
      if (!c.signal.aborted) setError("Case history could not be read.");
    } finally {
      if (historyRequest.current === c) setHistoryLoading(false);
    }
  };
  const act = async (action: string, assigneeId?: number | null) => {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    const c = new AbortController(),
      t = setTimeout(() => c.abort(), 10000);
    try {
      const response = await fetch(
        `${API_ORIGIN}/api/operations/reviews/${selected.id}/actions`,
        {
          method: "POST",
          credentials: "include",
          signal: c.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            version: selected.version,
            ...(note.trim() ? { note: note.trim() } : {}),
            ...(assigneeId !== undefined ? { assigneeId } : {}),
          }),
        }
      );
      if (response.status === 401)
        window.dispatchEvent(new Event("imsop:session-expired"));
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Action could not be saved."
        );
      setSelected(null);
      setHistory([]);
      setNote("");
      await load();
      window.dispatchEvent(new Event("imsop:review-changed"));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Refresh before retrying."
      );
    } finally {
      clearTimeout(t);
      setBusy(false);
    }
  };
  return (
    <Panel
      className="review-panel"
      title="Exception review"
      description="Acknowledge, assign and document follow-up. Resolving a review does not change carrier status."
      actions={
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          Refresh reviews
        </Button>
      }
    >
      <label className="field mb-3">
        Case state
        <select
          value={state}
          disabled={loading}
          onChange={e => {
            setState(e.target.value);
            setOffset(0);
            setSelected(null);
            historyRequest.current?.abort();
          }}
        >
          <option value="">All cases</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
      </label>
      <div className="review-workbench">
        <div className="review-queue">
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {loading ? (
            <p role="status">Loading reviews…</p>
          ) : !items.length ? (
            <p className="muted">
              No review cases. New delayed or exception events open a case here.
            </p>
          ) : (
            items.map(item => (
              <article className="attention-row" key={item.id}>
                <div>
                  <h3>{item.trackingNumber}</h3>
                  <p className="muted text-xs">
                    Updated {formatTime(item.updatedAt)} ·{" "}
                    {item.assigneeId
                      ? `Assigned to ${operators.find(o => o.id === item.assigneeId)?.name ?? "workspace operator"}`
                      : "Unassigned"}
                  </p>
                  <Link
                    className="record-link"
                    href={`/supply-chain/shipments/${item.shipmentId}`}
                  >
                    Open shipment ↗
                  </Link>
                </div>
                <div className="actions">
                  <StatusBadge value={item.state} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => inspect(item)}
                  >
                    Review case
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
        {selected ? (
          <section
            className="review-detail space-y-4"
            aria-label={`Review ${selected.trackingNumber}`}
          >
            <h3>{selected.trackingNumber} · Case history</h3>
            {historyLoading && <p role="status">Loading case history…</p>}
            {history.map(h => (
              <p key={h.id} className="text-sm">
                {h.action} · {h.actorName} · {formatTime(h.occurredAt)}
                {h.note && ` · ${h.note}`}
              </p>
            ))}
            {editable && (
              <>
                <label className="field">
                  Review note
                  <textarea
                    className="border rounded p-2 bg-background"
                    maxLength={2000}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                </label>
                <div className="actions flex-wrap">
                  <Button
                    disabled={busy || selected.state !== "open"}
                    onClick={() => act("acknowledge")}
                  >
                    Acknowledge
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !note.trim()}
                    onClick={() => act("note")}
                  >
                    Save note
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      act(selected.state === "resolved" ? "reopen" : "resolve")
                    }
                  >
                    {selected.state === "resolved"
                      ? "Reopen review"
                      : "Resolve review"}
                  </Button>
                  <label className="field">
                    Assign to
                    <select
                      aria-label="Assign to"
                      disabled={busy}
                      value={selected.assigneeId ?? ""}
                      onChange={e =>
                        act(
                          "assign",
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    >
                      <option value="">Unassigned</option>
                      {operators.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                historyRequest.current?.abort();
                setSelected(null);
                setHistory([]);
              }}
            >
              Close case
            </Button>
          </section>
        ) : (
          <div className="review-detail review-placeholder">
            <h3>Shipment review</h3>
            <p className="muted">
              Choose a case to review its history, assign an owner and record
              follow-up.
            </p>
          </div>
        )}
      </div>
      {total > 100 && (
        <nav className="pagination" aria-label="Review case pages">
          <Button
            size="sm"
            variant="outline"
            disabled={loading || offset === 0}
            onClick={() => {
              setSelected(null);
              historyRequest.current?.abort();
              setOffset(value => Math.max(0, value - 100));
            }}
          >
            Previous cases
          </Button>
          <span>
            Page {Math.floor(offset / 100) + 1} of {Math.ceil(total / 100)} ·{" "}
            {total} cases
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || offset + 100 >= total}
            onClick={() => {
              setSelected(null);
              historyRequest.current?.abort();
              setOffset(value => value + 100);
            }}
          >
            Next cases
          </Button>
        </nav>
      )}
    </Panel>
  );
}
export function LiveNotifications() {
  const [items, setItems] = useState<
      {
        id: number;
        shipmentId: number;
        trackingNumber: string;
        action: string;
        read: boolean;
        occurredAt: string;
      }[]
    >([]),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    const c = new AbortController(),
      t = setTimeout(() => c.abort(), 10000);
    try {
      setItems(
        (await readSource("/api/operations/notifications", c.signal)).items
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Notifications unavailable");
    } finally {
      clearTimeout(t);
    }
  }, []);
  useEffect(() => {
    void load();
    window.addEventListener("imsop:review-changed", load);
    return () => window.removeEventListener("imsop:review-changed", load);
  }, [load]);
  const mark = async (id: number) => {
    try {
      await requestJSON(`/api/operations/notifications/${id}/read`, "POST");
      await load();
    } catch {
      setError("Read state could not be saved. Retry.");
    }
  };
  return (
    <>
      <p className="p-4 text-sm">
        In-app review notifications · Email preferences in Preferences
      </p>
      <Button size="sm" variant="ghost" onClick={load}>
        Refresh notifications
      </Button>
      {error && (
        <p role="alert" className="p-4">
          {error}
        </p>
      )}
      {!items.length && !error && (
        <p className="p-4 muted">No review activity yet.</p>
      )}
      {items.map(item => (
        <article className="notification-item" key={item.id}>
          <strong>
            {!item.read && "Unread · "}
            {item.trackingNumber}
          </strong>
          <p>
            {item.action} · {formatTime(item.occurredAt)}
          </p>
          <Link href={`/supply-chain/shipments/${item.shipmentId}`}>
            Open shipment ↗
          </Link>
          <Button
            variant="ghost"
            size="sm"
            disabled={item.read}
            onClick={() => mark(item.id)}
          >
            Mark read
          </Button>
        </article>
      ))}
    </>
  );
}
export function IntegrationRegistry() {
  const [items, setItems] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const c = new AbortController(),
      t = setTimeout(() => c.abort(), 10000);
    readSource("/api/operations/integrations", c.signal)
      .then(r => setItems(r.items))
      .catch(e => setError(e.message))
      .finally(() => {
        clearTimeout(t);
        setLoaded(true);
      });
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, []);
  return (
    <Panel title="Logistics sources">
      <p className="muted text-sm">
        Receipts confirm past intake. Current carrier connectivity is not
        probed.
      </p>
      {error && <p role="alert">{error}</p>}
      {!loaded ? (
        <p role="status">Loading sources…</p>
      ) : !items.length && !error ? (
        <p>
          No sources provisioned. Ask your administrator to configure signed
          event intake.
        </p>
      ) : (
        items.map(item => (
          <article key={item.provider} className="attention-row">
            <div>
              <h3>{item.provider}</h3>
              <p>
                Intake {item.enabled ? "enabled" : "disabled"} · Signature{" "}
                {item.signatureConfigured ? "configured" : "missing"}
              </p>
              <p className="text-xs muted">
                Last receipt: {formatTime(item.lastReceivedAt)} · Provider
                observation: {formatTime(item.lastObservedAt)}
              </p>
            </div>
            <StatusBadge value="Unknown" />
          </article>
        ))
      )}
    </Panel>
  );
}
