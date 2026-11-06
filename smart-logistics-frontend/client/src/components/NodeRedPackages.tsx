import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { requestJSON } from "@/lib/requests";
import {
  nodeRedError,
  nodeRedOperation,
  nodeRedReview,
  nodeRedStatus,
  nodeRedTargets,
  pendingNodeRedInstall,
  type NodeRedStatus,
  type NodeRedTarget,
} from "@/lib/node-red";
import { Panel } from "./Workspace";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const capability = "node-red-package-management-v1";
const base = "/api/edge/node-red";
export function NodeRedPackages() {
  const { user } = useAuth(),
    { mode } = useData();
  const [enrollment, setEnrollment] = useState<{
    owner: typeof user;
    data: z.infer<typeof nodeRedTargets> | null;
    error: string;
  } | null>(null);
  const [selected, setSelected] = useState("");
  useEffect(() => {
    setEnrollment(null);
    setSelected("");
    if (mode !== "live" || user?.role !== "admin") return;
    const controller = new AbortController();
    void (async () => {
      // An older rollback backend receives no calls to the optional management API.
      const version = await requestJSON(
        "/version",
        "GET",
        undefined,
        undefined,
        controller.signal
      ).catch(() => null);
      if (
        controller.signal.aborted ||
        !Array.isArray(version?.capabilities) ||
        !version.capabilities.includes(capability)
      )
        return;
      try {
        const data = nodeRedTargets.parse(
          await requestJSON(
            base,
            "GET",
            undefined,
            undefined,
            controller.signal
          )
        );
        if (controller.signal.aborted) return;
        setEnrollment({ owner: user, data, error: "" });
        setSelected(data.targets[0]?.gatewayId ?? "");
      } catch (error) {
        if (!controller.signal.aborted)
          setEnrollment({
            owner: user,
            data: null,
            error: nodeRedError(error),
          });
      }
    })();
    return () => controller.abort();
  }, [user, mode]);
  if (
    mode !== "live" ||
    user?.role !== "admin" ||
    !enrollment ||
    enrollment.owner !== user
  )
    return null;
  const target = enrollment.data?.targets.find(
    item => item.gatewayId === selected
  );
  return (
    <Panel
      title="Node-RED packages"
      description="Manage libraries on an enrolled Logistics gateway in your current workspace."
    >
      {enrollment.error ? (
        <p role="alert">
          {enrollment.error} Reload the page to check enrollment again.
        </p>
      ) : null}
      {enrollment.data ? (
        <p className="muted text-sm">{enrollment.data.message}</p>
      ) : null}
      {enrollment.data && enrollment.data.targets.length > 0 ? (
        <div className="mt-4 space-y-4">
          <label className="block space-y-1">
            <span>Gateway</span>
            <select
              className="w-full rounded border bg-background p-2"
              aria-label="Node-RED gateway"
              value={selected}
              onChange={event => setSelected(event.target.value)}
            >
              {enrollment.data.targets.map(item => (
                <option key={item.gatewayId} value={item.gatewayId}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {target ? (
            <GatewayPackages
              key={target.id + ":" + target.revision}
              target={target}
            />
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

function GatewayPackages({ target }: { target: NodeRedTarget }) {
  const path = base + "/" + encodeURIComponent(target.gatewayId);
  const [status, setStatus] = useState<NodeRedStatus | null>(null),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(false),
    [needsCheck, setNeedsCheck] = useState(false);
  const [module, setModule] = useState(""),
    [version, setVersion] = useState(""),
    [filter, setFilter] = useState("");
  const [review, setReview] = useState<z.infer<typeof nodeRedReview> | null>(
      null
    ),
    [acknowledged, setAcknowledged] = useState(false);
  const [reviewExpired, setReviewExpired] = useState(false);
  const lifecycle = useRef<AbortController | null>(null),
    statusRequest = useRef<AbortController | null>(null),
    mutation = useRef(false);
  const confirmTarget = useCallback(
    (received: NodeRedTarget | null) => {
      if (
        !received ||
        received.id !== target.id ||
        received.gatewayId !== target.gatewayId ||
        received.revision !== target.revision
      )
        throw new Error(
          "The gateway enrollment changed. Reload the page before reviewing a package."
        );
    },
    [target.id, target.gatewayId, target.revision]
  );
  const refresh = useCallback(async () => {
    const owner = lifecycle.current;
    if (
      !owner ||
      owner.signal.aborted ||
      (statusRequest.current && !statusRequest.current.signal.aborted)
    )
      return;
    const controller = new AbortController();
    statusRequest.current = controller;
    setChecking(true);
    try {
      const data = nodeRedStatus.parse(
        await requestJSON(
          path + "/status",
          "GET",
          undefined,
          undefined,
          controller.signal
        )
      );
      if (controller.signal.aborted || owner.signal.aborted) return;
      confirmTarget(data.target);
      if (
        data.operation &&
        (data.operation.runtimeId !== target.id ||
          data.operation.gatewayId !== target.gatewayId)
      )
        throw new Error("The saved operation does not match this gateway.");
      setStatus(data);
      setNeedsCheck(data.state !== "ready");
    } catch (failure) {
      if (!controller.signal.aborted && !owner.signal.aborted) {
        setError(nodeRedError(failure));
        setNeedsCheck(true);
      }
    } finally {
      if (statusRequest.current === controller) {
        statusRequest.current = null;
        if (!controller.signal.aborted && !owner.signal.aborted)
          setChecking(false);
      }
    }
  }, [path, target.id, target.gatewayId, confirmTarget]);
  useEffect(() => {
    lifecycle.current = new AbortController();
    void refresh();
    return () => {
      lifecycle.current?.abort();
      statusRequest.current?.abort();
    };
  }, [refresh]);
  useEffect(() => {
    if (status?.operation?.state !== "installing") return;
    const timer = window.setInterval(() => {
      if (!mutation.current) void refresh();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [status?.operation?.state, refresh]);
  useEffect(() => {
    setReviewExpired(false);
    if (!review) return;
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      const remaining = Date.parse(review.expiresAt) - Date.now();
      if (remaining <= 0) {
        setReviewExpired(true);
        setAcknowledged(false);
      } else timer = setTimeout(expire, Math.min(remaining, 2_147_483_647));
    };
    expire();
    return () => clearTimeout(timer);
  }, [review]);
  const pending = pendingNodeRedInstall(status?.operation ?? null);
  const canReview =
    status?.state === "ready" && !pending && !needsCheck && !busy && !checking;
  const active = () => lifecycle.current && !lifecycle.current.signal.aborted;
  async function act(run: (signal: AbortSignal) => Promise<void>) {
    // The ref closes the same-render double-click window before React disables controls.
    if (mutation.current || !active()) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    statusRequest.current?.abort();
    setChecking(false);
    try {
      await run(lifecycle.current!.signal);
    } catch (failure) {
      if (active()) setError(nodeRedError(failure));
    } finally {
      mutation.current = false;
      if (active()) setBusy(false);
    }
  }
  const rows =
    status?.packages.filter(item =>
      item.name.toLowerCase().includes(filter.toLowerCase())
    ) ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {target.label} · Enrolled Node-RED {target.version}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={busy || checking}
          onClick={() => {
            setError("");
            void refresh();
          }}
        >
          {checking ? "Checking gateway…" : "Refresh gateway"}
        </Button>
      </div>
      <p className="muted text-sm" role="status">
        {status?.message ??
          "Reading the gateway and saved installation status…"}
      </p>
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}
      {needsCheck ? (
        <p className="text-sm">
          Refresh the saved status before requesting another installation. A
          missing response does not confirm that an installation failed.
        </p>
      ) : null}
      {status?.operation ? (
        <section
          aria-label="Saved Node-RED operation"
          className="rounded border p-3 space-y-2"
        >
          <h3 className="font-medium">
            {status.operation.module} · {status.operation.version}
          </h3>
          <p>
            Installation state: <strong>{status.operation.state}</strong>
          </p>
          <p className="text-sm">{status.operation.message}</p>
          <p className="muted text-xs break-all">
            Request {status.operation.id} · Updated{" "}
            {new Date(status.operation.updatedAt).toLocaleString()}
          </p>
          {pending ? (
            <>
              <p className="text-sm">
                New installations remain blocked while this outcome is pending
                or unconfirmed. Checking the saved outcome only reads the
                runtime inventory.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={busy || checking}
                onClick={() =>
                  void act(async signal => {
                    const saved = nodeRedOperation
                      .nullable()
                      .parse(
                        await requestJSON(
                          path + "/reconcile",
                          "POST",
                          {},
                          undefined,
                          signal
                        )
                      );
                    if (!active()) return;
                    if (
                      saved &&
                      (saved.runtimeId !== target.id ||
                        saved.gatewayId !== target.gatewayId)
                    )
                      throw new Error(
                        "The saved operation does not match this gateway."
                      );
                    setStatus(previous =>
                      previous ? { ...previous, operation: saved } : previous
                    );
                    await refresh();
                  })
                }
              >
                Check saved outcome
              </Button>
            </>
          ) : null}
        </section>
      ) : null}
      {status?.state === "ready" ? (
        <section aria-label="Installed Node-RED packages" className="space-y-2">
          <h3 className="font-medium">
            Installed packages ({status.packages.length})
          </h3>
          {status.packages.length ? (
            <>
              <label className="block text-sm">
                Filter installed packages
                <Input
                  value={filter}
                  onChange={event => setFilter(event.target.value)}
                  maxLength={214}
                />
              </label>
              <ul className="divide-y" aria-label="Installed package inventory">
                {rows.slice(0, 100).map(item => (
                  <li key={item.name} className="py-2 text-sm break-words">
                    <span className="font-medium">{item.name}</span> ·{" "}
                    {item.version}
                    <span className="muted">
                      {" "}
                      · {item.nodeSets} node sets, {item.pluginSets} plugin sets
                    </span>
                    {item.loadError ? (
                      <p>Runtime reports a load error; review the gateway.</p>
                    ) : null}
                    {item.pendingVersion ? (
                      <p>Pending version: {item.pendingVersion}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {rows.length > 100 ? (
                <p className="muted text-xs">
                  Showing the first 100 of {rows.length} matches. Narrow the
                  filter to find a package.
                </p>
              ) : null}
            </>
          ) : (
            <p className="muted text-sm">
              No node or plugin packages were reported.
            </p>
          )}
        </section>
      ) : null}
      <form
        className="space-y-3"
        aria-label="Review Node-RED package"
        onSubmit={event => {
          event.preventDefault();
          if (!canReview) return;
          void act(async signal => {
            setReview(null);
            setAcknowledged(false);
            const data = nodeRedReview.parse(
              await requestJSON(
                path + "/review",
                "POST",
                { module: module.trim(), version: version.trim() },
                undefined,
                signal
              )
            );
            if (!active()) return;
            confirmTarget(data.target);
            setReview(data);
          });
        }}
      >
        <h3 className="font-medium">Add a node library or plugin</h3>
        <p className="muted text-sm">
          Enter an npm package and its exact version. Updates, removal, flow
          changes and general Function-node dependencies require a separate
          gateway maintenance review.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Package name
            <Input
              value={module}
              required
              maxLength={214}
              disabled={busy || pending}
              placeholder="node-red-contrib-example"
              onChange={event => {
                setModule(event.target.value);
                setReview(null);
                setAcknowledged(false);
              }}
            />
          </label>
          <label className="block text-sm">
            Exact version
            <Input
              value={version}
              required
              maxLength={96}
              disabled={busy || pending}
              placeholder="1.2.3"
              onChange={event => {
                setVersion(event.target.value);
                setReview(null);
                setAcknowledged(false);
              }}
            />
          </label>
        </div>
        <Button
          type="submit"
          variant="outline"
          disabled={!canReview || !module.trim() || !version.trim()}
        >
          Review exact version
        </Button>
      </form>
      {review ? (
        <section
          aria-label="Reviewed Node-RED package"
          className="rounded border p-3 space-y-3"
        >
          <h3 className="font-medium">
            {review.module} · {review.version}
          </h3>
          {review.description ? (
            <p className="text-sm">{review.description}</p>
          ) : null}
          <p className="text-sm">
            Gateway: {review.target.label}. Review expires{" "}
            {new Date(review.expiresAt).toLocaleTimeString()}.
          </p>
          {reviewExpired ? (
            <p role="status" className="text-sm">
              This package review expired. Review the exact version again before
              installing.
            </p>
          ) : null}
          <p className="text-sm">
            Declared node sets: {review.nodeSets.join(", ") || "None"}. Plugin
            sets: {review.pluginSets.join(", ") || "None"}.
          </p>
          <p className="text-sm">
            Installing a package runs third-party code with the gateway
            runtime’s access. That code can affect existing flows and connected
            equipment. Registry metadata does not establish trust or
            commissioning.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={acknowledged}
              disabled={busy || pending}
              onChange={event => setAcknowledged(event.target.checked)}
            />
            <span>
              I reviewed this package and exact version, and approve running its
              code on this gateway.
            </span>
          </label>
          <Button
            type="button"
            disabled={
              !canReview ||
              !acknowledged ||
              reviewExpired ||
              Date.parse(review.expiresAt) <= Date.now()
            }
            onClick={() => {
              if (!canReview || !acknowledged) return;
              // Background-tab timers may be throttled; check at the action too.
              if (Date.parse(review.expiresAt) <= Date.now()) {
                setReviewExpired(true);
                setAcknowledged(false);
                setError(
                  "The package review expired. Review the exact version again before installing."
                );
                return;
              }
              const approved = review;
              void act(async signal => {
                setReview(null);
                setAcknowledged(false);
                setNeedsCheck(true);
                const saved = nodeRedOperation.parse(
                  await requestJSON(
                    path + "/install",
                    "POST",
                    {
                      reviewToken: approved.reviewToken,
                      requestId: crypto.randomUUID(),
                      acknowledgeCodeExecution: true,
                    },
                    undefined,
                    signal
                  )
                );
                if (!active()) return;
                if (
                  saved.runtimeId !== target.id ||
                  saved.gatewayId !== target.gatewayId
                )
                  throw new Error(
                    "The saved operation does not match this gateway."
                  );
                setStatus(previous =>
                  previous ? { ...previous, operation: saved } : previous
                );
                await refresh();
              });
            }}
          >
            Install reviewed package
          </Button>
        </section>
      ) : null}
    </div>
  );
}
