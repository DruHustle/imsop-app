export type Health =
  | "Unknown"
  | "Not configured"
  | "Healthy"
  | "Degraded"
  | "Unavailable"
  | "Stale";
export function aggregateHealth(values: Health[]): Health {
  if (!values.length) return "Unknown";
  if (values.every(v => v === "Unavailable")) return "Unavailable";
  if (values.some(v => v === "Unavailable" || v === "Degraded"))
    return "Degraded";
  if (values.some(v => v === "Stale")) return "Stale";
  if (values.some(v => v === "Unknown")) return "Unknown";
  if (values.every(v => v === "Not configured")) return "Not configured";
  if (values.some(v => v === "Not configured")) return "Unknown";
  return "Healthy";
}
