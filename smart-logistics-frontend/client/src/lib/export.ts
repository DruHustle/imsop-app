export const escapeHtml = (v: unknown) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe =
    /^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)
      ? `'${text}`
      : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export interface Column<T> {
  key: keyof T;
  label: string;
}
export function buildCSV<T extends object>(
  data: T[],
  columns: Column<T>[],
  metadata: Record<string, string> = {}
) {
  return [
    ...Object.entries(metadata).map(([k, v]) =>
      [csvCell(k), csvCell(v)].join(",")
    ),
    columns.map(c => csvCell(c.label)).join(","),
    ...data.map(row => columns.map(c => csvCell(row[c.key])).join(",")),
  ].join("\r\n");
}
export function generateHTMLTable<T extends object>(
  data: T[],
  columns: Column<T>[]
) {
  return `<table><thead><tr>${columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr></thead><tbody>${data.map(row => `<tr>${columns.map(c => `<td>${escapeHtml(row[c.key])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
export function generateMetricsSummary(
  metrics: { label: string; value: string | number; change?: string }[]
) {
  return metrics
    .map(
      m =>
        `<p>${escapeHtml(m.label)}: ${escapeHtml(m.value)} ${escapeHtml(m.change ?? "")}</p>`
    )
    .join("");
}
export function exportToCSV<T extends object>(
  data: T[],
  filename: string,
  columns: Column<T>[],
  metadata: Record<string, string> = {}
) {
  if (!data.length) throw new Error("There are no matching records to export.");
  const blob = new Blob(["\uFEFF", buildCSV(data, columns, metadata)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
export function exportToPDF(
  title: string,
  content: string,
  _filename: string,
  existingWindow?: Window
) {
  const popup = existingWindow ?? window.open("", "_blank");
  if (!popup)
    throw new Error(
      "The print window was blocked. Allow popups and try again."
    );
  popup.opener = null;
  popup.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:13px system-ui;color:#172b42;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #b9c7d4;padding:8px;text-align:left;overflow-wrap:anywhere}h1{font-size:22px}@media print{button{display:none}}</style></head><body><h1>${escapeHtml(title)}</h1>${content}</body></html>`
  );
  popup.document.close();
  const button = popup.document.createElement("button");
  button.textContent = "Print / Save as PDF";
  button.onclick = () => popup.print();
  popup.document.body.prepend(button);
}
