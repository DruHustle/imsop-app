import { z } from "zod";
const sourceId = z.union([
  z.number().int().positive(),
  z.string().regex(/^[1-9]\d*$/),
]);
const optionalText = z.string().max(1000).nullable().optional();
const optionalDate = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional();
const shipmentRead = z
  .object({
    id: sourceId,
    trackingNumber: z.string().trim().min(1).max(100),
    origin: optionalText,
    destination: optionalText,
    status: optionalText,
    carrier: optionalText,
    transportMode: optionalText,
    createdAt: optionalDate,
    estimatedArrival: optionalDate,
    actualArrival: optionalDate,
    promisedArrival: optionalDate,
    observedAt: optionalDate,
    receivedAt: optionalDate,
    provider: optionalText,
    latitude: z.union([z.string(), z.number()]).nullable().optional(),
    longitude: z.union([z.string(), z.number()]).nullable().optional(),
  })
  .passthrough();
const orderRead = z
  .object({
    id: sourceId,
    orderNumber: z.string().trim().min(1).max(100),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .optional(),
    totalAmount: z
      .union([z.string().regex(/^-?\d+(?:\.\d+)?$/), z.number().finite()])
      .nullable()
      .optional(),
    createdAt: optionalDate,
  })
  .passthrough();
import { User } from "./auth-types";
export type Mode = "live" | "demo";
export type SourceStatus = "loading" | "ready" | "forbidden" | "unavailable";
export interface Shipment {
  id: string;
  trackingNumber: string;
  origin: string;
  destination: string;
  status: string;
  carrier: string;
  transportMode: string;
  createdAt: string | null;
  estimatedArrival: string | null;
  actualArrival: string | null;
  promisedArrival?: string | null;
  latitude: number | null;
  longitude: number | null;
  observedAt: string | null;
  receivedAt: string | null;
  provider: string | null;
}
export interface OperationalOrder {
  id: string;
  orderNumber: string;
  customerId: string | null;
  totalAmount: string | null;
  currency?: string | null;
  status: string;
  createdAt: string | null;
  source: "node.orders";
}
// PurchaseOrder GUIDs and envelopes are intentionally not accepted by this adapter.
export interface TrackingEvent {
  position?: {lat:number;lng:number} | null;
  status?: string | null;
  id: string;
  provider: string;
  eventType: string;
  occurredAt: string;
  receivedAt: string | null;
}
export const statusLabel = (value: unknown) => {
  const key = String(value ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return (
    (
      {
        in_transit: "In transit",
        delivered: "Delivered",
        pending: "Pending",
        delayed: "Delayed",
        exception: "Exception",
        cancelled: "Cancelled",
        picked_up: "Picked up",
        out_for_delivery: "Out for delivery",
        processing: "Processing",
        completed: "Completed",
        draft: "Draft",
      } as Record<string, string>
    )[key] ?? (key === "unknown" ? "Unknown" : `Other (${String(value)})`)
  );
};
const text = (v: unknown, fallback = "Unknown") =>
  typeof v === "string" && v.trim() ? v : fallback;
const date = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v))
    ? new Date(v).toISOString()
    : null;
const coordinate = (v: unknown, max: number) =>
  v === null ||
  v === undefined ||
  String(v).trim() === "" ||
  !Number.isFinite(Number(v)) ||
  Math.abs(Number(v)) > max
    ? null
    : Number(v);
