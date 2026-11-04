import { OrderStages } from "@/components/WorkspaceVisuals";
import { utcDay } from "@/lib/overview";
import { Purchasing } from "@/components/Purchasing";
import { RecordPreview } from "@/components/Board";
import { Link, useLocation } from "wouter";
import { useHashQuery } from "@/lib/hash-location";
import { useData } from "@/contexts/DataContext";
import {
  PageHeader,
  Panel,
  SourceNote,
  SourceState,
  EmptyState,
  StatusBadge,
} from "@/components/Workspace";
import { formatTime } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { ExportActions } from "@/components/ExportActions";
export default function Orders() {
  const { orders } = useData();
  const [path, navigate] = useLocation();
  const params = useHashQuery();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const page = Math.max(1, Math.floor(Number(params.get("page"))) || 1);
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== "page") next.delete("page");
    navigate(path + (next.size ? "?" + next : ""), { replace: key !== "page" });
  };
  const detail = (id: string) =>
    `/supply-chain/orders/${id}?return=${encodeURIComponent(path + (params.size ? "?" + params : ""))}`;
  const cohort = orders.items.filter(
    o =>
      (!params.get("from") || utcDay(o.createdAt) >= params.get("from")!) &&
      (!params.get("to") ||
        (!!utcDay(o.createdAt) && utcDay(o.createdAt) <= params.get("to")!))
  );
  const items = cohort.filter(
    o =>
      (!q ||
        [o.orderNumber, o.customerId ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      (!status || o.status === status)
  );
  const selected = items.find(item => item.id === params.get("selected"));
  const pages = Math.max(1, Math.ceil(items.length / 10));
  const current = Math.min(page, pages);
  const slice = items.slice((current - 1) * 10, current * 10);
  return (
    <>
      <PageHeader
        title="Orders"
        description="Review incoming orders and their progress"
      />
      <SourceNote
        count={orders.status === "ready" ? orders.items.length : undefined}
        total={orders.total}
      />
      {orders.status === "ready" && (
        <OrderStages
          items={cohort}
          selected={status}
          onSelect={value => set("status", value)}
        />
      )}
      <Panel>
        <div className="filter-toolbar">
          <label className="field">
            Search orders
            <input
              type="search"
              value={q}
              placeholder="Order number or customer ID…"
              onChange={e => {
                set("q", e.target.value);
              }}
            />
          </label>
          <label className="field">
            Order status
            <select
              aria-label="Order status"
              value={status}
              onChange={e => {
                set("status", e.target.value);
              }}
            >
              <option value="">All statuses</option>
              {Array.from(new Set(orders.items.map(o => o.status))).map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Created from
            <input
              type="date"
              value={params.get("from") ?? ""}
              onChange={e => set("from", e.target.value)}
            />
          </label>
          <label className="field">
            Created through
            <input
              type="date"
              value={params.get("to") ?? ""}
              onChange={e => set("to", e.target.value)}
            />
          </label>
          <Button
            variant="ghost"
            onClick={() => {
              navigate(path, { replace: true });
            }}
          >
            Reset filters
          </Button>
        </div>
        <div className="list-summary">
          <span>
            {orders.status === "ready"
              ? `${items.length} matching operational orders`
              : "Record count unavailable"}
          </span>
        </div>
        {orders.status !== "ready" || !orders.items.length ? (
          <SourceState source={orders} />
        ) : !items.length ? (
          <EmptyState
            title="No matching orders"
            description="Try another order number, customer ID or status."
          />
        ) : (
          <>
            <div className="desktop-records">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer ID</th>
                    <th>Source amount</th>
                    <th>Created</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map(o => (
                    <tr
                      key={o.id}
                      className={selected?.id === o.id ? "selected-row" : ""}
                    >
                      <td>
                        <Link className="record-link" href={detail(o.id)}>
                          {o.orderNumber}
                        </Link>
                        <button
                          className="record-preview-button"
                          data-preview-key={`order:${o.id}`}
                          aria-label={`Preview ${o.orderNumber}`}
                          onClick={() => set("selected", o.id)}
                        >
                          Preview →
                        </button>
                      </td>
                      <td>{o.customerId ?? "Not supplied"}</td>
                      <td>
                        {o.totalAmount ?? "Not supplied"}
                        <span className="freshness">
                          {o.currency ?? "Currency unknown"}
                        </span>
                      </td>
                      <td>{formatTime(o.createdAt)}</td>
                      <td>
                        <StatusBadge value={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-records">
              {slice.map(o => (
                <article className="shipment-card" key={o.id}>
                  <div className="card-top">
                    <Link className="record-link" href={detail(o.id)}>
                      {o.orderNumber}
                    </Link>
                    <StatusBadge value={o.status} />
                  </div>
                  <p className="muted text-xs mt-3">
                    Customer {o.customerId ?? "not supplied"} · Amount{" "}
                    {o.totalAmount ?? "not supplied"} (
                    {o.currency ?? "currency unknown"})
                  </p>
                  <button
                    className="record-preview-button"
                    data-preview-key={`order:${o.id}`}
                    aria-label={`Preview ${o.orderNumber}`}
                    onClick={() => set("selected", o.id)}
                  >
                    Preview →
                  </button>
                  <div className="card-bottom mt-3">
                    <span>{formatTime(o.createdAt)}</span>
                    <Link className="record-link" href={detail(o.id)}>
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
                disabled={current <= 1}
                onClick={() => set("page", String(current - 1))}
              >
                Previous
              </Button>
              <span>
                Page {current} of {pages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={current >= pages}
                onClick={() => set("page", String(current + 1))}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </Panel>
      {selected && (
        <RecordPreview
          order={selected}
          href={detail(selected.id)}
          onClose={() => set("selected", "")}
        />
      )}
      <div className="actions">
        <ExportActions
          name="operational-orders"
          items={orders.status === "ready" ? items : []}
          columns={[
            { key: "id", label: "Node record ID" },
            { key: "orderNumber", label: "Order number" },
            { key: "customerId", label: "Customer ID" },
            { key: "totalAmount", label: "Amount" },
            { key: "currency", label: "Currency (blank if unknown)" },
            { key: "status", label: "Status" },
            { key: "createdAt", label: "Created at" },
            { key: "source", label: "Source" },
          ]}
          scope={`${items.length} matching operational orders; search=${q}; status=${status || "all"}; from=${params.get("from") || "any"}; to=${params.get("to") || "any"}`}
        />
      </div>
      <Purchasing />
    </>
  );
}
