import { test, expect } from "@playwright/test";
import { isolate, loginDemo, navigate, liveSession } from "./helpers";
test.beforeEach(async ({ page }) => isolate(page));
test("graphical overview keeps scopes, chart totals, locations and selected records synchronized", async ({
  page,
}) => {
  await loginDemo(page);
  await expect(page.locator(".overview-kpis .metric").first()).toContainText(
    "12"
  );
  await expect(
    page.getByRole("figure", {
      name: /Shipment activity by UTC day. 12 created/,
    })
  ).toBeVisible();
  await page.getByLabel("Overview period", { exact: true }).selectOption("7");
  await expect(page.locator(".overview-kpis .metric").first()).toContainText(
    "2"
  );
  await expect(
    page.getByRole("figure", { name: /Status distribution, 2 shipments/ })
  ).toBeVisible();
  if ((page.viewportSize()?.width ?? 1200) < 901)
    await page
      .getByRole("button", { name: "Explore map", exact: true })
      .click();
  await expect(
    page
      .getByLabel("Inspect shipment location", { exact: true })
      .locator("option")
  ).toHaveCount(2);
  await page.getByLabel("Overview period", { exact: true }).selectOption("30");
  await page
    .getByLabel("Inspect shipment location", { exact: true })
    .selectOption("2");
  await expect(page.locator(".map-record-context")).toContainText("SHP-9921");
  await page
    .locator(".map-record-context")
    .getByRole("link", { name: "Open shipment" })
    .click();
  await expect(
    page.getByRole("heading", { name: "SHP-9921", exact: true })
  ).toBeVisible();
  await page.getByRole("link", { name: /Return to filtered/ }).click();
  await expect(page.getByLabel("Overview period", { exact: true })).toHaveValue(
    "30"
  );
  await page.getByRole("button", { name: "Delayed 1", exact: true }).click();
  await expect(page.locator(".overview-kpis .metric").first()).toContainText(
    "1"
  );
  await expect(
    page.getByRole("figure", { name: /Status distribution, 1 shipments/ })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear record filters", exact: true })
    .click();
  await expect(page.locator(".overview-kpis .metric").first()).toContainText(
    "12"
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "3D globe", exact: true }).click();
  await expect(page.locator(".shipment-globe, .geographic-map")).toBeVisible();
  const canvas = page.locator(".shipment-globe");
  if (await canvas.isVisible()) {
    await expect(page.getByRole("button", { name: "Rotate view", exact: true })).toBeDisabled();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByRole("button", { name: "Rotate view", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause view rotation", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/View rotation changes the camera only/)).toBeVisible();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.getByRole("button", { name: "Rotate view", exact: true })).toBeDisabled();
    for (const theme of ["light", "dark"]) {
      await page
        .getByRole("radiogroup", { name: "Theme", exact: true })
        .getByRole("radio", {
          name:
            { light: "Light", dark: "Dark", system: "Auto" }[theme] + " theme",
          exact: true,
        })
        .click();
      await canvas.focus();
      await page.keyboard.press("ArrowRight");
      await page
        .getByRole("button", { name: "Zoom globe in", exact: true })
        .click();
      expect(
        await canvas.evaluate((element: HTMLCanvasElement) =>
          element.getContext("webgl")!.getError()
        )
      ).toBe(0);
      await page.locator(".overview-map-panel").screenshot({
        path: `verification/remediation/spatial-${page.viewportSize()!.width}-${theme}.png`,
        animations: "disabled",
      });
    }
    console.log(
      "Actual WebGL globe rendered, orbited and zoomed in both themes"
    );
    await canvas.evaluate((element: HTMLCanvasElement) =>
      element
        .getContext("webgl")!
        .getExtension("WEBGL_lose_context")
        ?.loseContext()
    );
    await expect(
      page.getByText("3D rendering unavailable on this device.", {
        exact: false,
      })
    ).toBeVisible();
    await expect(page.locator(".geographic-map")).toBeVisible();
  }
});
test("unique workspace visuals support selecting evidence and filtering records", async ({
  page,
}) => {
  await loginDemo(page);
  await navigate(page, "Orders");
  await page
    .getByRole("group", { name: "Filter orders by fulfilment stage" })
    .getByRole("button", { name: /Pending/ })
    .click();
  await expect(page.getByLabel("Order status", { exact: true })).toHaveValue(
    "Pending"
  );
  await navigate(page, "Analytics");
  await page.getByRole("button", { name: /Filter carrier Maersk,/ }).click();
  await expect(
    page.getByRole("combobox", { name: "Carrier", exact: true })
  ).toHaveValue("Maersk");
  await navigate(page, "Recommendations");
  await page
    .getByRole("button", { name: "Oldest evidence first", exact: true })
    .click();
  await expect(page.locator(".evidence-lanes > div").first()).toContainText(
    "Delayed"
  );
  await page.locator(".evidence-lanes").getByRole("button").first().click();
  await expect(page.locator(".map-record-context")).toContainText(
    "Proposed next step"
  );
  await navigate(page, "Service health");
  await page.locator(".topology-branches").getByRole("button").first().click();
  await expect(page.locator(".health-topology [role=status]")).toContainText(
    "no network probe"
  );
  await navigate(page, "Integrations");
  await page.locator(".flow-sources").getByRole("button").click();
  await expect(page.getByRole("status")).toContainText("Intake enabled");
});

test("historical replay selects explicit event locations and pauses without inventing paths", async ({
  page,
}) => {
  await liveSession(page);
  await page.route("**/api/operations/shipments/77/events?**", route =>
    route.fulfill({
      json: {
        items: [
          {
            id: "old",
            provider: "Isolated test feed",
            eventType: "shipment.location",
            status: "In transit",
            occurredAt: "2026-10-20T01:00:00Z",
            receivedAt: "2026-10-20T01:01:00Z",
            position: { lat: 0, lng: 0 },
          },
          {
            id: "new",
            provider: "Isolated test feed",
            eventType: "shipment.location",
            status: "Delayed",
            occurredAt: "2026-10-21T01:00:00Z",
            receivedAt: "2026-10-21T01:01:00Z",
            position: { lat: 10, lng: 20 },
          },
        ],
      },
    })
  );
  await page.goto("/#/supply-chain/shipments/77/tracking");
  await expect(page.locator(".chronology-context")).toContainText("Event #old");
  await page
    .getByRole("button", { name: "Show event location", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: /Geographic longitude/ })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Next observation", exact: true })
    .click();
  await expect(page.locator(".chronology-context")).toContainText("Event #new");
  await page
    .getByRole("button", { name: "Play historical replay", exact: true })
    .click();
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play historical replay", exact: true })
  ).toBeVisible();
});
