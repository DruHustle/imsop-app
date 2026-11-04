import { useEffect, useState } from "react";
import { z } from "zod";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { requestJSON } from "@/lib/requests";
import { Panel } from "./Workspace";
import { Notice } from "./Board";
import { Button } from "./ui/button";
const prediction = z.object({
  sku: z.string(),
  date: z.string(),
  quantity: z.number().finite(),
  unit: z.string(),
});
const schema = z.object({
  configured: z.boolean(),
  maxHorizonDays: z.number(),
  observations: z.number(),
  products: z.number(),
  runs: z.array(
    z.object({
      id: z.string(),
      provider: z.string(),
      createdAt: z.string(),
      response: z.object({
        modelVersion: z.string(),
        generatedAt: z.string(),
        sourceSnapshotAt: z.string(),
        predictions: z.array(prediction),
        limitations: z.array(z.string()),
      }),
    })
  ),
});
export function Forecasts() {
  const { mode } = useData(),
    { user } = useAuth();
  const [status, setStatus] = useState<z.infer<typeof schema> | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [horizon, setHorizon] = useState("7"),
    [observations, setObservations] = useState("");
  const [runId, setRunId] = useState(""),
    [predictionPage, setPredictionPage] = useState(0);
  const load = async (signal?: AbortSignal) =>
    setStatus(
      schema.parse(
        await requestJSON(
          "/api/operations/forecasts",
          "GET",
          undefined,
          undefined,
          signal
        )
      )
    );
  useEffect(() => {
    if (mode !== "live") return;
    const c = new AbortController();
    load(c.signal).catch(e => {
      if (!c.signal.aborted) setError(e.message);
    });
    return () => c.abort();
  }, [mode]);
  if (mode === "demo")
    return (
      <Notice title="Forecasts not configured">
        Review guidance uses recorded shipment events. Demo reviews do not
        request predictions or change bookings.
      </Notice>
    );
  const perform = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const latest = status?.runs.find(run => run.id === runId) ?? status?.runs[0];
  const page = Math.min(
    predictionPage,
    Math.max(0, Math.ceil((latest?.response.predictions.length ?? 0) / 100) - 1)
  );
  return (
    <Panel
      title="Forecast evidence"
      description="Optional predictions from a configured provider and supplied source observations"
    >
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!status?.configured && (
        <p className="muted">
          Forecasts not configured. An administrator must configure an
          authorized provider URL, name and any required credentials. Exception
          review remains available.
        </p>
      )}
      {status && (
        <p>
          {status.observations} source observations · {status.products} products
        </p>
      )}
      <div className="actions">
        <label className="field">
          Forecast horizon (days)
          <input
            type="number"
            min={1}
            max={status?.maxHorizonDays || 90}
            value={horizon}
            onChange={e => setHorizon(e.target.value)}
          />
        </label>
        <Button
          disabled={busy || !status?.configured || !status.observations}
          onClick={() =>
            perform(
              () =>
                requestJSON("/api/operations/forecasts", "POST", {
                  horizonDays: Number(horizon),
                }),
              "Forecast evidence saved. No operational action was executed."
            )
          }
        >
          Request forecast
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            perform(() => Promise.resolve(), "Forecast evidence refreshed.")
          }
        >
          Refresh forecast evidence
        </Button>
      </div>
      {["admin", "engineer"].includes(user?.role ?? "") && (
        <details className="source-details">
          <summary>Supply source observations</summary>
          <form
            onSubmit={e => {
              e.preventDefault();
              void perform(() => {
                const rows = JSON.parse(observations);
                return requestJSON(
                  "/api/operations/forecasts/observations",
                  "POST",
                  { observations: rows }
                );
              }, "Source observations saved. Matching product/date rows are explicit corrections.");
            }}
          >
            <label className="field">
              Observation JSON
              <textarea
                required
                rows={5}
                value={observations}
                onChange={e => setObservations(e.target.value)}
                aria-describedby="observation-guidance"
              />
            </label>
            <p id="observation-guidance" className="muted text-xs">
              Supply an array with sku, date (YYYY-MM-DD), quantity, unit and
              source for actual historical demand. Quantities must be
              nonnegative with up to four decimal places. Importing the same
              product/date explicitly corrects that observation. Shipment and
              purchase counts are not substituted for demand.
            </p>
            <Button disabled={busy}>Save source observations</Button>
          </form>
        </details>
      )}
      {latest && (
        <section className="mt-3">
          <label className="field mb-3">
            Forecast run
            <select
              value={latest.id}
              onChange={e => {
                setRunId(e.target.value);
                setPredictionPage(0);
              }}
            >
              {status?.runs.map(run => (
                <option key={run.id} value={run.id}>
                  {run.provider} · {run.createdAt}
                </option>
              ))}
            </select>
          </label>
          <p className="muted text-xs">
            {latest.provider} · {latest.response.modelVersion} · Generated{" "}
            {latest.response.generatedAt} · Source snapshot{" "}
            {latest.response.sourceSnapshotAt}
          </p>
          <div className="compact-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Date</th>
                  <th>Predicted quantity</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {latest.response.predictions
                  .slice(page * 100, (page + 1) * 100)
                  .map(row => (
                    <tr key={row.sku + row.date}>
                      <td>{row.sku}</td>
                      <td>{row.date}</td>
                      <td>{row.quantity}</td>
                      <td>{row.unit}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {latest.response.predictions.length > 100 && (
            <nav className="pagination" aria-label="Forecast prediction pages">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPredictionPage(page - 1)}
              >
                Previous predictions
              </Button>
              <span>
                Page {page + 1} of{" "}
                {Math.ceil(latest.response.predictions.length / 100)} ·{" "}
                {latest.response.predictions.length} predictions
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  (page + 1) * 100 >= latest.response.predictions.length
                }
                onClick={() => setPredictionPage(page + 1)}
              >
                Next predictions
              </Button>
            </nav>
          )}
          {latest.response.limitations.map((text, i) => (
            <p className="muted text-xs" key={i}>
              {text}
            </p>
          ))}
        </section>
      )}
    </Panel>
  );
}
