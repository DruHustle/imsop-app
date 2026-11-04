import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import {
  normalizeShipment,
  normalizeOrder,
  filterShipments,
  emptyFilters,
  performance,
  isStale,
  DEMO_AS_OF,
} from "@/lib/workspace";
import { demoShipments, demoOrders } from "@/lib/demo-data";
import { answerQuestion } from "@/lib/assistant";
import { aggregateHealth } from "@/lib/health";
import {
  csvCell,
  buildCSV,
  escapeHtml,
  generateHTMLTable,
  generateMetricsSummary,
  exportToCSV,
  exportToPDF,
} from "@/lib/export";
import { PageHeader, StatusBadge, EmptyState } from "@/components/Workspace";
import { routes, permitted } from "@/lib/routes";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const ready = <T,>(items: T[]) => ({
  status: "ready" as const,
  items,
  total: items.length,
});
describe("normalized operational contracts", () => {
  it("keeps stable identity separate from tracking, maps provider fields and preserves real zero coordinates", () => {
    const s = normalizeShipment({
      id: 17,
      trackingNumber: "SHP-EXTERNAL",
      status: "in_transit",
      transportMode: "ocean",
      latitude: "0",
      longitude: 0,
      observedAt: "2026-10-20T12:00:00Z",
    });
    expect(s).toMatchObject({
      id: "17",
      trackingNumber: "SHP-EXTERNAL",
      status: "In transit",
      transportMode: "Sea",
      latitude: 0,
      longitude: 0,
      receivedAt: null,
    });
    expect(s.observedAt).toBe("2026-10-20T12:00:00.000Z");
  });
  it("does not invent coordinates, observation time, unknown statuses or transport modes", () => {
    const s = normalizeShipment({
      id: 1,
      trackingNumber: "S",
      status: "new_provider_value",
      transportMode: "teleport",
      latitude: 91,
      longitude: "",
    });
    expect(s.latitude).toBeNull();
    expect(s.longitude).toBeNull();
    expect(s.observedAt).toBeNull();
    expect(s.transportMode).toBe("Unknown");
    expect(s.status).toBe("Other (new_provider_value)");
  });
  it("preserves zero order amounts and rejects .NET purchase-order identities", () => {
    expect(demoOrders[0].totalAmount).toBe("0.00");
    expect(() =>
      normalizeOrder({
        id: "5096db96-c450-4cb5-aefe-000000000001",
        orderNumber: "PO-1",
      })
    ).toThrow();
  });
  it("filters all supported dimensions and returns a stable sorted scope", () => {
    expect(
      filterShipments(demoShipments, { ...emptyFilters, status: "attention" })
    ).toHaveLength(2);
    expect(
      filterShipments(demoShipments, {
        ...emptyFilters,
        q: "SHP-8829",
        carrier: "Maersk",
        mode: "Sea",
        from: "2026-10-10",
        to: "2026-10-10",
      }).map(s => s.id)
    ).toEqual(["1"]);
    expect(
      filterShipments(demoShipments, { ...emptyFilters, from: "2030-01-01" })
    ).toEqual([]);
    expect(
      filterShipments(demoShipments, { ...emptyFilters, sort: "tracking" })[0]
        .trackingNumber
    ).toBe("SHP-1001");
  });
  it("uses a weighted denominator only for delivered records with both dates", () => {
    const base = demoShipments[0];
    const items = [
      {
        ...base,
        status: "Delivered",
        estimatedArrival: "2026-10-24T12:00:00Z",
        promisedArrival: "2026-10-24T12:00:00Z",
        actualArrival: "2026-10-24T11:00:00Z",
      },
      {
        ...base,
        status: "Delivered",
        estimatedArrival: "2026-10-24T12:00:00Z",
        promisedArrival: "2026-10-24T12:00:00Z",
        actualArrival: "2026-10-24T13:00:00Z",
      },
      { ...base, status: "Delivered", actualArrival: null },
    ];
    expect(performance(items)).toEqual({ denominator: 2, onTime: 1, rate: 50 });
    expect(performance([]).rate).toBeNull();
    expect(isStale(demoShipments[1], DEMO_AS_OF)).toBe(true);
  });
});
describe("grounded assistant and health evidence", () => {
  it("cites known records and says unknown records are outside scope", () => {
    const s = ready(demoShipments),
      o = ready(demoOrders);
    const known = answerQuestion("Look up SHP-8829", s, o, "demo");
    expect(known.text).toContain("Demonstration response");
    expect(known.text).toContain("In transit");
    expect(known.text).toContain("2026");
    expect(known.links[0].href).toBe("/supply-chain/shipments/1");
    const unknown = answerQuestion("SHP-UNKNOWN", s, o, "live");
    expect(unknown.text).toContain("was not found");
    expect(unknown.links).toHaveLength(1);
  });
  it("does not leak unauthorized orders or fabricate records on failures", () => {
    const forbidden = { status: "forbidden" as const, items: [], total: 0 };
    expect(
      answerQuestion("ORD-2026-1041", ready(demoShipments), forbidden, "live")
        .text
    ).toContain("unavailable for your role");
    expect(
      answerQuestion(
        "summary",
        { status: "unavailable", items: [], total: 0 },
        forbidden,
        "live"
      ).text
    ).toContain("no demo data");
  });
  it("aggregates unknown, stale, degraded and healthy evidence consistently", () => {
    expect(aggregateHealth([])).toBe("Unknown");
    expect(aggregateHealth(["Healthy", "Unavailable"])).toBe("Degraded");
    expect(aggregateHealth(["Healthy", "Unknown"])).toBe("Unknown");
    expect(aggregateHealth(["Healthy", "Stale"])).toBe("Stale");
    expect(aggregateHealth(["Healthy", "Healthy"])).toBe("Healthy");
  });
  it("retains standard-user Assistant access while restricting orders and privileged insights", () => {
    const user = { id: "u", email: "u@test", name: "U", role: "user" as const };
    for (const id of ["overview", "shipments", "assistant"])
      expect(permitted(routes.find(r => r.id === id)!, user)).toBe(true);
    for (const id of ["orders", "analytics", "recommendations", "health"])
      expect(permitted(routes.find(r => r.id === id)!, user)).toBe(false);
  });
});
describe("safe exports and failure states", () => {
  it("escapes stored HTML, titles, headers and metric fields", () => {
    const html = generateHTMLTable(
      [{ v: "<img src=x onerror=alert(1)>" }],
      [{ key: "v", label: "<script>" }]
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(
      generateMetricsSummary([
        { label: "<b>", value: "<iframe>", change: "<x>" },
      ])
    ).not.toContain("<iframe>");
    expect(escapeHtml("\"&'")).toBe("&quot;&amp;&#39;");
  });
  it("neutralizes spreadsheet formulas including whitespace and metadata", () => {
    for (const formula of [
      "=1+1",
      " +SUM(A1)",
      "-1+1",
      "@SUM(A1)",
      "\t=1",
      "\n=1",
    ])
      expect(csvCell(formula)).toBe("\"'" + formula + '"');
    expect(
      buildCSV([{ v: 'safe,"value"' }], [{ key: "v", label: "=heading" }], {
        Source: "=bad",
      })
    ).toContain('"\'=heading"');
    expect(csvCell("0")).toBe('"0"');
  });
  it("reports empty exports and blocked print windows", () => {
    expect(() =>
      exportToCSV([], "empty", [{ key: "id", label: "ID" }])
    ).toThrow("no matching");
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(() => exportToPDF("<bad>", "<p>safe</p>", "report")).toThrow(
      "blocked"
    );
  });
  it("renders meaningful named page, status and empty-state components", () => {
    render(
      <>
        <PageHeader title="Shipments" description="Authorized records" />
        <StatusBadge value="Unavailable" />
        <EmptyState title="No matching shipments" description="Reset filters" />
      </>
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "No matching shipments" })
    ).toBeTruthy();
  });
});
