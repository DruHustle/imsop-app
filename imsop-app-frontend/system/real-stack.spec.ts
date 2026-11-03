import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync("/tmp/imsop-browser-fixture.json", "utf8")
);
const password = "Isolated-test-password-123";
async function login(page: any) {
  await page.goto("/#/login");
  await page.getByLabel("Email", { exact: true }).fill(fixture.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Operational overview" })
  ).toBeVisible();
}
test("real signed intake, persisted review actions, reload, notifications and exact Assistant context", async ({
  page,
}) => {
  await login(page);
  await page.goto("/#/supply-chain/shipments");
  await expect(
    page
      .getByRole("link", { name: "SYSTEM-SHP-10", exact: true })
      .filter({ visible: true })
  ).toBeVisible();
  await page.goto("/#/insights/recommendations");
  await expect(
    page.getByRole("heading", { name: "Exception review", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Review case", exact: true }).click();
  await page
    .getByLabel("Review note", { exact: true })
    .fill(
      "Reviewed arrival evidence; follow-up assigned in isolated verification."
    );
  expect(
    (
      await Promise.all([
        page.waitForResponse(
          r => r.url().includes("/actions") && r.request().method() === "POST"
        ),
        page.getByRole("button", { name: "Acknowledge", exact: true }).click(),
      ])
    )[0].status()
  ).toBe(200);
  await expect(
    page.getByRole("region", { name: "Review SYSTEM-SHP-10", exact: true })
  ).toBeHidden();
  await page.reload();
  await page.getByRole("button", { name: "Review case", exact: true }).click();
  await expect(page.getByText(/acknowledge ·/)).toBeVisible();
  expect(
    (
      await Promise.all([
        page.waitForResponse(
          r => r.url().includes("/actions") && r.request().method() === "POST"
        ),
        page
          .getByLabel("Assign to", { exact: true })
          .selectOption(String(fixture.userId)),
      ])
    )[0].status()
  ).toBe(200);
  await expect(
    page.getByRole("region", { name: "Review SYSTEM-SHP-10", exact: true })
  ).toBeHidden();
  await page.getByRole("button", { name: "Review case", exact: true }).click();
  await page
    .getByLabel("Review note", { exact: true })
    .fill("Follow-up completed; carrier status remains delayed.");
  expect(
    (
      await Promise.all([
        page.waitForResponse(
          r => r.url().includes("/actions") && r.request().method() === "POST"
        ),
        page.getByRole("button", { name: "Save note", exact: true }).click(),
      ])
    )[0].status()
  ).toBe(200);
  await expect(
    page.getByRole("region", { name: "Review SYSTEM-SHP-10", exact: true })
  ).toBeHidden();
  await page.getByRole("button", { name: "Review case", exact: true }).click();
  expect(
    (
      await Promise.all([
        page.waitForResponse(
          r => r.url().includes("/actions") && r.request().method() === "POST"
        ),
        page
          .getByRole("button", { name: "Resolve review", exact: true })
          .click(),
      ])
    )[0].status()
  ).toBe(200);
  await expect(
    page.getByRole("region", { name: "Review SYSTEM-SHP-10", exact: true })
  ).toBeHidden();
  await page.reload();
  await expect(page.getByText("resolved", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(
    page.getByText(
      "In-app review notifications · Email preferences in Preferences"
    )
  ).toBeVisible();
  const notifications = page.locator('[data-slot="popover-content"]');
  await expect(notifications.getByRole("article").first()).toContainText(
    "Unread ·"
  );
  const [readResponse] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes("/read") && r.request().method() === "POST"
    ),
    notifications
      .getByRole("button", { name: "Mark read", exact: true })
      .first()
      .click(),
  ]);
  expect(readResponse.status()).toBe(200);
  await expect(notifications.getByRole("article").first()).not.toContainText(
    "Unread ·"
  );
  await page.keyboard.press("Escape");
  await expect(notifications).toBeHidden();
  await page.reload();
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(notifications.getByRole("article").first()).not.toContainText(
    "Unread ·"
  );
  await page.keyboard.press("Escape");
  await expect(notifications).toBeHidden();
  await page.screenshot({
    path: "verification/remediation/review-desktop.png",
    fullPage: true,
  });
  await page.goto(
    `/#/insights/assistant?item=shipment:${fixture.shipmentId}&q=${encodeURIComponent("Compare SYSTEM-SHP-10 and SYSTEM-SHP-1")}`
  );
  await expect(page.getByRole("log")).not.toContainText("SYSTEM-SHP-10:");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("SYSTEM-SHP-10: Delayed");
  await expect(page.getByRole("log")).toContainText(
    "SYSTEM-SHP-1 was not found"
  );
  await expect(page.getByRole("log")).toContainText("mode: Parcel");
  await expect(
    page
      .getByRole("log")
      .getByRole("link", { name: "Search shipments ↗", exact: true })
  ).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "verification/remediation/assistant-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
});
test("exact backend mail link works during demo identity, is scrubbed, survives retry, and cannot replay", async ({
  page,
  request,
}) => {
  const baseline = (
    await (await request.get("http://127.0.0.1:18027/messages")).json()
  ).length;
  const response = await request.post(
    "http://127.0.0.1:18067/api/auth/request-reset",
    {
      data: { email: fixture.email },
      headers: { "x-forwarded-for": "192.0.2.230" },
    }
  );
  expect(response.status()).toBe(202);
  let link = "";
  await expect
    .poll(
      async () => {
        const messages = await (
          await request.get("http://127.0.0.1:18027/messages")
        ).json();
        const mail = messages
          .slice(baseline)
          .find(
            (m: any) =>
              m.text.includes(fixture.email) &&
              m.text.includes("Subject: Reset your IMSOP password")
          );
        if (mail)
          link =
            mail.text
              .replace(/=\n/g, "")
              .replace(/=3D/g, "=")
              .match(/http:\/\/127\.0\.0\.1:4189\/[^\s<>]+/)?.[0] || "";
        return !!link;
      },
      { timeout: 20000 }
    )
    .toBe(true);
  await page.goto("/#/login");
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Operational overview" })
  ).toBeVisible();
  await page.goto(link);
  await expect(page.getByLabel("New Password", { exact: true })).toBeVisible();
  expect(page.url()).not.toContain("token=");
  await page.getByLabel("New Password", { exact: true }).fill("short12");
  await page.getByLabel("Confirm Password", { exact: true }).fill("short12");
  await page
    .getByRole("button", { name: "Reset Password", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reset Password", exact: true })
  ).toBeVisible();
  await page
    .getByLabel("New Password", { exact: true })
    .fill("Browser-new-password-123");
  await page
    .getByLabel("Confirm Password", { exact: true })
    .fill("Browser-new-password-123");
  await page.context().setOffline(true);
  await page
    .getByRole("button", { name: "Reset Password", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.context().setOffline(false);
  await page
    .getByRole("button", { name: "Reset Password", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Password Reset!" })
  ).toBeVisible();
  await page.screenshot({
    path: "verification/remediation/recovery-success.png",
    fullPage: true,
  });
  await page.goto(link);
  await page
    .getByLabel("New Password", { exact: true })
    .fill("Browser-new-password-456");
  await page
    .getByLabel("Confirm Password", { exact: true })
    .fill("Browser-new-password-456");
  await page
    .getByRole("button", { name: "Reset Password", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "invalid, expired or already used" })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Invalid Link", exact: true })
  ).toBeVisible();
});

test("actual browser loads beyond 500, finds the old delayed record and exports the same authorized filter", async ({
  page,
}) => {
  const scale = JSON.parse(
      readFileSync("/tmp/imsop-scale-fixture.json", "utf8")
    ),
    reads: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/api/operations/shipments?"))
      reads.push(new URL(request.url()).search);
  });
  await page.goto("/#/login");
  await page.getByLabel("Email", { exact: true }).fill(scale.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Scale-test-password-123");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Operational overview" })
  ).toBeVisible();
  await page.goto("/#/supply-chain/shipments");
  await expect(
    page.getByText("620 matching · 1 need attention", { exact: true })
  ).toBeVisible();
  expect(reads.some(q => q.includes("cursor="))).toBe(true);
  await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes("/api/operations/shipments?") &&
        response.url().includes("q=LARGE-0001") &&
        response.status() === 200
    ),
    page
      .getByRole("searchbox", { name: "Search shipments" })
      .fill("LARGE-0001"),
  ]);
  await expect(
    page.getByText("1 matching · 1 need attention", { exact: true })
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: "LARGE-0001", exact: true })
      .filter({ visible: true })
  ).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "CSV · filtered", exact: true }).click(),
  ]);
  const fs = await import("node:fs/promises");
  const csv = await fs.readFile((await download.path())!, "utf8");
  expect(csv).toContain("LARGE-0001");
  expect(csv).not.toContain("LARGE-0620");
  expect(csv).toContain("LIVE");
  expect(csv).toContain("Node operational database");
  expect(csv).toContain("Generated");
  await page.screenshot({
    path: "verification/remediation/real-scale-filter.png",
    fullPage: true,
  });
  const measurement = await page.evaluate(() => {
    const nav = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming;
    return {
      domContentLoadedMs: nav.domContentLoadedEventEnd,
      loadMs: nav.loadEventEnd,
      sourceReads: performance
        .getEntriesByType("resource")
        .filter(entry => entry.name.includes("/api/operations/shipments?"))
        .map(entry => ({ durationMs: entry.duration })),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  await fs.writeFile(
    "verification/remediation/real-browser-performance.json",
    JSON.stringify(
      {
        environment: "local isolated real gateway/PostgreSQL",
        selectionRecords: 620,
        filterRecords: 1,
        ...measurement,
      },
      null,
      2
    )
  );
  expect(measurement.overflow).toBe(false);
});
