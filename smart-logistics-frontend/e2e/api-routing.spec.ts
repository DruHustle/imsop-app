import { expect, test } from "@playwright/test";
import { liveSession, liveShipment, liveOrder, navigate } from "./helpers";
test("live requests use the session origin, bounded queries and cookie credentials", async ({
  page,
  context,
  baseURL,
}) => {
  await liveSession(page);
  await context.addCookies([
    { name: "routing_fixture", value: "test", url: baseURL!, httpOnly: true },
  ]);
  const requests: { url: string; cookie: string }[] = [];
  page.on("request", async request => {
    if (request.url().includes("/api/"))
      requests.push({
        url: request.url(),
        cookie: (await request.allHeaders()).cookie ?? "",
      });
  });
  await page.goto("/#/operations");
  await expect(
    page.getByText("Live · Workspace records", {
      exact: false,
    })
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: "LIVE-TRACK-77", exact: true })
      .filter({ visible: true })
  ).toBeVisible();
  expect(requests.some(r => r.url.endsWith("/api/auth/me"))).toBe(true);
  expect(
    requests.some(r =>
      r.url.endsWith("/api/operations/shipments?limit=500&offset=0")
    )
  ).toBe(true);
  for (const request of requests) {
    expect(new URL(request.url).origin).toBe(new URL(baseURL!).origin);
    expect(request.cookie).toContain("routing_fixture=test");
  }
  await expect(page.getByText("SHP-8829", { exact: true })).toBeHidden();
});
for (const status of [403, 503])
  test(`live ${status} sources never fall back to demo`, async ({ page }) => {
    await liveSession(page, "admin", status);
    await page.goto("/#/operations");
    await expect(
      page.getByRole("heading", {
        name: status === 403 ? "Access denied" : "Source unavailable",
        exact: true,
      })
    ).toBeVisible();
    await expect(page.getByText("SHP-8829", { exact: true })).toBeHidden();
    if (status === 503) {
      await page.route("**/api/operations/shipments?**", r =>
        r.fulfill({ json: { items: [liveShipment], total: 1 } })
      );
      await page.getByRole("button", { name: "Retry read" }).click();
      await expect(
        page
          .getByRole("link", { name: "LIVE-TRACK-77", exact: true })
          .filter({ visible: true })
      ).toBeVisible();
    }
  });
