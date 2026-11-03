import { test, expect } from "@playwright/test";
import { isolate, loginDemo, navigate } from "./helpers";
test.beforeEach(async ({ page }) => isolate(page));
test("the eight-tab shell highlights only the current tab and group controls work", async ({
  page,
}) => {
  await loginDemo(page);
  await navigate(page, "Shipments");
  const nav =
    (page.viewportSize()?.width ?? 1200) < 768
      ? null
      : page.getByRole("navigation", { name: "Main navigation" });
  if (nav) {
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.locator('[aria-current="page"]')).toHaveText("Shipments");
    await nav.getByRole("button", { name: "Supply chain" }).click();
    await expect(
      nav.getByRole("link", { name: "Shipments", exact: true })
    ).toBeHidden();
    await nav.getByRole("button", { name: "Supply chain" }).click();
    await expect(
      nav.getByRole("link", { name: "Shipments", exact: true })
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Preview SHP-1003", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Preview SHP-1003" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("complementary", { name: "Preview SHP-1003" })
  ).toBeHidden();
  await navigate(page, "Orders");
  await page
    .getByRole("button", { name: "Preview ORD-2026-1041", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Preview ORD-2026-1041" })
  ).toContainText("0.00");
  await expect(
    page.getByRole("complementary", { name: "Preview ORD-2026-1041" })
  ).toContainText("Currency unknown");
});
test("demo reviews persist explicit local actions and comparisons show each requested record", async ({
  page,
}) => {
  await loginDemo(page);
  await navigate(page, "Recommendations");
  await page
    .getByRole("button", { name: "Review case", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Review note", { exact: true })
    .fill("Demonstration follow-up reviewed.");
  await page
    .getByRole("button", { name: "Acknowledge review", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Demo case saved on this device"
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Review case", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Review acknowledged", { exact: true })
  ).toBeVisible();
  await navigate(page, "Assistant");
  await page.getByLabel("Your question").fill("Compare SHP-8829 and SHP-9921");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const table = page.getByRole("log").getByRole("table");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(table.locator("tbody tr").nth(0)).toContainText("SHP-8829");
  await expect(table.locator("tbody tr").nth(0)).toContainText("In transit");
  await expect(table.locator("tbody tr").nth(1)).toContainText("SHP-9921");
  await expect(table.locator("tbody tr").nth(1)).toContainText("Delayed");
  await navigate(page, "Service health");
  await expect(
    page.getByText("Checks observed", { exact: true })
  ).toBeVisible();
  await navigate(page, "Integrations");
  await page.getByText("View requirements", { exact: true }).first().click();
  await expect(
    page.getByText(/Live intake requires a signed event contract/)
  ).toBeVisible();
});

test("board layouts preserve the established theme tokens, dark backgrounds and system behavior", async ({
  page,
}) => {
  await loginDemo(page);
  for (const [theme, primary, background, sidebar] of [
    ["light", "#087d92", "rgb(243, 246, 250)", "rgb(17, 35, 56)"],
    ["dark", "#5ed3e4", "rgb(13, 23, 37)", "rgb(16, 28, 44)"],
  ]) {
    await page
      .getByRole("radiogroup", { name: "Theme", exact: true })
      .getByRole("radio", {
        name:
          { light: "Light", dark: "Dark", system: "Auto" }[theme] + " theme",
        exact: true,
      })
      .click();
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--primary")
          .trim()
      )
    ).toBe(primary);
    expect(
      await page
        .locator("body")
        .evaluate(el => getComputedStyle(el).backgroundColor)
    ).toBe(background);
    expect(
      await page
        .locator(".sidebar")
        .evaluate(el => getComputedStyle(el).backgroundColor)
    ).toBe(sidebar);
    expect(
      await page
        .getByRole("button", { name: "Account menu", exact: true })
        .evaluate(el => getComputedStyle(el).color)
    ).toBe(theme === "dark" ? "rgb(229, 237, 246)" : "rgb(23, 43, 66)");
  }
  await page
    .getByRole("radiogroup", { name: "Theme", exact: true })
    .getByRole("radio", { name: "Auto theme", exact: true })
    .click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
});
