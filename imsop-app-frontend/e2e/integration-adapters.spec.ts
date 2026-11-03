import { test, expect } from "@playwright/test";
import { liveSession } from "./helpers";
test("optional integrations report configuration, actual outbox states and unreadable sources truthfully", async ({
  page,
}) => {
  await liveSession(page);
  let available = true;
  await page.route("**/api/operations/integrations", route =>
    available
      ? route.fulfill({
          json: {
            items: [],
            externalNotifications: false,
            adapters: {
              forecast: { state: "not-configured" },
              sap: { state: "not-configured" },
            },
          },
        })
      : route.fulfill({
          status: 503,
          json: { error: "Isolated registry unavailable" },
        })
  );
  await page.route("**/supply-chain/api/v1/orders/transport", route =>
    available
      ? route.fulfill({
          json: {
            state: "not-configured",
            outbox: [
              { state: "disabled", count: 3 },
              { state: "failed", count: 1 },
            ],
          },
        })
      : route.fulfill({
          status: 503,
          json: { error: "Isolated outbox unavailable" },
        })
  );
  await page.goto("/#/infrastructure/integrations");
  const card = (name: string) =>
    page
      .locator(".integration-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
  for (const name of [
    "SAP",
    "Forecast provider",
    "Order dispatch",
    "Email notifications",
  ])
    await expect(card(name)).toContainText("Not configured");
  await expect(
    page.getByRole("button", { name: "Check SAP metadata" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Actual purchase outbox states" })
  ).toContainText("disabled: 3");
  await expect(
    page.getByRole("list", { name: "Actual purchase outbox states" })
  ).toContainText("failed: 1");
  available = false;
  await page
    .getByRole("button", { name: "Refresh sources", exact: true })
    .click();
  for (const name of [
    "SAP",
    "Forecast provider",
    "Order dispatch",
    "Email notifications",
  ])
    await expect(card(name)).toContainText("Unavailable");
  await expect(
    page.getByRole("list", { name: "Actual purchase outbox states" })
  ).toHaveCount(0);
});
test("SAP metadata receipts are an explicit read-only check, separate from configured state", async ({
  page,
}) => {
  await liveSession(page);
  let probes = 0;
  await page.route("**/api/operations/integrations", route =>
    route.fulfill({
      json: {
        items: [],
        externalNotifications: false,
        adapters: {
          forecast: { state: "not-configured" },
          sap: { state: "configured" },
        },
      },
    })
  );
  await page.route("**/supply-chain/api/v1/orders/transport", route =>
    route.fulfill({ json: { state: "not-configured", outbox: [] } })
  );
  await page.route("**/api/operations/integrations/sap/metadata", route => {
    probes++;
    return route.fulfill({
      json: {
        status: "observed",
        sha256: "a".repeat(64),
        bytes: 123,
        checkedAt: "2026-10-28T12:00:00Z",
      },
    });
  });
  await page.goto("/#/infrastructure/integrations");
  await expect(
    page.getByRole("button", { name: "Check SAP metadata", exact: true })
  ).toBeVisible();
  expect(probes).toBe(0);
  await page
    .getByRole("button", { name: "Check SAP metadata", exact: true })
    .click();
  await expect(
    page.getByText(/Metadata observed.*No business records imported/)
  ).toBeVisible();
  expect(probes).toBe(1);
});