export function normalizeShipment(raw: Record<string, unknown>): Shipment {
  raw = shipmentRead.parse(raw);
  if (
    !/^[1-9]\d*$/.test(String(raw.id)) ||
    typeof raw.trackingNumber !== "string" ||
    !raw.trackingNumber.trim()
  )
    throw new Error("Invalid shipment identity");
  const mode = String(raw.transportMode ?? "").toLowerCase();
  return {
    id: String(raw.id),
    trackingNumber: text(raw.trackingNumber),
    origin: text(raw.origin),
    destination: text(raw.destination),
    status: statusLabel(raw.status),
    carrier: text(raw.carrier, "Not supplied"),
    transportMode:
      (
        {
          ocean: "Sea",
          sea: "Sea",
          air: "Air",
          road: "Road",
          rail: "Rail",
          parcel: "Parcel",
          other: "Other",
        } as Record<string, string>
      )[mode] ?? "Unknown",
    createdAt: date(raw.createdAt),
    estimatedArrival: date(raw.estimatedArrival),
    actualArrival: date(raw.actualArrival),
    promisedArrival: date(raw.promisedArrival),
    latitude: coordinate(raw.latitude, 90),
    longitude: coordinate(raw.longitude, 180),
    observedAt: date(raw.observedAt),
    receivedAt: date(raw.receivedAt),
    provider: typeof raw.provider === "string" ? raw.provider : null,
  };
}
export function normalizeOrder(raw: Record<string, unknown>): OperationalOrder {
  raw = orderRead.parse(raw);
  if (!/^[1-9]\d*$/.test(String(raw.id)) || !raw.orderNumber)
    throw new Error("Invalid Node operational order");
  return {
    id: String(raw.id),
    orderNumber: text(raw.orderNumber),
    customerId:
      raw.customerId === null || raw.customerId === undefined
        ? null
        : String(raw.customerId),
    currency:
      typeof raw.currency === "string" && /^[A-Z]{3}$/.test(raw.currency)
        ? raw.currency
        : null,
    totalAmount:
      raw.totalAmount === null || raw.totalAmount === undefined
        ? null
        : String(raw.totalAmount),
    status: statusLabel(raw.status),
    createdAt: date(raw.createdAt),
    source: "node.orders",
  };
}
export const canOrder = (user: User | null) =>
  !!user && ["admin", "engineer", "analyst"].includes(user.role);
export const canExport = (user: User | null) =>
  !!user && ["admin", "analyst"].includes(user.role);
export const DEMO_AS_OF = "2026-10-26T09:00:00.000Z";
export const isException = (s: Shipment) =>
  ["Delayed", "Exception"].includes(s.status);
export const isStale = (s: Shipment, now: string | number = Date.now()) =>
  !!s.observedAt && +new Date(now) - Date.parse(s.observedAt) > 24 * 3600_000;
export const formatTime = (v: string | null) =>
  v
    ? new Date(v).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }) + " UTC"
    : "Not supplied";
export function performance(items: Shipment[]) {
  const eligible = items.filter(
    s => s.status === "Delivered" && s.promisedArrival && s.actualArrival
  );
  const onTime = eligible.filter(
    s => Date.parse(s.actualArrival!) <= Date.parse(s.promisedArrival!)
  ).length;
  return {
    denominator: eligible.length,
    onTime,
    rate: eligible.length ? (onTime / eligible.length) * 100 : null,
  };
}
export interface Filters {
  q: string;
  status: string;
  carrier: string;
  mode: string;
  from: string;
  to: string;
  sort: string;
}
export const emptyFilters: Filters = {
  q: "",
  status: "",
  carrier: "",
  mode: "",
  from: "",
  to: "",
  sort: "newest",
};
export function filterShipments(items: Shipment[], f: Filters) {
  return items
    .filter(
      s =>
        (!f.q ||
          [s.trackingNumber, s.origin, s.destination, s.carrier]
            .join(" ")
            .toLowerCase()
            .includes(f.q.toLowerCase())) &&
        (!f.status ||
          (f.status === "attention"
            ? isException(s)
            : f.status === "active"
              ? !["Delivered", "Cancelled"].includes(s.status)
              : s.status === f.status)) &&
        (!f.carrier || s.carrier === f.carrier) &&
        (!f.mode || s.transportMode === f.mode) &&
        (!f.from || (!!s.createdAt && s.createdAt.slice(0, 10) >= f.from)) &&
        (!f.to || (!!s.createdAt && s.createdAt.slice(0, 10) <= f.to))
    )
    .sort((a, b) =>
      f.sort === "tracking"
        ? a.trackingNumber.localeCompare(b.trackingNumber)
        : f.sort === "eta"
          ? (a.estimatedArrival ?? "9999").localeCompare(
              b.estimatedArrival ?? "9999"
            )
          : (b.createdAt ?? "").localeCompare(a.createdAt ?? "") ||
            b.id.localeCompare(a.id, undefined, { numeric: true })
    );
}
