import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { isolate, loginDemo } from "./helpers";
test.beforeEach(async ({ page }) => {
  await isolate(page);
  await page.emulateMedia({ colorScheme: "light" });
  await loginDemo(page);
});

test("theme icons offer explicit Light, Dark and Auto, persist Auto and follow device changes", async ({
  page,
}) => {
  const group = page.getByRole("radiogroup", { name: "Theme", exact: true });
  const light = group.getByRole("radio", { name: "Light theme", exact: true }),
    dark = group.getByRole("radio", { name: "Dark theme", exact: true }),
    auto = group.getByRole("radio", { name: "Auto theme", exact: true });
  await expect(
    page.getByRole("combobox", { name: "Theme", exact: true })
  ).toHaveCount(0);
  await expect(auto).toBeChecked();
  expect(await auto.evaluate(el => getComputedStyle(el).color)).toBe(
    "rgb(8, 125, 146)"
  );
  await expect(page.locator("html")).toHaveClass("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass("dark");
  await expect(auto).toBeChecked();
  expect(await auto.evaluate(el => getComputedStyle(el).color)).toBe(
    "rgb(94, 211, 228)"
  );
  await expect(dark).not.toBeChecked();
  await light.click();
  await expect(page.locator("html")).toHaveClass("light");
  await expect(light).toBeChecked();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass("light");
  await auto.click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.reload();
  await expect(auto).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
    "system"
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass("light");
  await light.focus();
  await page.keyboard.press("ArrowRight");
  await expect(dark).toBeFocused();
  await page.keyboard.press("Space");
  await expect(dark).toBeChecked();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.goto("/#/settings");
  const preferences = page.getByRole("radiogroup", {
    name: "Appearance theme",
    exact: true,
  });
  await expect(
    preferences.getByRole("radio", { name: "Dark theme" })
  ).toBeChecked();
  await preferences.getByRole("radio", { name: "Auto theme" }).click();
  await expect(auto).toBeChecked();
  await expect(page.locator("html")).toHaveClass("light");
  await page.reload();
  await expect(
    preferences.getByRole("radio", { name: "Auto theme" })
  ).toBeChecked();
  await expect(auto).toBeChecked();
  await mkdir("verification/theme-icons", { recursive: true });
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await expect(page.locator("html")).toHaveClass(theme);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `verification/theme-icons/preferences-${test.info().project.name}-${theme}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
});

test("theme icons fit narrow and tablet headers without clipping or hiding actions", async ({
  page,
}) => {
  for (const width of [360, 390, 768, 820, 901, 1100, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const group = page.getByRole("radiogroup", { name: "Theme", exact: true });
    await expect(
      group.getByRole("radio", { name: "Auto theme" })
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    const boxes = await Promise.all(
      [
        group,
        page.getByLabel("Data mode", { exact: true }),
        page.getByRole("button", { name: "Account menu", exact: true }),
      ].map(l => l.boundingBox())
    );
    for (const box of boxes) {
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  }
});
