import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import {
  isolate,
  loginDemo,
  liveSession,
  liveShipment,
  liveOrder,
} from "./helpers";

test("demo Live selection requests real authentication, preserves the route and removes all demo evidence", async ({
  page,
}) => {
  await isolate(page);
  await loginDemo(page);
  await expect(page.locator('.source-note[data-mode="demo"]')).toContainText(
    "12 records in scope of 12"
  );
  let reads = 0,
    logins = 0;
  page.on("request", request => {
    if (/\/api\/operations\/(shipments|orders)/.test(request.url())) reads++;
  });
  await page.goto("/#/supply-chain/shipments?status=Delayed");
  await page.getByLabel("Data mode", { exact: true }).selectOption("live");
  await expect(
    page.getByText("Sign in with your workspace account to view live data.", {
      exact: true,
    })
  ).toBeVisible();
  await expect(page.locator(".demo-note")).toHaveCount(0);
  expect(reads).toBe(0);
  await mkdir("verification/live-mode", { recursive: true });
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `verification/live-mode/sign-in-${test.info().project.name}-${theme}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }

  const user = {
    id: "live-fixture",
    email: "admin@imsop.io",
    name: "Live workspace user",
    role: "admin",
  };
  await page.route("**/api/auth/login", route => {
    logins++;
    expect(route.request().postDataJSON()).toEqual({
      email: user.email,
      password: "Actual-workspace-password-123",
    });
    return route.fulfill({ json: { user } });
  });
  await page.route("**/api/auth/me", route =>
    route.fulfill({ json: { user } })
  );
  await page.route("**/api/operations/shipments?**", route =>
    route.fulfill({
      json: { items: [{ ...liveShipment, status: "delayed" }], total: 1 },
    })
  );
  await page.route("**/api/operations/orders?**", route =>
    route.fulfill({ json: { items: [liveOrder], total: 1 } })
  );
  // A prior Live account's Demo preference must not undo the explicit Live request.
  await page.evaluate(() =>
    localStorage.setItem(
      "imsop:mode:live-fixture:admin@imsop.io:account",
      "demo"
    )
  );
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Actual-workspace-password-123");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByLabel("Data mode", { exact: true })).toHaveValue(
    "live"
  );
  await expect(page).toHaveURL(/#\/supply-chain\/shipments\?status=Delayed$/);
  await expect(
    page
      .getByRole("link", { name: "LIVE-TRACK-77", exact: true })
      .filter({ visible: true })
  ).toBeVisible();
  await expect(page.locator('.source-note[data-mode="live"]')).toContainText(
    "Live · Workspace records"
  );
  await expect(
    page.getByText("Demo dataset · As of", { exact: false })
  ).toHaveCount(0);
  await expect(page.locator(".demo-note")).toHaveCount(0);
  expect(logins).toBe(1);
  for (const theme of ["light", "dark"] as const) {
    await page
      .getByRole("radiogroup", { name: "Theme", exact: true })
      .getByRole("radio", {
        name:
          { light: "Light", dark: "Dark", system: "Auto" }[theme] + " theme",
        exact: true,
      })
      .click();
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `verification/live-mode/live-${test.info().project.name}-${theme}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }

  expect(
    await page.evaluate(() => localStorage.getItem("imsop_token"))
  ).toBeNull();
  await page.reload();
  await expect(page.getByLabel("Data mode", { exact: true })).toHaveValue(
    "live"
  );
  await expect(page.locator(".demo-note")).toHaveCount(0);
});

test("a real account switches from Demo to Live without demo dates or counts while the source loads", async ({
  page,
}) => {
  await liveSession(page);
  await page.goto("/#/");
  await expect(page.locator('.source-note[data-mode="live"]')).toBeVisible();
  await page.getByLabel("Data mode", { exact: true }).selectOption("demo");
  await expect(page.locator(".demo-note")).toContainText(
    "12 records in scope of 12"
  );
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => (release = resolve));
  await page.route("**/api/operations/shipments?**", async route => {
    await gate;
    await route
      .fulfill({ json: { items: [liveShipment], total: 1 } })
      .catch(() => {});
  });
  await page.getByLabel("Data mode", { exact: true }).selectOption("live");
  await expect(page.locator('.source-note[data-mode="live"]')).toBeVisible();
  await expect(
    page.getByText("Demo dataset · As of", { exact: false })
  ).toHaveCount(0);
  await expect(page.locator(".source-note")).not.toContainText("12 records");
  await expect(
    page.locator(".overview-kpis .metric").first().locator("strong")
  ).toHaveText("—");
  release();
  await expect(
    page.locator(".overview-kpis .metric").first().locator("strong")
  ).toHaveText("1");
  await page.reload();
  await expect(page.getByLabel("Data mode", { exact: true })).toHaveValue(
    "live"
  );
  await expect(page.locator(".demo-note")).toHaveCount(0);
});

test("Live selection keeps demo evidence off when membership has not been provisioned", async ({
  page,
}) => {
  await liveSession(page);
  await page.goto("/#/");
  await page.getByLabel("Data mode", { exact: true }).selectOption("demo");
  await expect(page.locator(".demo-note")).toBeVisible();
  await page.route("**/api/operations/shipments?**", route =>
    route.fulfill({ status: 403, json: { code: "WORKSPACE_REQUIRED" } })
  );
  await page.getByLabel("Data mode", { exact: true }).selectOption("live");
  await expect(page.getByLabel("Data mode", { exact: true })).toHaveValue(
    "live"
  );
  await expect(
    page
      .getByText("Ask your workspace administrator to provision access.", {
        exact: false,
      })
      .first()
  ).toBeVisible();
  await expect(page.locator(".demo-note")).toHaveCount(0);
  await expect(
    page.getByText("Demo dataset · As of", { exact: false })
  ).toHaveCount(0);
  await expect(
    page.locator(".overview-kpis .metric").first().locator("strong")
  ).toHaveText("—");
});