test("empty live source preserves zero and differs from no matching results", async ({
  page,
}) => {
  await liveSession(page, "admin", 200, []);
  await page.goto("/#/operations");
  await expect(
    page.getByRole("heading", { name: "No records in this source" })
  ).toBeVisible();
  await expect(page.getByText("0 matching · 0 need attention")).toBeVisible();
  await expect(page.getByText("SHP-8829", { exact: true })).toBeHidden();
});
test("slow live sources start loading and obsolete reads cannot replace Demo data", async ({
  page,
}) => {
  await liveSession(page);
  let release: () => void = () => {};
  let requested: () => void = () => {};
  const held = new Promise<void>(r => (release = r));
  const started = new Promise<void>(r => (requested = r));
  await page.route("**/api/operations/shipments?**", async r => {
    requested();
    await held;
    await r
      .fulfill({ json: { items: [liveShipment], total: 1 } })
      .catch(() => {});
  });
  await page.goto("/#/operations");
  await started;
  await expect(page.getByText("Loading authorized records…")).toBeVisible();
  await expect(page.getByText("SHP-8829", { exact: true })).toBeHidden();
  await page.getByLabel("Data mode", { exact: true }).selectOption("demo");
  await expect(page.getByText("12 matching · 2 need attention")).toBeVisible();
  release();
  await expect(page.getByText("LIVE-TRACK-77", { exact: true })).toBeHidden();
  await navigate(page, "Assistant");
  await expect(
    page.getByText("Demo dataset · As of", { exact: false })
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Data mode", { exact: true })).toHaveValue(
    "demo"
  );
});
test("live details preserve stable IDs, provenance, stale observation and missing associations", async ({
  page,
}) => {
  await liveSession(page);
  await page.goto("/#/supply-chain/shipments/77");
  await expect(
    page.getByRole("heading", { name: "LIVE-TRACK-77" })
  ).toBeVisible();
  await expect(
    page.getByText("Stale · Observed", { exact: false })
  ).toBeVisible();
  await expect(
    page.getByText(
      "This shipment contract has no authorized order or document association."
    )
  ).toBeVisible();
  await page.getByRole("link", { name: "Tracking / events" }).click();
  await expect(page.getByText("Provider: Isolated test feed")).toBeVisible();
  await expect(
    page.getByText("Occurred: Oct 24, 2026, 6:00 AM UTC")
  ).toBeVisible();
  await page.goto("/#/supply-chain/orders/101");
  await expect(
    page.getByRole("heading", { name: "ORD-LIVE-101" })
  ).toBeVisible();
  await expect(page.getByText("0.00 · Currency unknown")).toBeVisible();
  await expect(page.getByText("node.orders · Numeric ID 101")).toBeVisible();
});
test("live assistant uses permitted records and infrastructure remains honestly scoped", async ({
  page,
}) => {
  await liveSession(page);
  await page.goto("/#/assistant");
  await page.getByLabel("Your question").fill("Look up LIVE-TRACK-77");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("log")).toContainText(
    "LIVE-TRACK-77: In transit"
  );
  await expect(page.getByRole("log")).not.toContainText(
    "Demonstration response"
  );
  await navigate(page, "Recommendations");
  await expect(
    page.getByText("Forecast evidence", { exact: true }).first()
  ).toBeVisible();
  await navigate(page, "Service health");
  await expect(page.getByText("Degraded", { exact: true })).toBeVisible();
  await expect(page.getByRole("table").getByText("Unavailable", { exact: true })).toBeVisible();
  await page.getByLabel("Data mode", { exact: true }).selectOption("demo");
  await expect(
    page.getByRole("table").getByText("Demo API process", { exact: true })
  ).toBeVisible();
  await page.getByLabel("Data mode", { exact: true }).selectOption("live");
  await expect(
    page.getByRole("table").getByText("API process liveness", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("table").getByText("Demo API process", { exact: true })
  ).toBeHidden();
  await navigate(page, "Integrations");
  await expect(
    page.getByRole("heading", { name: "Carrier webhooks" })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(
    page.getByText(
      "In-app review notifications · Email preferences in Preferences"
    )
  ).toBeVisible();
});
test("client report export requires the backend report permission check", async ({
  page,
}) => {
  await liveSession(page);
  await page.route("**/api/operations/reports/access", r =>
    r.fulfill({ status: 403, json: { error: "Forbidden" } })
  );
  await page.goto("/#/operations");
  await page.getByRole("button", { name: "CSV · filtered" }).click();
  await expect(
    page.getByText("You do not have permission to read this source.")
  ).toBeVisible();
});
for (const role of ["engineer", "user"])
  test(`${role} has no report bypass and standard users retain Assistant`, async ({
    page,
  }) => {
    await liveSession(page, role);
    await page.goto("/#/operations");
    await expect(
      page.getByRole("button", { name: "CSV · filtered" })
    ).toBeHidden();
    await navigate(page, "Assistant");
    await expect(
      page.getByRole("heading", { name: "Assistant", exact: true })
    ).toBeVisible();
    if (role === "user") {
      await page.goto("/#/supply-chain/orders/101");
      await expect(
        page.getByRole("heading", { name: "Access denied", exact: true })
      ).toBeVisible();
    }
  });

test("configured map markers synchronize with filters, omit missing coordinates and open details", async ({
  page,
}) => {
  await liveSession(page, "admin", 200, [
    liveShipment,
    {
      ...liveShipment,
      id: 78,
      trackingNumber: "LIVE-TRACK-78",
      latitude: "10",
      longitude: "20",
    },
    {
      ...liveShipment,
      id: 79,
      trackingNumber: "LIVE-NO-POSITION",
      latitude: null,
      longitude: null,
    },
  ]);
  // Local SDK double: no provider network requests or account credentials.
  await page.addInitScript(() => {
    class LocalMap {
      constructor(public element: HTMLElement) {}
      fitBounds() {}
      setOptions() {}
    }
    class LocalMarker {
      element: HTMLButtonElement;
      listeners: { name: string; callback: EventListener }[] = [];
      constructor(options: { map: LocalMap; title: string }) {
        this.element = document.createElement("button");
        this.element.textContent = options.title;
        this.element.dataset.fixtureMarker = "true";
        options.map.element.append(this.element);
      }
      addListener(name: string, callback: EventListener) {
        this.listeners.push({ name, callback });
        this.element.addEventListener(name, callback);
      }
      setMap(value: unknown) {
        if (value === null) this.element.remove();
      }
    }
    (window as any).google = {
      maps: {
        Map: LocalMap,
        Marker: LocalMarker,
        LatLngBounds: class {
          extend() {}
        },
        event: {
          clearInstanceListeners(target: any) {
            target.listeners?.forEach((l: any) =>
              target.element.removeEventListener(l.name, l.callback)
            );
          },
        },
      },
    };
  });
  await page.goto("/#/supply-chain/shipments");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.locator("[data-fixture-marker]")).toHaveCount(2);
  await page
    .getByLabel("Search shipments", { exact: true })
    .fill("LIVE-TRACK-77");
  await expect(page.locator("[data-fixture-marker]")).toHaveCount(1);
  await expect(page.getByText("LIVE-TRACK-78", { exact: true })).toBeHidden();
  await page
    .getByRole("button", { name: "LIVE-TRACK-77 · In transit", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "LIVE-TRACK-77", exact: true })
  ).toBeVisible();
});
