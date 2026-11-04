import { expect, Page } from "@playwright/test";
export const liveShipment = {
  id: 77,
  trackingNumber: "LIVE-TRACK-77",
  origin: "Harare",
  destination: "Bulawayo",
  carrier: "Fixture carrier",
  transportMode: "road",
  status: "in_transit",
  latitude: "0",
  longitude: "0",
  createdAt: "2026-10-20T08:00:00Z",
  estimatedArrival: "2026-10-28T12:00:00Z",
  actualArrival: null,
  observedAt: "2026-10-24T06:00:00Z",
  receivedAt: "2026-10-24T06:01:00Z",
  provider: "Isolated test feed",
};
export const liveOrder = {
  id: 101,
  orderNumber: "ORD-LIVE-101",
  customerId: 0,
  totalAmount: "0.00",
  status: "pending",
  createdAt: "2026-10-21T08:00:00Z",
};
export async function isolate(page: Page) {
  await page.route("**/api/**", route =>
    route.fulfill({
      status: 503,
      json: { error: "Unexpected fixture request" },
    })
  );
  await page.route("**/api/auth/me", route =>
    route.fulfill({ status: 401, json: { error: "Unauthorized" } })
  );
  await page.route(/https:\/\/(?!127\.0\.0\.1|localhost)/, route =>
    route.abort()
  );
}
export async function loginDemo(
  page: Page,
  role: "admin" | "engineer" | "analyst" | "demo" = "admin"
) {
  await page.goto("/#/login");
  await page
    .getByRole("button", { name: new RegExp(`^${role}$`, "i") })
    .click();
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(
    page.getByRole("heading", { name: "Operational overview" })
  ).toBeVisible();
}
export async function navigate(page: Page, label: string) {
  if ((page.viewportSize()?.width ?? 1200) < 768) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
  } else
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: label, exact: true })
      .click();
}
export async function liveSession(
  page: Page,
  role = "admin",
  status = 200,
  items: unknown[] = [liveShipment]
) {
  await isolate(page);
  await page.route("**/api/auth/me", route =>
    route.fulfill({
      json: {
        user: {
          id: "live-fixture",
          email: "fixture@example.test",
          name: "Live Fixture",
          role,
        },
      },
    })
  );
  await page.route("**/api/operations/shipments?**", route =>
    route.fulfill({
      status,
      json:
        status === 200
          ? { items, total: items.length, limit: 500, offset: 0 }
          : { error: "Isolated source failure" },
    })
  );
  await page.route("**/api/operations/orders?**", route =>
    route.fulfill({
      json: { items: [liveOrder], total: 1, limit: 500, offset: 0 },
    })
  );
  await page.route("**/api/operations/shipments/77", route =>
    route.fulfill({ json: liveShipment })
  );
  await page.route("**/api/operations/shipments/77/events?**", route =>
    route.fulfill({
      json: {
        items: [
          {
            id: 9,
            provider: "Isolated test feed",
            eventType: "in_transit",
            occurredAt: liveShipment.observedAt,
            receivedAt: liveShipment.receivedAt,
          },
        ],
      },
    })
  );
  await page.route("**/api/operations/orders/101", route =>
    route.fulfill({ json: liveOrder })
  );
  await page.route("**/api/operations/reports/access", route =>
    route.fulfill({
      status: ["admin", "analyst"].includes(role) ? 200 : 403,
      json: { allowed: ["admin", "analyst"].includes(role) },
    })
  );
  for (const path of ["reviews", "notifications", "integrations"])
    await page.route(`**/api/operations/${path}*`, r =>
      r.fulfill({ json: { items: [] } })
    );
  await page.route("**/health", route =>
    route.fulfill({ json: { status: "ok" } })
  );
  await page.route("**/ready", route =>
    route.fulfill({ status: 503, json: { status: "not_ready" } })
  );
}
