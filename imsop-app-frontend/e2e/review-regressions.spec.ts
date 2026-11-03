import { expect, test } from "@playwright/test";
import {
  isolate,
  liveSession,
  liveShipment,
  liveOrder,
  loginDemo,
} from "./helpers";

test("order filters are sent to the source before loading the complete matching selection", async ({
  page,
}) => {
  await liveSession(page);
  const reads: URL[] = [];
  await page.route("**/api/operations/orders?**", route => {
    reads.push(new URL(route.request().url()));
    return route.fulfill({ json: { items: [liveOrder], total: 1 } });
  });
  await page.goto("/#/supply-chain/orders");
  await page.getByLabel("Search orders", { exact: true }).fill("101");
  await page.getByLabel("Created from", { exact: true }).fill("2026-10-01");
  await page.getByLabel("Created through", { exact: true }).fill("2026-10-28");
  await expect
    .poll(() =>
      reads.some(
        url =>
          url.searchParams.get("q") === "101" &&
          url.searchParams.get("from") === "2026-10-01" &&
          url.searchParams.get("to") === "2026-10-28"
      )
    )
    .toBe(true);
  await expect(
    page.getByText("1 matching operational orders", { exact: true })
  ).toBeVisible();
});

test("Assistant discards a cached record when an authoritative lookup no longer finds it", async ({
  page,
}) => {
  await liveSession(page);
  await page.goto("/#/insights/assistant");
  await expect(
    page.getByRole("button", { name: "Send", exact: true })
  ).toBeDisabled();
  await page.route("**/api/operations/shipments?**", route => {
    const exact = new URL(route.request().url()).searchParams.has("identifier");
    return route.fulfill({
      json: { items: exact ? [] : [liveShipment], total: exact ? 0 : 1 },
    });
  });
  await page.route("**/api/operations/orders?**", route =>
    route.fulfill({ json: { items: [], total: 0 } })
  );
  await page.getByLabel("Your question").fill("Look up LIVE-TRACK-77");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("log")).toContainText(
    "LIVE-TRACK-77 was not found"
  );
  await expect(page.getByRole("log")).not.toContainText(
    "LIVE-TRACK-77: In transit"
  );
});

test("Assistant does not turn an unavailable source into a zero-record summary", async ({
  page,
}) => {
  await liveSession(page, "admin", 503);
  await page.goto("/#/insights/assistant");
  await expect(
    page.getByText("A source is unavailable.", { exact: false })
  ).toBeVisible();
  await page.getByLabel("Your question").fill("Summarize shipments");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("log")).toContainText(
    "The shipment source is unavailable"
  );
  await expect(page.getByRole("log")).not.toContainText("0 shipments");
});

