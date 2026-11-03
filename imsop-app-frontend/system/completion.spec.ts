import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync("/tmp/imsop-browser-fixture.json", "utf8")
);
test("real purchasing, warehouse receiving, email opt-in and validated provider forecasts work in the browser", async ({
  page,
}) => {
  await page.goto("/#/login");
  await page.getByLabel("Email", { exact: true }).fill(fixture.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Isolated-test-password-123");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Operational overview" })
  ).toBeVisible();
  await page.goto("/#/supply-chain/orders");
  await page.getByText("Create purchase order", { exact: true }).click();
  await page
    .getByLabel("Purchase supplier", { exact: true })
    .selectOption(fixture.supplierId);
  const reference = "BROWSER-" + Date.now();
  await page.getByLabel("Order reference", { exact: true }).fill(reference);
  await page.getByLabel("Source currency", { exact: true }).fill("EUR");
  await page
    .getByRole("group", { name: "Item 1", exact: true })
    .getByLabel("Product", { exact: true })
    .selectOption(fixture.productId);
  await page
    .getByRole("group", { name: "Item 1", exact: true })
    .getByLabel("Quantity", { exact: true })
    .fill("2");
  await page
    .getByRole("button", { name: "Save purchase order", exact: true })
    .click();
  await expect(page.getByText("24.6912 EUR", { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Review purchase " + reference, exact: true })
    .click();
  const purchase = page.getByRole("region", {
    name: "Purchase " + reference,
    exact: true,
  });
  await purchase
    .getByLabel("Receiving warehouse", { exact: true })
    .selectOption(fixture.warehouseId);
  await purchase
    .getByLabel("Received time (UTC)", { exact: true })
    .fill(new Date().toISOString().slice(0, 16));
  await purchase
    .getByLabel("Receipt evidence", { exact: true })
    .fill("Counted two physical parts in the isolated receiving workflow.");
  await purchase
    .getByLabel("Receive Verification part", { exact: true })
    .fill("2");
  await purchase
    .getByRole("button", { name: "Record warehouse receipt", exact: true })
    .click();
  await expect(
    page.getByText("Receipt recorded and inventory updated once.", {
      exact: true,
    })
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("received", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "verification/remediation/purchasing-received.png",
    fullPage: true,
  });
  await page.goto("/#/settings");
  await expect(
    page.getByRole("switch", { name: "Review activity emails", exact: true })
  ).toBeEnabled();
  await page
    .getByRole("switch", { name: "Review activity emails", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Review activity emails", exact: true })
  ).toBeChecked();
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "Review activity emails", exact: true })
  ).toBeChecked();
  await page.goto("/#/insights/recommendations");
  await page.getByText("Forecast evidence", { exact: true }).first().click();
  await page.getByText("Supply source observations", { exact: true }).click();
  const today = new Date().toISOString().slice(0, 10),
    yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Observation JSON", { exact: true }).fill(
    JSON.stringify([
      {
        sku: "BROWSER-PART",
        date: yesterday,
        quantity: 3,
        unit: "items",
        source: "Isolated warehouse demand evidence",
      },
      {
        sku: "BROWSER-PART",
        date: today,
        quantity: 5,
        unit: "items",
        source: "Isolated warehouse demand evidence",
      },
    ])
  );
  await page
    .getByRole("button", { name: "Save source observations", exact: true })
    .click();
  await expect(
    page.getByText("2 source observations · 1 products", { exact: true })
  ).toBeVisible();
  await page.getByLabel("Forecast horizon (days)", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Request forecast", exact: true })
    .click();
  await expect(page.getByText(/isolated-contract-double-v1/)).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "BROWSER-PART", exact: true })
  ).toHaveCount(2);
  await page.reload();
  await page.getByText("Forecast evidence", { exact: true }).first().click();
  await expect(page.getByText(/isolated-contract-double-v1/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("radiogroup", { name: "Theme", exact: true })
    .getByRole("radio", { name: "Dark theme", exact: true })
    .click();
  await page.screenshot({
    path: "verification/remediation/forecast-mobile-dark.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
});
