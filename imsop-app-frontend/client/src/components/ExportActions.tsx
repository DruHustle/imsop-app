import { Button } from "./ui/button";
import { Download, Printer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useData, readSource } from "@/contexts/DataContext";
import { canExport, DEMO_AS_OF } from "@/lib/workspace";
import {
  Column,
  exportToCSV,
  exportToPDF,
  generateHTMLTable,
  escapeHtml,
} from "@/lib/export";
import { toast } from "sonner";
import { useState } from "react";
export function ExportActions<T extends object>({
  items,
  columns,
  name,
  scope,
}: {
  items: T[];
  columns: Column<T>[];
  name: string;
  scope: string;
}) {
  const { user } = useAuth();
  const { mode } = useData();
  const [busy, setBusy] = useState(false);
  if (!canExport(user))
    return (
      <span className="text-xs muted">
        Reports require admin or analyst access.
      </span>
    );
  const run = async (type: "csv" | "print") => {
    if (!items.length) {
      toast.error("There are no matching records to export.");
      return;
    }
    setBusy(true);
    // Open synchronously to preserve the user gesture; fill only after authorization succeeds.
    const popup = type === "print" ? window.open("", "_blank") : null;
    try {
      if (type === "print" && !popup)
        throw new Error(
          "The print window was blocked. Allow popups and try again."
        );
      if (mode === "live") {
        const c = new AbortController();
        const timer = setTimeout(() => c.abort(), 10000);
        try {
          await readSource("/api/operations/reports/access", c.signal);
        } finally {
          clearTimeout(timer);
        }
      }
      const metadata = {
        Mode: mode === "demo" ? "DEMONSTRATION" : "LIVE",
        Source:
          mode === "demo"
            ? "Deterministic IMSOP fixtures"
            : "Node operational database",
        Scope: scope,
        "As of":
          mode === "demo"
            ? DEMO_AS_OF
            : "Observation times are included where available",
        Generated: new Date().toISOString(),
      };
      if (type === "csv") {
        exportToCSV(items, `${name}-${mode}`, columns, metadata);
        toast.info("CSV download requested.");
      } else if (popup) {
        exportToPDF(
          `${name} · ${metadata.Mode}`,
          Object.entries(metadata)
            .map(([k, v]) => `<p>${escapeHtml(k)}: ${escapeHtml(v)}</p>`)
            .join("") + generateHTMLTable(items, columns),
          name,
          popup
        );
      }
    } catch (e) {
      popup?.close();
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        variant="outline"
        disabled={busy || !items.length}
        onClick={() => run("csv")}
      >
        <Download size={14} />
        CSV · filtered
      </Button>
      <Button
        variant="outline"
        disabled={busy || !items.length}
        onClick={() => run("print")}
      >
        <Printer size={14} />
        Print / Save as PDF
      </Button>
    </>
  );
}
