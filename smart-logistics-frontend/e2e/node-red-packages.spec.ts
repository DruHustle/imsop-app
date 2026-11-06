import { test, expect, type Page } from "@playwright/test";
import { isolate, liveSession, loginDemo } from "./helpers";
const target = {
  id: "8d70df1b-5722-4e7f-8dfc-e90cfa875a77",
  gatewayId: "warehouse-fixture",
  label: "Synthetic warehouse gateway",
  version: "4.1.4",
  revision: "a".repeat(64),
};
const path = "/api/edge/node-red/warehouse-fixture";
const review = {
  module: "@fixture/node-red-test",
  version: "1.2.3",
  target,
  description: "Synthetic warehouse adapter",
  nodeSets: ["warehouse-sensor"],
  pluginSets: [],
  reviewToken: "synthetic-signed-review",
  expiresAt: "2099-01-01T00:00:00.000Z",
};
const operation = {
  id: "4f1fa60c-7679-4f00-9cfb-e9d779fe6b22",
  runtimeId: target.id,
  gatewayId: target.gatewayId,
  workspaceId: "f1e65463-ce23-4803-a2e4-3f4e1daa5b56",
  targetRevision: target.revision,
  actorId: 7,
  module: review.module,
  version: review.version,
  state: "unconfirmed",
  message: "The installation response was lost. Its outcome is unconfirmed.",
  startedAt: "2026-11-06T00:00:00.000Z",
  updatedAt: "2026-11-06T00:00:00.000Z",
};
async function enrolled(page: Page) {
  await liveSession(page);
  await page.route("**/version", route =>
    route.fulfill({
      json: { capabilities: ["node-red-package-management-v1"] },
    })
  );
  await page.route("**/api/edge/node-red", route =>
    route.fulfill({
      json: {
        state: "ready",
        message: "Choose an enrolled gateway in this workspace.",
        targets: [target],
      },
    })
  );
}

test("review, explicit acknowledgement and double-click submit produce one request; uncertainty survives reload and only read-back confirms it", async ({
  page,
}) => {
  await enrolled(page);
  let installs = 0,
    reviews = 0,
    reconciles = 0,
    saved: typeof operation | null = null;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**" + path + "/status", route =>
    route.fulfill({
      json: {
        state: "ready",
        message: "Connected to the enrolled Node-RED runtime.",
        target,
        operation: saved,
        packages:
          saved?.state === "installed"
            ? [
                {
                  name: review.module,
                  version: review.version,
                  nodeSets: 1,
                  pluginSets: 0,
                  loadError: false,
                  pendingVersion: null,
                },
              ]
            : [],
      },
    })
  );
  await page.route("**" + path + "/review", route => {
    reviews++;
    expect(route.request().postDataJSON()).toEqual({
      module: review.module,
      version: review.version,
    });
    return route.fulfill({ json: review });
  });
  await page.route("**" + path + "/install", async route => {
    installs++;
    const body = route.request().postDataJSON();
    expect(Object.keys(body).sort()).toEqual([
      "acknowledgeCodeExecution",
      "requestId",
      "reviewToken",
    ]);
    expect(body.acknowledgeCodeExecution).toBe(true);
    expect(body.reviewToken).toBe(review.reviewToken);
    expect(body.requestId).toMatch(/^[a-f0-9-]{36}$/);
    saved = { ...operation, id: body.requestId };
    // Simulate a successful durable acceptance whose HTTP acknowledgement is lost.
    await route.abort("connectionfailed");
  });
  await page.route("**" + path + "/reconcile", route => {
    reconciles++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({});
    saved = {
      ...saved!,
      state: "installed",
      message: "Read-back confirmed the exact package version is present.",
    };
    return route.fulfill({ json: saved });
  });
  await page.goto("/#/settings");
  await expect(
    page.getByRole("heading", { name: "Node-RED packages", exact: true })
  ).toBeVisible();
  await page.getByLabel("Package name", { exact: true }).fill(review.module);
  await page.getByLabel("Exact version", { exact: true }).fill(review.version);
  await page.getByRole("button", { name: "Review exact version" }).click();
  await expect(
    page.getByRole("region", { name: "Reviewed Node-RED package" })
  ).toContainText("warehouse-sensor");
  const install = page.getByRole("button", {
    name: "Install reviewed package",
  });
  await expect(install).toBeDisabled();
  expect(installs).toBe(0);
  await page
    .getByRole("checkbox", {
      name: /I reviewed this package and exact version/,
    })
    .check();
  await install.evaluate(button => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(
    page.getByRole("button", { name: "Review exact version" })
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Refresh the saved status before requesting another installation.",
      { exact: false }
    )
  ).toBeVisible();
  expect(installs).toBe(1);
  expect(reviews).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Saved Node-RED operation" })
  ).toContainText("unconfirmed");
  await expect(
    page.getByRole("button", { name: "Review exact version" })
  ).toBeDisabled();
  expect(installs).toBe(1);
  expect(reconciles).toBe(0);
  await page.getByRole("button", { name: "Check saved outcome" }).click();
  await expect(
    page.getByRole("region", { name: "Saved Node-RED operation" })
  ).toContainText("Read-back confirmed");
  await expect(
    page.getByRole("list", { name: "Installed package inventory" })
  ).toContainText(review.module);
  expect(installs).toBe(1);
  expect(reconciles).toBe(1);
  expect(errors).toEqual([]);
});

test("older backends receive no optional management requests", async ({
  page,
}) => {
  await liveSession(page);
  let calls = 0;
  await page.route("**/version", route =>
    route.fulfill({ json: { capabilities: ["immutable-mail-v1"] } })
  );
  await page.route("**/api/edge/node-red**", route => {
    calls++;
    return route.fulfill({ status: 500 });
  });
  await page.goto("/#/settings");
  await expect(
    page.getByRole("heading", { name: "Preferences", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Node-RED packages", exact: true })
  ).toHaveCount(0);
  // A regular page action also flushes any pending effect without arbitrary sleeps.
  await page.getByLabel("Reduced motion", { exact: true }).click();
  expect(calls).toBe(0);
});
for (const mode of ["demo", "non-admin"] as const)
  test(`${mode} never requests Node-RED management`, async ({ page }) => {
    if (mode === "demo") {
      await isolate(page);
      await loginDemo(page, "admin");
    } else await liveSession(page, "engineer");
    let calls = 0;
    await page.route("**/api/edge/node-red**", route => {
      calls++;
      return route.fulfill({ status: 500 });
    });
    await page.route("**/version", route =>
      route.fulfill({
        json: { capabilities: ["node-red-package-management-v1"] },
      })
    );
    await page.goto("/#/settings");
    await expect(
      page.getByRole("heading", { name: "Preferences", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Node-RED packages", exact: true })
    ).toHaveCount(0);
    await page.getByLabel("Reduced motion", { exact: true }).click();
    expect(calls).toBe(0);
  });
