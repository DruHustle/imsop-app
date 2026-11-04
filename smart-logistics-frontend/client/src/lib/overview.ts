import {
  Shipment,
  OperationalOrder,
  emptyFilters,
  filterShipments,
  DEMO_AS_OF,
  Mode,
} from "./workspace";
export function utcDay(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : "";
}
export function validDay(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && utcDay(day + "T00:00:00Z") === day;
}
export function overviewScope(
  params: URLSearchParams,
  mode: Mode,
  now: number = Date.now()
) {
  const today = utcDay(mode === "demo" ? DEMO_AS_OF : now),
    period = params.get("period") ?? "30";
  const custom = params.has("from") || params.has("to") || period === "custom";
  const span = period === "7" ? 7 : period === "90" ? 90 : 30;
  const from = custom
    ? (params.get("from") ?? "")
    : period === "all"
      ? ""
      : utcDay(Date.parse(today) - 86400000 * (span - 1));
  const to = custom ? (params.get("to") ?? "") : period === "all" ? "" : today;
  return {
    from,
    to,
    period: custom ? "custom" : period,
    valid:
      (!from || validDay(from)) &&
      (!to || validDay(to)) &&
      (!from || !to || from <= to),
  };
}
export function overviewItems(
  items: Shipment[],
  params: URLSearchParams,
  scope: ReturnType<typeof overviewScope>
) {
  if (!scope.valid) return [];
  return filterShipments(items, {
    ...emptyFilters,
    q: params.get("q") ?? "",
    status: params.get("status") ?? "",
    carrier: params.get("carrier") ?? "",
    mode: params.get("mode") ?? "",
    from: scope.from,
    to: scope.to,
  });
}
export function ordersInScope(
  items: OperationalOrder[],
  scope: ReturnType<typeof overviewScope>
) {
  return scope.valid
    ? items.filter(
        o =>
          (!scope.from || utcDay(o.createdAt) >= scope.from) &&
          (!scope.to ||
            (!!utcDay(o.createdAt) && utcDay(o.createdAt) <= scope.to))
      )
    : [];
}
export type ActivityPoint = {
  date: string;
  created: number;
  delivered: number;
};
export function shipmentActivity(
  items: Shipment[],
  from = "",
  to = "",
  now: string = utcDay(Date.now())
) {
  const creation = items.map(s => utcDay(s.createdAt)).filter(Boolean),
    deliveries = items
      .filter(s => s.status === "Delivered")
      .map(s => utcDay(s.actualArrival))
      .filter(Boolean);
  const start = from || [...creation, ...deliveries].sort()[0] || now,
    end = to || [now, ...creation, ...deliveries].sort().at(-1) || now;
  const days = Math.max(
    1,
    Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1
  );
  const bucket =
    days <= 93
      ? "day"
      : days <= 730
        ? "week"
        : days <= 36600
          ? "month"
          : "year";
  const key = (day: string) =>
    bucket === "year"
      ? day.slice(0, 4) + "-01-01"
      : bucket === "month"
        ? day.slice(0, 7) + "-01"
        : bucket === "week"
          ? utcDay(
              Date.parse(day) - ((new Date(day).getUTCDay() + 6) % 7) * 86400000
            )
          : day;
  const values = new Map<string, ActivityPoint>();
  if (validDay(start) && validDay(end) && start <= end) {
    const cursor = new Date(key(start) + "T00:00:00Z");
    while (utcDay(cursor) <= end) {
      const date = utcDay(cursor);
      values.set(date, { date, created: 0, delivered: 0 });
      if (bucket === "year") cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
      else if (bucket === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      else cursor.setUTCDate(cursor.getUTCDate() + (bucket === "week" ? 7 : 1));
    }
  }
  for (const day of creation)
    if (day >= start && day <= end) values.get(key(day))!.created++;
  for (const day of deliveries)
    if (day >= start && day <= end) values.get(key(day))!.delivered++;
  return {
    points: Array.from(values.values()),
    bucket,
    missingCreation: items.length - creation.length,
    deliveryEvidence: deliveries.length,
    createdTotal: creation.filter(d => d >= start && d <= end).length,
  };
}
export function statusGroups(items: Shipment[]) {
  const counts = new Map<string, number>();
  for (const item of items)
    counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  return Array.from(counts, ([status, count]) => ({ status, count })).sort(
    (a, b) => b.count - a.count || a.status.localeCompare(b.status)
  );
}
export function statusColor(status: string) {
  return status === "Delivered"
    ? "var(--good)"
    : status === "Exception"
      ? "var(--bad)"
      : status === "Delayed"
        ? "var(--warn)"
        : status === "In transit"
          ? "var(--primary)"
          : status === "Out for delivery"
            ? "var(--color-chart-2)"
            : "var(--color-chart-5)";
}
