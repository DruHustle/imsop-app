import { HealthTopology } from "@/components/WorkspaceVisuals";
import { IntegrationOverview } from "@/components/IntegrationOverview";
import { Notice, EvidenceTimeline } from "@/components/Board";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useData } from "@/contexts/DataContext";
import { API_ORIGIN } from "@/lib/api-origin";
import {
  Metric,
  PageHeader,
  Panel,
  SourceNote,
  StatusBadge,
  EmptyState,
} from "@/components/Workspace";
import { Button } from "@/components/ui/button";
import { aggregateHealth, Health } from "@/lib/health";
import { DEMO_AS_OF, formatTime } from "@/lib/workspace";
interface Probe {
  name: string;
  status: Health;
  evidence: string;
  checkedAt: string | null;
}
export default function Infrastructure() {
  const { mode } = useData();
  return <HealthWorkspace key={mode} />;
}
function HealthWorkspace() {
  const { mode } = useData();
  const [path] = useLocation();
  const integrations = path.endsWith("/integrations");
  const [history, setHistory] = useState<
    { id: string; title: string; date: string; detail: string }[]
  >([]);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const c = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => c.abort(), 7000);
    setProbes([]);
    if (integrations) {
      clearTimeout(timeout);
      return () => c.abort();
    }
    if (mode === "demo") {
      setProbes([
        {
          name: "Demo API process",
          status: "Healthy",
          evidence: "Deterministic liveness example; no network probe",
          checkedAt: DEMO_AS_OF,
        },
        {
          name: "Demo dependency readiness",
          status: "Degraded",
          evidence:
            "Example: one dependency unavailable; not a production diagnosis",
          checkedAt: DEMO_AS_OF,
        },
      ]);
      setHistory([
        {
          id: "demo-check",
          title: "Demonstration check",
          date: DEMO_AS_OF,
          detail:
            "Fixed examples: liveness healthy; dependency readiness degraded",
        },
      ]);
      setLoading(false);
      clearTimeout(timeout);
      return () => c.abort();
    }
    setLoading(true);
    const read = async (endpoint: string, name: string): Promise<Probe> => {
      try {
        const r = await fetch(`${API_ORIGIN}${endpoint}`, {
          signal: c.signal,
          credentials: "include",
        });
        const body = await r.json();
        const valid = body.status === (endpoint === "/health" ? "ok" : "ready");
        return {
          name,
          status: !r.ok ? "Unavailable" : valid ? "Healthy" : "Unknown",
          evidence: `GET ${endpoint} · HTTP ${r.status} · ${endpoint === "/health" ? "Process liveness only" : "Readiness of configured API dependencies; not provider connectivity"}`,
          checkedAt: new Date().toISOString(),
        };
      } catch {
        return {
          name,
          status: "Unavailable",
          evidence: `GET ${endpoint} did not yield readable probe evidence`,
          checkedAt: new Date().toISOString(),
        };
      }
    };
    void Promise.all([
      read("/health", "API process liveness"),
      read("/ready", "API dependency readiness"),
    ])
      .then(values => {
        if (!disposed) {
          setProbes(values);
          setLoading(false);
          setClock(Date.now());
          setHistory(prior =>
            [
              {
                id: crypto.randomUUID(),
                title: "Checks complete",
                date: new Date().toISOString(),
                detail: values.map(v => `${v.name}: ${v.status}`).join(" · "),
              },
              ...prior,
            ].slice(0, 5)
          );
        }
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      clearTimeout(timeout);
      c.abort();
    };
  }, [mode, version, integrations]);
  const scoped = probes.map(p => ({
    ...p,
    status:
      mode === "live" && p.checkedAt && clock - Date.parse(p.checkedAt) > 60000
        ? ("Stale" as Health)
        : p.status,
  }));
  return (
    <>
      <PageHeader
        title={integrations ? "Integrations" : "Service health"}
        description={
          integrations
            ? "Understand what is connected and how to add a source"
            : "Check known services and the age of their evidence"
        }
        actions={
          !integrations && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => setVersion(v => v + 1)}
            >
              Refresh health checks
            </Button>
          )
        }
      />
      <SourceNote />
      {integrations ? (
        <IntegrationOverview />
      ) : (
        <>
          <div className="metric-grid metric-grid-three">
            <Metric
              kind="health"
              label="Readiness"
              value={loading ? "—" : aggregateHealth(scoped.map(p => p.status))}
              description="Observed API checks only"
            />
            <Metric
              kind="database"
              label="Checks observed"
              value={loading ? "—" : scoped.length}
              description="Liveness and dependency readiness"
            />
            <Metric
              kind="time"
              label="Last checked"
              value={
                scoped[0]?.checkedAt
                  ? new Date(scoped[0].checkedAt).toLocaleTimeString(
                      undefined,
                      { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }
                    ) + " UTC"
                  : "—"
              }
              description={
                mode === "demo"
                  ? "Demonstration evidence"
                  : "Manual check · stale after 60 seconds"
              }
            />
          </div>
          {!loading && scoped.length > 0 && (
            <Panel
              title="Service check topology"
              description={
                mode === "demo"
                  ? "Demonstration states; no network probe"
                  : "Observed API checks; select a node to inspect evidence"
              }
            >
              <HealthTopology nodes={scoped} />
            </Panel>
          )}
          <div className="health-layout">
            <Panel title="Service checks">
              {loading ? (
                <p role="status">
                  Checking process liveness and dependency readiness…
                </p>
              ) : (
                <div className="compact-table-wrap">
                  <table className="data-table compact-table">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Status</th>
                        <th>Checked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoped.map(p => (
                        <tr key={p.name}>
                          <td>{p.name}</td>
                          <td>
                            <StatusBadge value={p.status} />
                          </td>
                          <td>{formatTime(p.checkedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4">
                <Notice title="Provider health unknown">
                  Service checks do not confirm carrier connectivity.
                </Notice>
              </div>
              <details className="source-details">
                <summary>Check source details</summary>
                {scoped.map(p => (
                  <p key={p.name}>{p.evidence}</p>
                ))}
                <p>
                  Probe target: {API_ORIGIN || "same-origin API proxy"}. These
                  checks do not establish whole-platform or cloud-resource
                  health.
                </p>
              </details>
            </Panel>
            <Panel title="Recent checks">
              <EvidenceTimeline items={history} />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
