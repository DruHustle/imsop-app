import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Panel, StatusBadge } from "./Workspace";
import { Button } from "./ui/button";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { requestJSON } from "@/lib/requests";
import { readPurchaseCatalog } from "@/lib/purchasing";
const option = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.string().optional(),
});
const product = option.extend({ sku: z.string(), unitPrice: z.string() });
const purchase = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  supplierId: z.string().uuid(),
  totalAmount: z.string(),
  currency: z.string().nullable(),
  status: z.string(),
  dispatchState: z.string(),
});
const line = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int(),
  receivedQuantity: z.number().int(),
  unitPrice: z.string(),
});
type Purchase = z.infer<typeof purchase>;
type Line = z.infer<typeof line>;
const base = "/supply-chain/api/v1/orders";
export function Purchasing() {
  const { mode } = useData();
  const { user } = useAuth();
  const editable = ["admin", "engineer"].includes(user?.role ?? "");
  const [data, setData] = useState<{
    suppliers: z.infer<typeof option>[];
    products: z.infer<typeof product>[];
    warehouses: z.infer<typeof option>[];
    orders: Purchase[];
    total: number;
  }>({ suppliers: [], products: [], warehouses: [], orders: [], total: 0 });
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [supplier, setSupplier] = useState(""),
    [orderNumber, setNumber] = useState(""),
    [currency, setCurrency] = useState("");
  const [inputs, setInputs] = useState([
    { productId: "", quantity: "1", unitPrice: "" },
  ]);
  const [selected, setSelected] = useState<Purchase | null>(null),
    [items, setItems] = useState<Line[]>([]),
    [quantities, setQuantities] = useState<Record<string, string>>({});
  const [warehouse, setWarehouse] = useState(""),
    [receivedAt, setTime] = useState(""),
    [note, setNote] = useState("");
  const orderKey = useRef<string | null>(null),
    receiptKey = useRef<string | null>(null);
  const resetOrderKey = () => {
    orderKey.current = null;
  };
  const resetReceiptKey = () => {
    receiptKey.current = null;
  };
  const load = async (signal?: AbortSignal, pageOffset = offset) => {
    const [s, p, w, o] = await Promise.all([
      readPurchaseCatalog(base + "/suppliers", option, signal),
      readPurchaseCatalog(base + "/products", product, signal),
      readPurchaseCatalog(base + "/warehouses", option, signal),
      requestJSON(
        base + `?offset=${pageOffset}`,
        "GET",
        undefined,
        undefined,
        signal
      ),
    ]);
    const orders = z
      .object({
        items: z.array(purchase),
        total: z.number().int().nonnegative(),
      })
      .parse(o);
    if (signal?.aborted) return;
    setData({
      suppliers: z.array(option).parse(s),
      products: z.array(product).parse(p),
      warehouses: z.array(option).parse(w),
      orders: orders.items,
      total: orders.total,
    });
  };
  useEffect(() => {
    if (mode !== "live") return;
    const c = new AbortController();
    setBusy(true);
    load(c.signal)
      .catch(e => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [mode, offset]);
  if (mode !== "live")
    return (
      <details className="source-details">
        <summary>Purchasing</summary>
        <p>
          Purchase orders and inventory receipts use your live workspace. Demo
          mode does not submit orders or change stock.
        </p>
      </details>
    );
  const open = async (order: Purchase) => {
    setBusy(true);
    setError("");
    try {
      const result = z
        .array(line)
        .parse(await requestJSON(base + "/" + order.id + "/items"));
      setItems(result);
      setSelected(order);
      setQuantities({});
      resetReceiptKey();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    orderKey.current ??= crypto.randomUUID();
    try {
      await requestJSON(
        base,
        "POST",
        {
          supplierId: supplier,
          orderNumber,
          currency,
          items: inputs.map(i => ({
            productId: i.productId,
            quantity: Number(i.quantity),
            unitPrice: i.unitPrice,
          })),
        },
        orderKey.current
      );
      await load(undefined, 0);
      setOffset(0);
      resetOrderKey();
      setNumber("");
      setInputs([{ productId: "", quantity: "1", unitPrice: "" }]);
      setNotice(
        "Purchase order saved with durable dispatch state. Saving does not confirm supplier acceptance."
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const receive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    receiptKey.current ??= crypto.randomUUID();
    try {
      await requestJSON(
        base + "/" + selected.id + "/receipts",
        "POST",
        {
          warehouseId: warehouse,
          receivedAt: receivedAt + ":00Z",
          note,
          items: items
            .filter(i => Number(quantities[i.id]) > 0)
            .map(i => ({ itemId: i.id, quantity: Number(quantities[i.id]) })),
        },
        receiptKey.current
      );
      await load();
      setSelected(null);
      resetReceiptKey();
      setNote("");
      setNotice("Receipt recorded and inventory updated once.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="Purchase orders"
      description="Supplier orders and recorded warehouse receipts"
    >
      <p className="muted text-xs mb-3">
        Purchasing records are separate from the incoming operational orders
        above. Browse 50 records per page.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError("");
          load()
            .catch(e => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        Refresh purchasing
      </Button>
      {!data.orders.length && !busy && (
        <p className="muted">
          No purchase orders have been saved in this workspace.
        </p>
      )}
      <div className="record-grid mt-3">
        {data.orders.map(order => (
          <article className="shipment-card" key={order.id}>
            <strong>{order.orderNumber}</strong>
            <p>
              {order.totalAmount} {order.currency ?? "Currency unknown"}
            </p>
            <StatusBadge value={order.status} />
            <p className="muted text-xs">Dispatch: {order.dispatchState}</p>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => open(order)}
            >
              Review purchase {order.orderNumber}
            </Button>
          </article>
        ))}
      </div>
      {data.total > 0 && (
        <nav className="pagination" aria-label="Purchase order pages">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || offset === 0}
            onClick={() => {
              setSelected(null);
              setOffset(value => Math.max(0, value - 50));
            }}
          >
            Previous purchases
          </Button>
          <span>
            Page {Math.floor(offset / 50) + 1} of{" "}
            {Math.max(1, Math.ceil(data.total / 50))} · {data.total} purchases
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || offset + 50 >= data.total}
            onClick={() => {
              setSelected(null);
              setOffset(value => value + 50);
            }}
          >
            Next purchases
          </Button>
        </nav>
      )}
      {editable && (
        <details className="source-details">
          <summary>Create purchase order</summary>
          <form className="space-y-3" onSubmit={save} onChange={resetOrderKey}>
            <label className="field">
              Supplier
              <select
                required
                aria-label="Purchase supplier"
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
              >
                <option value="">Choose supplier</option>
                {data.suppliers
                  .filter(s => s.status === "active")
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              Order reference
              <input
                required
                maxLength={100}
                value={orderNumber}
                onChange={e => setNumber(e.target.value)}
              />
            </label>
            <label className="field">
              Source currency
              <input
                required
                pattern="[A-Z]{3}"
                maxLength={3}
                placeholder="Three-letter source currency"
                value={currency}
                onChange={e => setCurrency(e.target.value.toUpperCase())}
              />
            </label>
            {inputs.map((input, index) => (
              <fieldset key={index} className="shipment-card">
                <legend>Item {index + 1}</legend>
                <label className="field">
                  Product
                  <select
                    required
                    aria-label="Product"
                    value={input.productId}
                    onChange={e =>
                      setInputs(rows =>
                        rows.map((row, n) =>
                          n === index
                            ? {
                                ...row,
                                productId: e.target.value,
                                unitPrice:
                                  data.products.find(
                                    p => p.id === e.target.value
                                  )?.unitPrice ?? "",
                              }
                            : row
                        )
                      )
                    }
                  >
                    <option value="">Choose product</option>
                    {data.products.map(p => (
                      <option value={p.id} key={p.id}>
                        {p.sku} · {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Quantity
                  <input
                    type="number"
                    required
                    min={1}
                    max={1000000}
                    step={1}
                    value={input.quantity}
                    onChange={e =>
                      setInputs(rows =>
                        rows.map((row, n) =>
                          n === index
                            ? { ...row, quantity: e.target.value }
                            : row
                        )
                      )
                    }
                  />
                </label>
                <label className="field">
                  Unit price from source
                  <input
                    required
                    inputMode="decimal"
                    pattern="[0-9]+([.][0-9]{1,4})?"
                    value={input.unitPrice}
                    onChange={e =>
                      setInputs(rows =>
                        rows.map((row, n) =>
                          n === index
                            ? { ...row, unitPrice: e.target.value }
                            : row
                        )
                      )
                    }
                  />
                </label>
                {inputs.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      resetOrderKey();
                      setInputs(rows => rows.filter((_, n) => n !== index));
                    }}
                  >
                    Remove item {index + 1}
                  </Button>
                )}
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={inputs.length >= 100 || busy}
              onClick={() => {
                resetOrderKey();
                setInputs(rows => [
                  ...rows,
                  { productId: "", quantity: "1", unitPrice: "" },
                ]);
              }}
            >
              Add purchase item
            </Button>
            {(!data.suppliers.length || !data.products.length) && (
              <p>
                Ask your workspace administrator to provision actual suppliers
                and products before creating an order.
              </p>
            )}
            <Button
              type="submit"
              disabled={busy || !data.suppliers.length || !data.products.length}
            >
              Save purchase order
            </Button>
          </form>
        </details>
      )}
      {selected && (
        <section
          aria-label={"Purchase " + selected.orderNumber}
          className="shipment-card mt-3"
        >
          <h3>{selected.orderNumber}</h3>
          <p>
            Receipt quantities:{" "}
            {items
              .map(
                i =>
                  `${data.products.find(p => p.id === i.productId)?.name ?? i.productId}: ${i.receivedQuantity}/${i.quantity}`
              )
              .join("; ") || "No item evidence exists for this legacy order."}
          </p>
          <div
            className="receipt-progress"
            aria-label="Recorded receiving progress"
          >
            {items.map(i => (
              <div key={i.id}>
                <span>
                  {data.products.find(p => p.id === i.productId)?.name ??
                    i.productId}
                </span>
                <strong>
                  {i.receivedQuantity} / {i.quantity}
                </strong>
                <progress
                  aria-label={`Received ${i.receivedQuantity} of ${i.quantity}`}
                  value={i.receivedQuantity}
                  max={Math.max(1, i.quantity)}
                />
              </div>
            ))}
          </div>
          <p className="muted text-xs">
            Supplier →{" "}
            {data.suppliers.find(s => s.id === selected.supplierId)?.name ??
              selected.supplierId}{" "}
            → {selected.orderNumber} → {items.length} recorded line items
          </p>
          {editable && items.some(i => i.receivedQuantity < i.quantity) && (
            <form
              className="space-y-3"
              onSubmit={receive}
              onChange={resetReceiptKey}
            >
              <label className="field">
                Receiving warehouse
                <select
                  required
                  aria-label="Receiving warehouse"
                  value={warehouse}
                  onChange={e => setWarehouse(e.target.value)}
                >
                  <option value="">Choose warehouse</option>
                  {data.warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Received time (UTC)
                <input
                  required
                  type="datetime-local"
                  value={receivedAt}
                  onChange={e => setTime(e.target.value)}
                />
              </label>
              <label className="field">
                Receipt evidence
                <textarea
                  required
                  maxLength={2000}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </label>
              {items
                .filter(i => i.receivedQuantity < i.quantity)
                .map(i => (
                  <label className="field" key={i.id}>
                    Receive{" "}
                    {data.products.find(p => p.id === i.productId)?.name ??
                      i.productId}
                    <input
                      type="number"
                      min={0}
                      max={i.quantity - i.receivedQuantity}
                      step={1}
                      value={quantities[i.id] ?? "0"}
                      onChange={e =>
                        setQuantities(q => ({ ...q, [i.id]: e.target.value }))
                      }
                    />
                  </label>
                ))}
              <p>
                Record only physically received stock supported by the
                observation above. This updates warehouse inventory.
              </p>
              <Button
                disabled={
                  busy ||
                  !Object.values(quantities).some(q => Number(q) > 0) ||
                  !data.warehouses.length
                }
              >
                Record warehouse receipt
              </Button>
            </form>
          )}
          <Button variant="ghost" onClick={() => setSelected(null)}>
            Close purchase
          </Button>
        </section>
      )}
    </Panel>
  );
}
