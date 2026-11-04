import { AnswerVisual } from "@/components/WorkspaceVisuals";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { readSource } from "@/contexts/DataContext";
import { formatTime, normalizeShipment, normalizeOrder } from "@/lib/workspace";
import { useData } from "@/contexts/DataContext";
import {
  PageHeader,
  Panel,
  SourceNote,
  StatusBadge,
} from "@/components/Workspace";
import { Button } from "@/components/ui/button";
import { answerQuestion, extractIdentifiers, Answer } from "@/lib/assistant";
import { useHashQuery } from "@/lib/hash-location";
export default function Assistant() {
  const { mode } = useData();
  return <Session key={mode} />;
}
function Session() {
  const { mode, shipments, orders, refresh } = useData();
  const params = useHashQuery();
  const incoming = params.get("q") ?? "";
  const [query, setQuery] = useState(incoming);
  const [messages, setMessages] = useState<
    { question: string; answer: Answer }[]
  >([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef("");
  useEffect(() => {
    setQuery(incoming);
  }, [incoming]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort("disposed"), []);
  const send = async (q = query) => {
    if (!q.trim() || sending) return;
    last.current = q;
    setSending(true);
    setNotice("");
    setQuery("");
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      await new Promise<void>((resolve, reject) => {
        timer.current = setTimeout(() => {
          timer.current = null;
          resolve();
        }, 180);
        controller.signal.addEventListener(
          "abort",
          () => {
            if (timer.current) clearTimeout(timer.current);
            reject(new Error("Cancelled"));
          },
          { once: true }
        );
      });
      let s = shipments,
        o = orders;
      if (mode === "live") {
        const tokens = extractIdentifiers(q, [
          ...shipments.items.map(s => s.trackingNumber),
          ...orders.items.map(o => o.orderNumber),
        ]);
        // An exact lookup is authoritative even when it returns no match.
        // Never retain a previously visible record after it leaves this scope.
        let shipmentItems = tokens.length ? [] : [...shipments.items],
          orderItems = tokens.length ? [] : [...orders.items];
        const item = params.get("item");
        if (item) {
          const match = /^(shipment|order):([1-9]\d*)$/.exec(item);
          if (!match)
            throw new Error(
              "The requested record context is invalid. Open its detail page again."
            );
          const row = await readSource(
            `/api/operations/${match[1] === "shipment" ? "shipments" : "orders"}/${match[2]}`,
            controller.signal
          );
          if (match[1] === "shipment") shipmentItems = [normalizeShipment(row)];
          else orderItems = [normalizeOrder(row)];
        }
        // Resolve exact identifiers through authorized APIs, including records outside list memory.
        const resolved = await Promise.all(
          tokens.map(async token => {
            const result = await readSource(
              `/api/operations/shipments?limit=100&identifier=${encodeURIComponent(token)}`,
              controller.signal
            );
            const orderResult =
              orders.status === "forbidden"
                ? { items: [] }
                : await readSource(
                    `/api/operations/orders?limit=100&identifier=${encodeURIComponent(token)}`,
                    controller.signal
                  );
            return {
              s: result.items.map(normalizeShipment),
              o: orderResult.items.map(normalizeOrder),
            };
          })
        );
        for (const row of resolved) {
          shipmentItems.push(...row.s);
          orderItems.push(...row.o);
        }
        s = {
          ...shipments,
          status: tokens.length || item ? "ready" : shipments.status,
          items: Array.from(
            new Map(shipmentItems.map(i => [i.id, i])).values()
          ),
        };
        o = {
          ...orders,
          status:
            (tokens.length || item) && orders.status !== "forbidden"
              ? "ready"
              : orders.status,
          items: Array.from(new Map(orderItems.map(i => [i.id, i])).values()),
        };
      }
      if (!controller.signal.aborted)
        setMessages(m => [
          ...m,
          { question: q, answer: answerQuestion(q, s, o, mode) },
        ]);
    } catch (e) {
      if (!controller.signal.aborted)
        setNotice(
          e instanceof Error ? e.message : "Record context could not be read."
        );
      else if (
        controller.signal.reason !== "user-cancel" &&
        controller.signal.reason !== "disposed"
      )
        setNotice("The context read timed out. Retry your question.");
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) setSending(false);
    }
  };
  const unavailable =
    shipments.status === "unavailable" || orders.status === "unavailable";
  return (
    <>
      <PageHeader
        title="Assistant"
        description="Ask about the records you can access"
      />
      <SourceNote />
      {params.get("item") && (
        <p className="muted text-xs">
          A record is selected. Review your question before sending; its current
          details will be checked with your answer.
        </p>
      )}
      {unavailable && (
        <div className="source-note" role="alert">
          A source is unavailable.{" "}
          <Button size="sm" variant="outline" onClick={refresh}>
            Retry source read
          </Button>
        </div>
      )}
      <Panel
        title="Data assistant"
        description="Use a known tracking/order number, ask for a shipment summary, or review exceptions."
      >
        <div
          className="chat-history"
          role="log"
          aria-live="polite"
          aria-label="Assistant conversation"
        >
          {!messages.length && (
            <div className="empty-state">
              <h2>Start with a record or a question</h2>
              <p className="muted">
                Responses cite the selected source, record and observation time
                when supplied. Queries stay in this session.
              </p>
              <div className="suggestion-list">
                {[
                  "Summarize shipments",
                  "Which shipments need attention?",
                  ...(shipments.items[0]
                    ? [`Look up ${shipments.items[0].trackingNumber}`]
                    : []),
                ].map(q => (
                  <Button
                    key={q}
                    variant="outline"
                    size="sm"
                    onClick={() => setQuery(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className="space-y-3">
              <div className="chat-message user">
                <p className="eyebrow">You</p>
                <p>{m.question}</p>
              </div>
              <div className="chat-message">
                <p className="eyebrow">
                  {mode === "demo" ? "Demo data assistant" : "Data assistant"}
                </p>
                {m.answer.records && m.answer.records.length > 0 && (
                  <AnswerVisual records={m.answer.records} />
                )}
                {m.answer.records && m.answer.records.length > 1 ? (
                  <>
                    <p>Comparison from the records you can access.</p>
                    <div className="compact-table-wrap assistant-comparison">
                      <table className="data-table compact-table">
                        <thead>
                          <tr>
                            <th>Record</th>
                            <th>Route / customer</th>
                            <th>Recorded status</th>
                            <th>Last observation</th>
                            <th>
                              <span className="sr-only">Open</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.answer.records.map(record => (
                            <tr key={record.key}>
                              <td>
                                {record.identifier}
                                <span className="freshness">{record.kind}</span>
                              </td>
                              <td>{record.route}</td>
                              <td>
                                <StatusBadge value={record.status} />
                              </td>
                              <td>{formatTime(record.observedAt)}</td>
                              <td>
                                <Link
                                  className="record-link"
                                  href={record.href}
                                >
                                  Open →
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {m.answer.unresolved?.map(message => (
                      <p key={message} className="muted text-sm">
                        {message}
                      </p>
                    ))}
                    <details className="source-details">
                      <summary>Record evidence and limitations</summary>
                      <p>{m.answer.text}</p>
                    </details>
                  </>
                ) : (
                  <p>{m.answer.text}</p>
                )}
                {m.answer.links.map(l => (
                  <Link key={l.href} href={l.href}>
                    {l.label} ↗
                  </Link>
                ))}
                <span className="freshness">{m.answer.source}</span>
              </div>
            </div>
          ))}
          {sending && (
            <p role="status" className="muted text-xs">
              Reading selected context…
            </p>
          )}
        </div>
        <form
          className="chat-form mt-6"
          onSubmit={e => {
            e.preventDefault();
            send();
          }}
        >
          <label className="field">
            Your question
            <textarea
              placeholder="Ask about shipments or operational orders…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send();
                }
              }}
              maxLength={2000}
            />
          </label>
          <Button
            type="submit"
            disabled={
              !query.trim() || sending || shipments.status === "loading"
            }
          >
            Send
          </Button>
          {sending && (
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                if (timer.current) clearTimeout(timer.current);
                timer.current = null;
                requestRef.current?.abort("user-cancel");
                setSending(false);
                setNotice("Question cancelled.");
                setQuery(last.current);
              }}
            >
              Cancel
            </Button>
          )}
        </form>
        {notice && (
          <p role="status" className="muted text-xs mt-3">
            {notice}
          </p>
        )}
      </Panel>
    </>
  );
}
