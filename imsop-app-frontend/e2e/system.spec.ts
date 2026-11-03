import { expect, test } from "@playwright/test";
import { isolate, loginDemo, navigate } from "./helpers";
import { readFile } from "node:fs/promises";
test.beforeEach(async ({ page }) => isolate(page));
for (const role of ["admin", "engineer", "analyst", "demo"] as const) {
  test(`${role} retains role boundaries and Assistant access`, async ({
    page,
  }) => {
    await loginDemo(page, role);
    await navigate(page, "Assistant");
    await expect(
      page.getByRole("heading", { name: "Assistant", exact: true })
    ).toBeVisible();
    for (const [path, allowed, title] of [
      ["/analytics", ["admin", "analyst"].includes(role), "Analytics"],
      [
        "/infrastructure",
        ["admin", "engineer"].includes(role),
        "Service health",
      ],
      ["/intelligence", role !== "demo", "Recommendations"],
      ["/supply-chain/orders", role !== "demo", "Orders"],
    ] as const) {
      await page.goto("/#" + path);
      await expect(
        page.getByRole("heading", {
          name: allowed ? title : "Access denied",
          exact: true,
        })
      ).toBeVisible();
    }
    await page.goto("/#/profile");
    await expect(page.getByLabel("Role", { exact: true })).toHaveValue(
      role === "demo" ? "user" : role
    );
  });
}
test("filters, summaries, map markers, pagination and exports share their visible scope", async ({
  page,
}) => {
  await loginDemo(page);
  await navigate(page, "Shipments");
  await expect(page.getByText("12 matching · 2 need attention")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByLabel("Search shipments", { exact: true }).fill("SHP-8829");
  await expect(page.getByText("1 matching · 0 need attention")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("In transit");
  if ((page.viewportSize()?.width ?? 1200) < 768)
    await page
      .getByRole("button", { name: "More filters", exact: true })
      .click();
  await page
    .getByRole("combobox", { name: "Carrier", exact: true })
    .selectOption("Maersk");
  await page
    .getByRole("combobox", { name: "Transport mode", exact: true })
    .selectOption("Sea");
  await page.getByLabel("Created from").fill("2026-10-10");
  await page.getByLabel("Created through").fill("2026-10-10");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(
    page.getByText("Latitude 31.23 · Longitude 121.47")
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Geographic longitude/ })
  ).toBeVisible();
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV · filtered" }).click();
  const file = await promise;
  expect(file.suggestedFilename()).toBe("shipments-demo.csv");
  const data = await readFile((await file.path())!, "utf8");
  expect(data).toContain("DEMONSTRATION");
  expect(data).toContain("SHP-8829");
  expect(data).not.toContain("SHP-9921");
  expect(data).toContain("2026-10-26T09:00:00.000Z");
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(page.getByText("12 matching · 2 need attention")).toBeVisible();
});
test("shipment details, events, reload and return preserve list filters and history", async ({
  page,
}) => {
  await loginDemo(page);
  await navigate(page, "Shipments");
  await page.getByLabel("Search shipments", { exact: true }).fill("SHP-9921");
  await page
    .getByRole("link", { name: "Open SHP-9921" })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("heading", { name: "SHP-9921" })).toBeVisible();
  await page.getByRole("link", { name: "Tracking / events" }).click();
  await expect(
    page.getByText("Occurred: Oct 24, 2026, 6:00 AM UTC")
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "SHP-9921" })).toBeVisible();
  await page
    .getByRole("link", { name: "← Return to filtered shipments" })
    .click();
  await expect(
    page.getByLabel("Search shipments", { exact: true })
  ).toHaveValue("SHP-9921");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "SHP-9921" })).toBeVisible();
  await page.goForward();
  await expect(page.getByText("1 matching · 1 need attention")).toBeVisible();
});
test("keyboard navigation and Escape close the mobile drawer", async ({
  page,
}) => {
  await loginDemo(page);
  if ((page.viewportSize()?.width ?? 1200) < 768) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const link = page
      .getByRole("dialog")
      .getByRole("link", { name: "Shipments", exact: true });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeHidden();
  } else {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Shipments", exact: true })
      .focus();
    await page.keyboard.press("Enter");
  }
  await expect(
    page.getByRole("heading", { name: "Shipments", exact: true })
  ).toBeVisible();
  await expect(page.locator("#main-content")).toBeFocused();
});
test("Overview query opens once and Assistant grounds known and unknown records", async ({
  page,
}) => {
  await loginDemo(page);
  await page
    .getByLabel("Ask Assistant", { exact: true })
    .fill("Look up SHP-8829");
  await page.getByRole("button", { name: "Open Assistant with query" }).click();
  await expect(page.getByLabel("Your question")).toHaveValue(
    "Look up SHP-8829"
  );
  await expect(page.getByRole("log")).not.toContainText(
    "Demonstration response."
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("SHP-8829: In transit.");
  await expect(page.getByRole("log")).toContainText(
    "Provider: Demo logistics feed"
  );
  await expect(
    page.getByRole("log").getByText("Look up SHP-8829", { exact: true })
  ).toHaveCount(1);
  await page.getByLabel("Your question").fill("Look up SHP-NOT-FOUND");
  await page.getByLabel("Your question").press("Enter");
  await expect(page.getByRole("log")).toContainText(
    "was not found in the permitted context"
  );
});
test("preferences change rendered colors, respect system changes, and persist effective behavior", async ({
  page,
}) => {
  await loginDemo(page);
  await page
    .getByRole("radiogroup", { name: "Theme", exact: true })
    .getByRole("radio", { name: "Light theme", exact: true })
    .click();
  const light = await page
    .locator("body")
    .evaluate(el => getComputedStyle(el).backgroundColor);
  expect(light).toBe("rgb(243, 246, 250)");
  await page
    .getByRole("radiogroup", { name: "Theme", exact: true })
    .getByRole("radio", { name: "Dark theme", exact: true })
    .click();
  expect(
    await page
      .locator("body")
      .evaluate(el => getComputedStyle(el).backgroundColor)
  ).toBe("rgb(13, 23, 37)");
  await page
    .getByRole("radiogroup", { name: "Theme", exact: true })
    .getByRole("radio", { name: "Auto theme", exact: true })
    .click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass("dark");
  await page.goto("/#/settings");
  await page
    .getByRole("switch", { name: "Reduced motion", exact: true })
    .click();
  await page
    .getByRole("switch", { name: "High contrast", exact: true })
    .click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-reduced-motion",
    "true"
  );
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "true");
  await page
    .getByRole("switch", { name: "Reduced motion", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute(
    "data-reduced-motion",
    "true"
  );
});
test("demo notifications persist read state, link to records, and honor preferences", async ({
  page,
}) => {
  await loginDemo(page);
  await page.getByRole("button", { name: "Notifications, 2 unread" }).click();
  await page.getByRole("button", { name: "Mark all read" }).click();
  await page.keyboard.press("Escape");
  await page.reload();
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark all read" })
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.goto("/#/settings");
  await page.getByRole("switch", { name: "Demo shipment alerts" }).click();
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(
    page.getByText("Demo shipment notifications are disabled in Preferences.")
  ).toBeVisible();
});
test("analytics date scope changes calculations and export records", async ({
  page,
}) => {
  await loginDemo(page);
  await navigate(page, "Analytics");
  await page.getByLabel("Created from").fill("2026-10-10");
  await page.getByLabel("Created through").fill("2026-10-10");
  await expect(
    page.getByRole("button", {
      name: "Filter carrier Maersk, 1 shipments",
      exact: true,
    })
  ).toBeVisible();
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV · filtered" }).click();
  const file = await promise;
  const data = await readFile((await file.path())!, "utf8");
  expect(data).toContain("SHP-8829");
  expect(data).not.toContain("SHP-9921");
  expect(data).not.toContain("Revenue");
});
test("creation prerequisite, blocked print and no-match states have useful behavior", async ({
  page,
}) => {
  await loginDemo(page);
  await navigate(page, "Shipments");
  await page.getByRole("button", { name: "Connect shipment source" }).click();
  await expect(
    page.getByRole("heading", { name: "Shipment integration required" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    window.open = () => null;
  });
  await page
    .getByRole("button", { name: "Print / Save as PDF", exact: true })
    .click();
  await expect(
    page.getByText("The print window was blocked. Allow popups and try again.")
  ).toBeVisible();
  await page
    .getByLabel("Search shipments", { exact: true })
    .fill("does-not-exist");
  await expect(
    page.getByRole("heading", { name: "No matching shipments" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "CSV · filtered" })
  ).toBeDisabled();
});
test("profile update, password validation, logout cleanup and 404 recovery still work", async ({
  page,
}) => {
  await loginDemo(page);
  await page.goto("/#/profile");
  await page.getByLabel("Full Name").fill("Updated Demo");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Name updated successfully")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Full Name")).toHaveValue("Updated Demo");
  await page
    .getByRole("button", { name: "Change Password", exact: true })
    .first()
    .click();
  await page.getByLabel("Current Password", { exact: true }).fill("admin123");
  await page
    .getByLabel("New Password", { exact: true })
    .fill("new-demo-password");
  await page
    .getByLabel("Confirm New Password", { exact: true })
    .fill("new-demo-password");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Change Password", exact: true })
    .click();
  await expect(
    page.getByText(
      "Demo password flow validated. Demo credentials remain unchanged."
    )
  ).toBeVisible();
  await page.goto("/#/unknown-route");
  await expect(
    page.getByRole("heading", { name: "404", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Go home" }).click();
  await expect(
    page.getByRole("heading", { name: "Operational overview" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to IMSOP" })
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("imsop_session"))
  ).toBeNull();
});

test("Assistant cancellation prevents a late answer and restores the question", async ({
  page,
}) => {
  await loginDemo(page);
  await navigate(page, "Assistant");
  await page.clock.install({ time: new Date("2026-10-27T09:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-27T09:01:00Z"));
  await page.getByLabel("Your question").fill("Look up SHP-8829");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Question cancelled.", { exact: true })
  ).toBeVisible();
  await expect(page.getByLabel("Your question")).toHaveValue(
    "Look up SHP-8829"
  );
  await page.clock.runFor(500);
  await expect(page.getByRole("log")).not.toContainText("SHP-8829: In transit");
});
