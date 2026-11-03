import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { isolate, loginDemo } from "./helpers";
const destinations = [
  ["Overview", "Operational overview"],
  ["Shipments", "Shipments"],
  ["Orders", "Orders"],
  ["Analytics", "Analytics"],
  ["Recommendations", "Recommendations"],
  ["Assistant", "Assistant"],
  ["Service health", "Service health"],
  ["Integrations", "Integrations"],
] as const;
test.beforeEach(async ({ page }) => {
  await isolate(page);
});

test("mobile navigation trigger and all sidebar destinations stay reachable on short, narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await loginDemo(page);
  const menu = page.getByRole("button", {
    name: "Open navigation menu",
    exact: true,
  });
  await expect(menu).toContainText("Menu");
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 667 },
    { width: 667, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(
      await menu.evaluate(el => {
        const box = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2
          )
        );
      })
    ).toBe(true);
    await menu.click();
    const drawer = page.getByRole("dialog", {
      name: "Main navigation",
      exact: true,
    });
    await expect(drawer).toBeVisible();
    const nav = drawer.getByRole("navigation", { name: "Main navigation" });
    if (viewport.height >= 568) {
      const size = await nav.evaluate(el => ({
        scroll: el.scrollHeight,
        client: el.clientHeight,
      }));
      expect(
        size.scroll,
        `All links fit at ${viewport.width}x${viewport.height}`
      ).toBeLessThanOrEqual(size.client);
    }
    await mkdir("verification/mobile-navigation", { recursive: true });
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveClass(theme);
      await drawer.screenshot({
        path: `verification/mobile-navigation/drawer-${test.info().project.name}-${viewport.width}x${viewport.height}-${theme}.png`,
        animations: "disabled",
      });
    }

    for (const [label] of destinations) {
      const link = nav.getByRole("link", { name: label, exact: true });
      await link.scrollIntoViewIfNeeded();
      expect(
        await link.evaluate(el => {
          const box = el.getBoundingClientRect();
          return box.top >= 0 && box.bottom <= innerHeight;
        })
      ).toBe(true);
      expect(
        await link.evaluate(el => {
          const box = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(
              box.x + box.width / 2,
              box.y + box.height / 2
            )
          );
        })
      ).toBe(true);
    }
    await drawer
      .getByRole("link", { name: "Preferences", exact: true })
      .click();
    await expect(drawer).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Preferences", exact: true, level: 1 })
    ).toBeVisible();
  }
});

test("each mobile sidebar destination opens and the page heading clears the sticky header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await loginDemo(page);
  for (const [label, title] of destinations) {
    await page
      .getByRole("button", { name: "Open navigation menu", exact: true })
      .click();
    const drawer = page.getByRole("dialog", {
      name: "Main navigation",
      exact: true,
    });
    await drawer.getByRole("link", { name: label, exact: true }).click();
    await expect(drawer).toBeHidden();
    const heading = page.getByRole("heading", {
      name: title,
      exact: true,
      level: 1,
    });
    await expect(heading).toBeVisible();
    await expect
      .poll(async () => {
        const box = await heading.boundingBox(),
          header = await page.locator(".shell-header").boundingBox();
        return !!box && !!header && box.y >= header.y + header.height;
      })
      .toBe(true);
  }
});

test("mobile navigation restores expanded sections and keeps role permissions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginDemo(page);
  const desktopNav = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await desktopNav
    .getByRole("button", { name: "Supply chain", exact: true })
    .click();
  await expect(
    desktopNav.getByRole("link", { name: "Orders", exact: true })
  ).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 640 });
  await page
    .getByRole("button", { name: "Open navigation menu", exact: true })
    .click();
  let drawer = page.getByRole("dialog", {
    name: "Main navigation",
    exact: true,
  });
  await expect(
    drawer.getByRole("link", { name: "Orders", exact: true })
  ).toBeVisible();
  await expect(
    drawer.getByRole("link", { name: "Integrations", exact: true })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await loginDemo(page, "demo");
  await page
    .getByRole("button", { name: "Open navigation menu", exact: true })
    .click();
  drawer = page.getByRole("dialog", { name: "Main navigation", exact: true });
  for (const label of ["Overview", "Shipments", "Assistant"])
    await expect(
      drawer.getByRole("link", { name: label, exact: true })
    ).toBeVisible();
  for (const label of [
    "Orders",
    "Analytics",
    "Recommendations",
    "Service health",
    "Integrations",
  ])
    await expect(
      drawer.getByRole("link", { name: label, exact: true })
    ).toHaveCount(0);
});
