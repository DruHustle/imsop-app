import { expect, test } from "@playwright/test";
import { liveSession, liveShipment } from "./helpers";
import path from "node:path";
import { mkdir } from "node:fs/promises";
for (const state of ["populated", "empty", "loading", "error"] as const)
  for (const theme of ["light", "dark"] as const)
    test(`visual ${state} ${theme} responsive verification`, async ({
      page,
    }, info) => {
      await liveSession(
        page,
        "admin",
        state === "error" ? 503 : 200,
        state === "empty"
          ? []
          : [
              {
                ...liveShipment,
                origin:
                  "Frankfurt distribution and consolidation centre with a deliberately long facility label, Germany",
                carrier:
                  "International regional road freight and distribution partner",
              },
            ]
      );
      let release: () => void = () => {};
      if (state === "loading") {
        const hold = new Promise<void>(r => (release = r));
        await page.route("**/api/operations/shipments?**", async r => {
          await hold;
          await r
            .fulfill({ json: { items: [liveShipment], total: 1 } })
            .catch(() => {});
        });
      }
      await page.addInitScript(
        theme => localStorage.setItem("theme", theme),
        theme
      );
      await page.goto("/#/supply-chain/shipments");
      const expected =
        state === "populated"
          ? page
              .getByRole("link", { name: "LIVE-TRACK-77", exact: true })
              .filter({ visible: true })
          : state === "loading"
            ? page.getByText("Loading authorized records…")
            : page.getByRole("heading", {
                name:
                  state === "empty"
                    ? "No records in this source"
                    : "Source unavailable",
                exact: true,
              });
      await expect(expected).toBeVisible();
      const widths =
        info.project.name === "chromium" ? [1280, 820, 768] : [390, 360];
      const dir = path.resolve("verification/remediation/screenshots");
      await mkdir(dir, { recursive: true });
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await expect(
          page.getByRole("heading", { name: "Shipments", exact: true })
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth
          )
        ).toBe(true);
        expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
        await page.screenshot({
          path: path.join(dir, `${state}-${width}-${theme}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
      release();
    });

// Audit all secondary workspaces in both effective themes, with real records in Demo.
for (const theme of ["light", "dark"] as const)
  test(`visual secondary workspaces ${theme}`, async ({ page }, info) => {
    const { isolate, loginDemo } = await import("./helpers");
    await isolate(page);
    await page.addInitScript(
      theme => localStorage.setItem("theme", theme),
      theme
    );
    await loginDemo(page);
    const width = info.project.name === "chromium" ? 1280 : 390;
    await page.setViewportSize({ width, height: 900 });
    const pages = [
      ["/", "Operational overview", "overview"],
      ["/supply-chain/shipments/2", "SHP-9921", "detail"],
      ["/supply-chain/orders", "Orders", "orders"],
      ["/insights/analytics", "Analytics", "analytics"],
      [
        "/insights/recommendations",
        "Recommendations",
        "recommendations",
      ],
      ["/insights/assistant", "Assistant", "assistant"],
      ["/infrastructure/health", "Service health", "health"],
      ["/infrastructure/integrations", "Integrations", "integrations"],
      ["/settings", "Preferences", "preferences"],
      ["/profile", "Profile", "profile"],
    ];
    const dir = path.resolve("verification/remediation/screenshots");
    await mkdir(dir, { recursive: true });
    for (const [route, title, file] of pages) {
      await page.goto("/#" + route);
      await expect(
        page.getByRole("heading", { name: title, exact: true, level: 1 })
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true);
      expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
      if (file === "assistant") {
        await page.getByLabel("Your question").fill("Look up SHP-8829");
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await expect(page.getByRole("log")).toContainText(
          "SHP-8829: In transit"
        );
      }
      await page.screenshot({
        path: path.join(dir, `${file}-${width}-${theme}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
  });
