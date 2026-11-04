import { ConnectionFlow } from "./WorkspaceVisuals";
import { Button } from "./ui/button";
import { useEffect, useRef, useState } from "react";
import { useData, readSource } from "@/contexts/DataContext";
import { Panel, StatusBadge } from "./Workspace";
import { IntegrationCard } from "./Board";
import { formatTime } from "@/lib/workspace";
export function IntegrationOverview() {
  const metadataRequest = useRef<AbortController | null>(null);
  const [version, setVersion] = useState(0);
  const [mailState, setMailState] = useState("Not configured"),
    [forecastState, setForecastState] = useState("Not configured"),
    [sapState, setSapState] = useState("Not configured"),
    [transportState, setTransportState] = useState("Not configured"),
    [outbox, setOutbox] = useState<{ state: string; count: number }[]>([]),
    [metadata, setMetadata] = useState(""),
    [checkingMetadata, setCheckingMetadata] = useState(false);
  const { mode, shipments } = useData(),
    [registry, setRegistry] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(mode === "live");
  useEffect(() => {
    metadataRequest.current?.abort();
    metadataRequest.current = null;
    setCheckingMetadata(false);
    if (mode === "demo") return;
    let disposed = false;
    setLoading(true);
    setForecastState("Checking");
    setSapState("Checking");
    setTransportState("Checking");
    setMailState("Checking");
    setRegistry([]);
    setOutbox([]);
    setMetadata("");
    const c = new AbortController(),
      timer = setTimeout(() => c.abort(), 10000);
    const label = (value: unknown) =>
      value === "configured"
        ? "Configured"
        : value === "not-configured"
          ? "Not configured"
          : value === "not-authorized"
            ? "Not authorized"
            : "Unavailable";
    const registryRead = readSource("/api/operations/integrations", c.signal)
      .then(r => {
        if (disposed) return;
        setRegistry(r.items);
        setMailState(
          r.externalNotifications === true ? "Configured" : "Not configured"
        );
        setForecastState(label(r.adapters?.forecast?.state));
        setSapState(label(r.adapters?.sap?.state));
      })
      .catch(e => {
        if (!disposed) {
          setForecastState("Unavailable");
          setSapState("Unavailable");
          setMailState("Unavailable");
          setError(
            c.signal.aborted
              ? "Source configuration read timed out. Retry the source read."
              : e.message
          );
        }
      });
    const transportRead = readSource(
      "/supply-chain/api/v1/orders/transport",
      c.signal
    )
      .then(r => {
        if (!disposed) {
          setTransportState(label(r.state));
          setOutbox(Array.isArray(r.outbox) ? r.outbox : []);
        }
      })
      .catch(() => {
        if (!disposed) setTransportState("Unavailable");
      });
    void Promise.all([registryRead, transportRead]).finally(() => {
      clearTimeout(timer);
      if (!disposed) setLoading(false);
    });
    return () => {
      disposed = true;
      clearTimeout(timer);
      c.abort();
      metadataRequest.current?.abort();
      metadataRequest.current = null;
    };
  }, [mode, version]);
  const recent =
    shipments.status === "ready"
      ? shipments.items
          .filter(s => s.receivedAt)
          .sort((a, b) => b.receivedAt!.localeCompare(a.receivedAt!))
          .slice(0, 5)
      : [];
  return (
    <>
      <ConnectionFlow
        sources={
          mode === "demo"
            ? [
                {
                  provider: "Demo carrier feed",
                  enabled: true,
                  signatureConfigured: true,
                  lastReceivedAt: recent[0]?.receivedAt ?? undefined,
                },
              ]
            : registry
        }
        mode={mode}
        loading={loading}
        error={error}
      />
      {mode === "live" && (
        <div className="actions">
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              setError("");
              setVersion(v => v + 1);
            }}
          >
            Refresh sources
          </Button>
        </div>
      )}
      {loading && <p role="status">Loading source configuration…</p>}
      {error && (
        <p role="alert" className="source-note">
          {error}
        </p>
      )}
      <div className="integration-grid">
        {mode === "demo" ? (
          <IntegrationCard
            kind="carrier"
            title="Carrier webhooks"
            state="Demo feed"
            description={`Last demonstration receipt: ${formatTime(recent[0]?.receivedAt ?? null)}`}
          >
            <details>
              <summary>View requirements</summary>
              <p>
                Live intake requires a signed event contract, provisioned
                workspace and server-managed connector key. Demo observations do
                not establish a carrier connection.
              </p>
            </details>
          </IntegrationCard>
        ) : registry.length ? (
          registry.map(item => (
            <IntegrationCard
              key={item.provider}
              kind="carrier"
              title={item.provider}
              state={
                item.enabled && item.signatureConfigured
                  ? "Configured"
                  : "Not configured"
              }
              description={`Last receipt: ${formatTime(item.lastReceivedAt)}`}
            >
              <p className="muted text-xs">
                Signature {item.signatureConfigured ? "configured" : "missing"}{" "}
                · Intake {item.enabled ? "enabled" : "disabled"} · Connectivity
                unverified
              </p>
              <details>
                <summary>Source details</summary>
                <p>
                  Provider observation: {formatTime(item.lastObservedAt)}. A
                  stored receipt is evidence of past intake, not a current
                  connectivity or sync probe.
                </p>
              </details>
            </IntegrationCard>
          ))
        ) : (
          !loading &&
          !error && (
            <IntegrationCard
              kind="carrier"
              title="Carrier webhooks"
              state="Not configured"
              description="No sources provisioned in this workspace."
            >
              <details>
                <summary>View requirements</summary>
                <p>
                  Ask your administrator to provision a provider alias,
                  workspace binding and signing secret using the documented
                  logistics contract.
                </p>
              </details>
            </IntegrationCard>
          )
        )}
        <IntegrationCard
          kind="source"
          title="SAP"
          state={mode === "live" ? sapState : "Not configured"}
          description="Read-only OData metadata adapter · business synchronization not activated"
        >
          <details>
            <summary>View requirements</summary>
            <p>
              An administrator must explicitly enable the adapter, supply an
              approved service URL, a server-side credential reference and
              authorized workspace IDs. A metadata receipt verifies only the
              service schema. Business record mappings and synchronization
              require separate approval.
            </p>
          </details>
          {mode === "live" && sapState === "Configured" && (
            <Button
              size="sm"
              variant="outline"
              disabled={checkingMetadata}
              onClick={async () => {
                const request = new AbortController();
                metadataRequest.current?.abort();
                metadataRequest.current = request;
                const timer = setTimeout(() => request.abort(), 15000);
                setCheckingMetadata(true);
                setMetadata("");
                try {
                  const receipt = await readSource(
                    "/api/operations/integrations/sap/metadata",
                    request.signal
                  );
                  if (
                    metadataRequest.current === request &&
                    !request.signal.aborted
                  )
                    setMetadata(
                      `Metadata observed ${formatTime(receipt.checkedAt)} · ${receipt.bytes} bytes · SHA-256 ${receipt.sha256}. No business records imported.`
                    );
                } catch {
                  if (metadataRequest.current === request)
                    setMetadata(
                      "Metadata unavailable. Configuration does not establish a verified connection."
                    );
                } finally {
                  clearTimeout(timer);
                  if (metadataRequest.current === request) {
                    setCheckingMetadata(false);
                    metadataRequest.current = null;
                  }
                }
              }}
            >
              {checkingMetadata ? "Checking metadata…" : "Check SAP metadata"}
            </Button>
          )}
          {metadata && (
            <p role="status" className="muted text-xs">
              {metadata}
            </p>
          )}
        </IntegrationCard>
        <IntegrationCard
          kind="mail"
          title="Email notifications"
          state={mode === "live" ? mailState : "Not configured"}
          description="Opt in through Preferences when delivery is enabled"
        >
          <details>
            <summary>View requirements</summary>
            <p>
              Operational review emails use a durable queue, bounded retries and
              per-workspace opt-in. The administrator must enable operational
              email delivery and configure a mail provider. Password-recovery
              email is separate.
            </p>
          </details>
        </IntegrationCard>
        <IntegrationCard
          kind="forecast"
          title="Forecast provider"
          state={mode === "live" ? forecastState : "Not configured"}
          description="Optional forecast capability"
        >
          <details>
            <summary>View requirements</summary>
            <p>
              The administrator must explicitly enable the validated server
              adapter with an approved provider URL/name and source
              observations. Responses must match products, dates, units and
              snapshot. Configure credentials on the server, then supply
              observations and request a forecast in Recommendations.
            </p>
          </details>
        </IntegrationCard>
        <IntegrationCard
          kind="source"
          title="Order dispatch"
          state={mode === "live" ? transportState : "Not configured"}
          description="Durable purchase outbox · transport acceptance does not confirm fulfillment"
        >
          <details>
            <summary>View requirements</summary>
            <p>
              Dispatch is disabled by default. Activation requires an approved
              Azure Service Bus queue and server-side credential reference.
              Saved orders and their outbox states are preserved during outages
              and retries.
            </p>
          </details>
          {mode === "live" && outbox.length > 0 && (
            <ul aria-label="Actual purchase outbox states">
              {outbox.map(row => (
                <li key={row.state}>
                  {row.state}: {row.count}
                </li>
              ))}
            </ul>
          )}
        </IntegrationCard>
      </div>
      <Panel
        title="Latest received observations"
        description="Most recent stored observation for each shipment in the selected scope"
      >
        {recent.length ? (
          <div className="compact-table-wrap">
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>Tracking ID</th>
                  <th>Recorded status</th>
                  <th>Received</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(s => (
                  <tr key={s.id}>
                    <td>{s.trackingNumber}</td>
                    <td>
                      <StatusBadge value={s.status} />
                    </td>
                    <td>{formatTime(s.receivedAt)}</td>
                    <td>{s.provider ?? "Not supplied"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            No receipt evidence is available in this selection.
          </p>
        )}
      </Panel>
    </>
  );
}