const uuid = (n: number) =>
  `${n.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
test("purchasing reaches older orders and catalog options after the first 100", async ({
  page,
}) => {
  await liveSession(page);
  const suppliers = Array.from({ length: 101 }, (_, n) => ({
    id: uuid(n + 1),
    name: `Supplier ${n + 1}`,
    status: "active",
  }));
  const products = Array.from({ length: 101 }, (_, n) => ({
    id: uuid(n + 201),
    name: `Product ${n + 1}`,
    sku: `PART-${n + 1}`,
    unitPrice: "1.0000",
  }));
  const warehouses = [{ id: uuid(1001), name: "Warehouse" }];
  const orders = Array.from({ length: 51 }, (_, n) => ({
    id: uuid(n + 2001),
    orderNumber: `PURCHASE-${n + 1}`,
    supplierId: suppliers[0].id,
    totalAmount: "1.0000",
    currency: "EUR",
    status: "draft",
    dispatchState: "disabled",
  }));
  await page.route("**/supply-chain/api/v1/orders**", route => {
    const url = new URL(route.request().url()),
      offset = Number(url.searchParams.get("offset") || 0),
      kind = url.pathname.split("/").pop();
    const rows =
      kind === "suppliers"
        ? suppliers
        : kind === "products"
          ? products
          : kind === "warehouses"
            ? warehouses
            : orders;
    const limit = kind === "orders" ? 50 : 100;
    return route.fulfill({
      json: {
        items: rows.slice(offset, offset + limit),
        offset,
        limit,
        total: rows.length,
      },
    });
  });
  await page.goto("/#/supply-chain/orders");
  await expect(page.getByText("Page 1 of 2 · 51 purchases")).toBeVisible();
  await page
    .getByRole("button", { name: "Next purchases", exact: true })
    .click();
  await expect(page.getByText("PURCHASE-51", { exact: true })).toBeVisible();
  await expect(page.getByText("Page 2 of 2 · 51 purchases")).toBeVisible();
  await page.getByText("Create purchase order", { exact: true }).click();
  await expect(
    page.getByLabel("Purchase supplier").locator("option")
  ).toHaveCount(102);
  await expect(
    page.getByLabel("Product", { exact: true }).locator("option")
  ).toHaveCount(102);
  await page.getByLabel("Purchase supplier").selectOption(suppliers[100].id);
  await page
    .getByLabel("Product", { exact: true })
    .selectOption(products[100].id);
  await expect(page.getByLabel("Unit price from source")).toHaveValue("1.0000");
});

test("opening another review cancels previous history and never shows it under the new case", async ({
  page,
}) => {
  await liveSession(page);
  const reviews = [1, 2].map(id => ({
    id,
    shipmentId: id,
    trackingNumber: `CASE-${id}`,
    state: "open",
    version: 0,
    assigneeId: null,
    updatedAt: "2026-10-28T08:00:00Z",
  }));
  await page.route("**/api/operations/reviews?**", r =>
    r.fulfill({ json: { items: reviews } })
  );
  await page.route("**/api/operations/reviews/operators", r =>
    r.fulfill({ json: { items: [] } })
  );
  let release = () => {};
  const held = new Promise<void>(r => (release = r));
  await page.route("**/api/operations/reviews/1/actions", async r => {
    await held;
    await r
      .fulfill({
        json: {
          items: [
            {
              id: 1,
              action: "note",
              actorName: "Operator",
              note: "Old case private note",
              occurredAt: "2026-10-28T08:00:00Z",
            },
          ],
        },
      })
      .catch(() => {});
  });
  await page.route("**/api/operations/reviews/2/actions", r =>
    r.fulfill({
      json: {
        items: [
          {
            id: 2,
            action: "note",
            actorName: "Operator",
            note: "Current case note",
            occurredAt: "2026-10-28T08:00:00Z",
          },
        ],
      },
    })
  );
  await page.goto("/#/insights/recommendations");
  await page
    .getByRole("button", { name: "Review case", exact: true })
    .nth(0)
    .click();
  await page
    .getByRole("button", { name: "Review case", exact: true })
    .nth(1)
    .click();
  await expect(
    page.getByRole("region", { name: "Review CASE-2" })
  ).toContainText("Current case note");
  release();
  await expect(
    page.getByRole("region", { name: "Review CASE-2" })
  ).not.toContainText("Old case private note");
});

test("signing out clears the workspace in another open tab", async ({
  page,
  context,
}) => {
  await isolate(page);
  await loginDemo(page);
  const other = await context.newPage();
  await isolate(other);
  await other.goto("/#/");
  await expect(
    other.getByRole("heading", { name: "Operational overview" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(
    other.getByRole("heading", { name: "Welcome to IMSOP" })
  ).toBeVisible();
  await other.close();
});

test("a malformed persisted demo session returns to sign-in", async ({
  page,
}) => {
  await isolate(page);
  await page.addInitScript(() => {
    localStorage.setItem("imsop_token", "mock_broken");
    localStorage.setItem("imsop_session", "{");
  });
  await page.goto("/#/");
  await expect(
    page.getByRole("heading", { name: "Welcome to IMSOP" })
  ).toBeVisible();
});

test("moving between shipment and order filters with the same query reloads the correct source", async ({
  page,
}) => {
  await liveSession(page);
  const reads: URL[] = [];
  await page.route("**/api/operations/orders?**", route => {
    reads.push(new URL(route.request().url()));
    return route.fulfill({ json: { items: [liveOrder], total: 1 } });
  });
  await page.goto("/#/supply-chain/shipments?q=101");
  await expect.poll(() => reads.length).toBeGreaterThan(0);
  const initial = reads.length;
  await page.evaluate(() => {
    window.location.hash = "/supply-chain/orders?q=101";
  });
  await expect
    .poll(() =>
      reads.slice(initial).some(url => url.searchParams.get("q") === "101")
    )
    .toBe(true);
  await expect(
    page.getByText("1 matching operational orders", { exact: true })
  ).toBeVisible();
});
