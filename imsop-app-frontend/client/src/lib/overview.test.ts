import { describe, it, expect } from "vitest";
import { demoShipments, demoOrders } from "./demo-data";
import {
  overviewScope,
  overviewItems,
  shipmentActivity,
  statusGroups,
  ordersInScope,
  utcDay,
} from "./overview";
import { globePoint, rotatePoint, projectPoint } from "./globe";
describe("graphical overview evidence", () => {
  it("uses UTC dates and a deterministic demo scope, never a pictured chart shape", () => {
    const scope = overviewScope(new URLSearchParams("period=30"), "demo", 0),
      items = overviewItems(demoShipments, new URLSearchParams(), scope),
      activity = shipmentActivity(items, scope.from, scope.to, "2026-10-26");
    expect(scope.from).toBe("2026-09-27");
    expect(items).toHaveLength(12);
    expect(activity.points.reduce((n, p) => n + p.created, 0)).toBe(12);
    expect(Math.max(...activity.points.map(p => p.created))).toBe(1);
    expect(activity.points.reduce((n, p) => n + p.delivered, 0)).toBe(3);
    expect(statusGroups(items).reduce((n, g) => n + g.count, 0)).toBe(
      items.length
    );
    expect(utcDay("2026-10-20T23:30:00-03:00")).toBe("2026-10-21");
  });
  it("changes every selected cohort for seven days and validates custom bounds", () => {
    const query = new URLSearchParams("period=7"),
      scope = overviewScope(query, "demo"),
      items = overviewItems(demoShipments, query, scope);
    expect(items).toHaveLength(2);
    expect(items.filter(s => s.latitude !== null)).toHaveLength(1);
    expect(
      ordersInScope(demoOrders, scope).filter(o => o.status === "Pending")
    ).toHaveLength(1);
    expect(
      overviewScope(
        new URLSearchParams("from=2026-02-30&to=2026-02-31"),
        "demo"
      ).valid
    ).toBe(false);
    expect(
      overviewScope(
        new URLSearchParams("from=2026-10-25&to=2026-10-20"),
        "demo"
      ).valid
    ).toBe(false);
  });
  it("bounds historical chart work by calendar buckets", () => {
    const long = shipmentActivity([], "1800-01-01", "2026-10-26");
    expect(long.bucket).toBe("year");
    expect(long.points).toHaveLength(227);
    const months = shipmentActivity([], "2020-01-01", "2026-10-26");
    expect(months.bucket).toBe("month");
    expect(months.points).toHaveLength(82);
  });
  it("does not substitute observed or revised ETA for delivery timestamps", () => {
    const items = demoShipments.map(s => ({ ...s, actualArrival: null }));
    const activity = shipmentActivity(items, "2026-10-01", "2026-10-31");
    expect(activity.deliveryEvidence).toBe(0);
    expect(activity.points.every(p => p.delivered === 0)).toBe(true);
  });
  it("preserves real zero coordinates and projects front/back points consistently", () => {
    expect(globePoint(0, 0)).toEqual([0, 0, 1]);
    expect(projectPoint(globePoint(0, 0), 0, 0, 3.2, 400, 260)).toMatchObject({
      x: 200,
      y: 130,
      visible: true,
    });
    expect(projectPoint(globePoint(0, 180), 0, 0, 3.2, 400, 260).visible).toBe(
      false
    );
    expect(
      rotatePoint(
        globePoint(40, 70),
        (-70 * Math.PI) / 180,
        (40 * Math.PI) / 180
      )[2]
    ).toBeCloseTo(1);
  });
});
