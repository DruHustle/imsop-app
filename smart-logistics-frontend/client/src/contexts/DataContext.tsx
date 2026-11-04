import { overviewScope } from "@/lib/overview";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import { safeLocalStorage } from "@/lib/storage";
import { API_ORIGIN } from "@/lib/api-origin";
import {
  Mode,
  SourceStatus,
  Shipment,
  OperationalOrder,
  normalizeShipment,
  normalizeOrder,
  canOrder,
} from "@/lib/workspace";
import { demoShipments, demoOrders } from "@/lib/demo-data";
export interface Source<T> {
  status: SourceStatus;
  items: T[];
  total: number;
  readAt?: string;
  error?: string;
}
export class ReadError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
export async function readSource(path: string, signal: AbortSignal) {
  const res = await fetch(`${API_ORIGIN}${path}`, {
    credentials: "include",
    signal,
    headers: { Accept: "application/json" },
  });
  if (res.status === 401)
    window.dispatchEvent(new Event("imsop:session-expired"));
  if (!res.ok) {
    const failure = await res.json().catch(() => ({}));
    throw new ReadError(
      res.status,
      res.status === 401
        ? "Your session expired. Sign in again to continue."
        : res.status === 403
          ? failure.code === "WORKSPACE_REQUIRED"
            ? "Ask your workspace administrator to provision access."
            : "You do not have permission to read this source."
          : res.status === 404
            ? "Record not found."
            : "The source is unavailable. Retry the read."
    );
  }
  return res.json();
}
interface DataState {
  scope: string;
  lastShipmentReadAt: string | null;
  mode: Mode;
  setMode: (mode: Mode) => void;
  demoIdentity: boolean;
  shipments: Source<Shipment>;
  orders: Source<OperationalOrder>;
  refresh: () => void;
}
const DataContext = createContext<DataState | null>(null);
const loading = <T,>(): Source<T> => ({
  status: "loading",
  items: [],
  total: 0,
});
function ScopedDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const demoIdentity = !!safeLocalStorage
    .getItem("imsop_token")
    ?.startsWith("mock_");
  const key = `imsop:mode:${user!.id}:${user!.email}:${demoIdentity ? "demo-account" : "account"}`;
  const [mode, setSelectedMode] = useState<Mode>(() =>
    demoIdentity
      ? "demo"
      : safeLocalStorage.getItem(key) === "demo"
        ? "demo"
        : "live"
  );
  const [lastShipmentReadAt, setLastShipmentReadAt] = useState<string | null>(
    null
  );
  const [shipments, setShipments] = useState<Source<Shipment>>(loading);
  const [orders, setOrders] = useState<Source<OperationalOrder>>(loading);
  const onOverview = () =>
    ["#/", "#", ""].includes(window.location.hash.split("?")[0]);
  const selectedFilters = () => {
    const q = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const result = new URLSearchParams();
    if (
      onOverview() ||
      window.location.hash.startsWith("#/supply-chain/shipments?") ||
      window.location.hash.startsWith("#/supply-chain/orders?") ||
      window.location.hash.startsWith("#/insights/analytics?")
    )
      for (const name of ["q", "status", "carrier", "mode", "from", "to"]) {
        const value = q.get(name);
        if (value) result.set(name, value);
      }
    if (onOverview()) {
      const dates = overviewScope(q, mode);
      if (dates.from) result.set("from", dates.from);
      if (dates.to) result.set("to", dates.to);
    }
    const path = window.location.hash.split("?")[0];
    const context = onOverview()
      ? "overview"
      : path.startsWith("#/supply-chain/orders")
        ? "orders"
        : path.startsWith("#/supply-chain/shipments") ||
            path.startsWith("#/insights/analytics")
          ? "shipments"
          : "workspace";
    return context + ":" + result.toString();
  };
  const [selection, setSelection] = useState(selectedFilters);
  const selectionRef = useRef(selection);
  const activeRead = useRef<AbortController | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const change = () => {
      const next = selectedFilters();
      if (selectionRef.current === next) return;
      selectionRef.current = next;
      clearTimeout(timer);
      activeRead.current?.abort("filters-changed");
      setShipments(loading());
      setOrders(loading());
      setLastShipmentReadAt(null);
      timer = setTimeout(() => {
        setSelection(next);
        setVersion(v => v + 1);
      }, 250);
    };
    window.addEventListener("hashchange", change);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", change);
    };
  }, [mode]);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  const setMode = (next: Mode) => {
    if (demoIdentity && next === "live") return;
    setShipments(loading());
    setOrders(loading());
    setLastShipmentReadAt(null);
    setSelectedMode(next);
    safeLocalStorage.setItem(key, next);
  };
  useEffect(() => {
    const controller = new AbortController();
    activeRead.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    setShipments(loading());
    setOrders(loading());
    if (mode === "demo") {
      setShipments({
        status: "ready",
        items: demoShipments,
        total: demoShipments.length,
      });
      setOrders(
        canOrder(user)
          ? { status: "ready", items: demoOrders, total: demoOrders.length }
          : { status: "forbidden", items: [], total: 0 }
      );
      clearTimeout(timeout);
      return () => controller.abort();
    }
    const load = async <T,>(
      kind: string,
      normalize: (r: Record<string, unknown>) => T,
      set: (s: Source<T>) => void
    ) => {
      try {
        const query = new URLSearchParams(
          window.location.hash.split("?")[1] || ""
        );
        const selection = new URLSearchParams();
        if (
          (kind === "shipments" &&
            (window.location.hash.startsWith("#/supply-chain/shipments?") ||
              window.location.hash.startsWith("#/insights/analytics?"))) ||
          (kind === "orders" &&
            window.location.hash.startsWith("#/supply-chain/orders?"))
        )
          for (const name of ["q", "status", "carrier", "mode", "from", "to"]) {
            const value = query.get(name);
            if (
              value &&
              (kind === "shipments" || !["carrier", "mode"].includes(name))
            )
              selection.set(name, value);
          }
        if (onOverview()) {
          const dates = overviewScope(query, mode);
          if (dates.from) selection.set("from", dates.from);
          if (dates.to) selection.set("to", dates.to);
          if (kind === "shipments")
            for (const name of ["q", "status", "carrier", "mode"]) {
              const value = query.get(name);
              if (value) selection.set(name, value);
            }
        }
        selection.set("limit", "500");
        selection.set("offset", "0");
        let data = await readSource(
          `/api/operations/${kind}?${selection}`,
          controller.signal
        );
        if (!Array.isArray(data.items) || !Number.isSafeInteger(data.total))
          throw new Error("Unsupported record response.");
        if (data.total > 10000)
          throw new Error(
            `More than 10,000 matching records. Refine ${kind} filters to load a complete selection.`
          );
        const raw = [...data.items];
        const total = data.total,
          readAt = data.readAt || new Date().toISOString();
        while (data.nextCursor && raw.length < total) {
          selection.set("maxId", String(data.maxId));
          selection.set("cursor", String(data.nextCursor));
          const previous = data.nextCursor;
          data = await readSource(
            `/api/operations/${kind}?${selection}`,
            controller.signal
          );
          if (!Array.isArray(data.items) || data.nextCursor === previous)
            throw new Error("Invalid pagination response.");
          raw.push(...data.items);
        }
        if (raw.length !== total)
          throw new Error(
            "The selection changed during the read. Refresh to try again."
          );
        const items = raw.map(normalize);
        if (!controller.signal.aborted) {
          set({ status: "ready", items, total, readAt });
          if (kind === "shipments") setLastShipmentReadAt(readAt);
        }
      } catch (e) {
        if (
          controller.signal.aborted &&
          (disposed || controller.signal.reason === "filters-changed")
        )
          return;
        set({
          status:
            e instanceof ReadError && e.status === 403
              ? "forbidden"
              : "unavailable",
          items: [],
          total: 0,
          error: e instanceof Error ? e.message : "Source unavailable",
        });
      }
    };
    let disposed = false;
    void Promise.all([
      load("shipments", normalizeShipment, setShipments),
      canOrder(user)
        ? load("orders", normalizeOrder, setOrders)
        : Promise.resolve(
            setOrders({ status: "forbidden", items: [], total: 0 })
          ),
    ]).finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [mode, version, user?.id, user?.role, selection]);
  return (
    <DataContext.Provider
      value={{
        lastShipmentReadAt,
        scope: `${user!.id}:${user!.email}:${demoIdentity ? "demo-account" : "account"}`,
        mode,
        setMode,
        demoIdentity,
        shipments,
        orders,
        refresh,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? (
    <ScopedDataProvider key={`${user.id}:${user.email}`}>
      {children}
    </ScopedDataProvider>
  ) : (
    <>{children}</>
  );
}
export function useData() {
  const value = useContext(DataContext);
  if (!value) throw new Error("Data provider required");
  return value;
}
