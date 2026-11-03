import { it, expect } from "vitest";
import { answerQuestion, extractIdentifiers } from "./assistant";
import { normalizeShipment, normalizeOrder, performance } from "./workspace";
const ready = <T>(items: T[]) => ({
  status: "ready" as const,
  items,
  total: items.length,
});
it("matches exact identifiers, resolves comparisons and reports each missing identity", () => {
  const s = ready([
    normalizeShipment({
      id: 1,
      trackingNumber: "SHP-1",
      status: "pending",
      transportMode: "parcel",
    }),
    normalizeShipment({
      id: 10,
      trackingNumber: "SHP-10",
      status: "delayed",
      transportMode: "other",
    }),
    normalizeShipment({
      id: 11,
      trackingNumber: "1Z999AA10123456784",
      status: "in_transit",
      transportMode: "parcel",
    }),
  ]);
  const o = ready([
    normalizeOrder({
      id: 1,
      orderNumber: "ORDER-77",
      totalAmount: "0.00",
      currency: "EUR",
    }),
  ]);
  const exact = answerQuestion("Look up SHP-10", s, o, "live");
  expect(exact.links.map(l => l.href)).toEqual(["/supply-chain/shipments/10"]);
  expect(exact.text).toContain("SHP-10: Delayed");
  expect(exact.text).not.toContain("SHP-1:");
  const comparison = answerQuestion(
    "Compare SHP-1 and SHP-10 and SHP-999",
    s,
    o,
    "live"
  );
  expect(comparison.text).toContain("SHP-1: Pending");
  expect(comparison.text).toContain("SHP-10: Delayed");
  expect(comparison.text).toContain("SHP-999 was not found");
  expect(
    answerQuestion("Look up 1Z999AA10123456784", s, o, "live").text
  ).toContain("mode: Parcel");
  expect(answerQuestion("Look up ORDER-77", s, o, "live").text).toContain(
    "0.00; EUR"
  );
});
it("uses the retained promise when ETA is revised and excludes deliveries without a promise", () => {
  const base = normalizeShipment({
    id: 1,
    trackingNumber: "A-1",
    status: "delivered",
    actualArrival: "2026-10-03T13:00:00Z",
    estimatedArrival: "2026-10-04T12:00:00Z",
    promisedArrival: "2026-10-03T12:00:00Z",
  });
  expect(
    performance([base, { ...base, id: "2", promisedArrival: null }])
  ).toEqual({ denominator: 1, onTime: 0, rate: 0 });
});

it("matches carrier identifiers containing punctuation exactly", () => {
  const s = ready([
    normalizeShipment({ id: 1, trackingNumber: "ACME(77)", status: "pending" }),
  ]);
  expect(
    answerQuestion("Look up ACME(77)", s, ready([]), "live").links[0].href
  ).toBe("/supply-chain/shipments/1");
  expect(extractIdentifiers("Look up ACME(77)", ["ACME(77)"])).toEqual([
    "ACME(77)",
  ]);
});

it("does not invent shorter identifiers inside full tracking numbers", () => {
  expect(
    extractIdentifiers("Compare SYSTEM-SHP-10 and SYSTEM-SHP-1", [
      "SYSTEM-SHP-10",
      "SHP-10",
      "SHP-1",
    ])
  ).toEqual(["SYSTEM-SHP-10", "SYSTEM-SHP-1"]);
  expect(extractIdentifiers("Look up SHP-10.2", ["SHP-10"])).toEqual([
    "SHP-10.2",
  ]);
  expect(extractIdentifiers("Look up SHP-ABC", [])).toEqual(["SHP-ABC"]);
});
