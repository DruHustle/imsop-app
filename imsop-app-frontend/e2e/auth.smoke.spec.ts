import { expect, test } from "@playwright/test";
import { isolate, loginDemo, navigate } from "./helpers";
test.beforeEach(async ({ page }) => isolate(page));
test("auth links and reset token handling survive the shell redesign", async ({
  page,
}) => {
  await page.goto("/#/login");
  await expect(
    page.getByRole("heading", { name: "Welcome to IMSOP" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/#\/forgot-password/);
  await page.goto("/?token=synthetic.reset.token#/reset-password");
  await expect(page.getByLabel("New Password", { exact: true })).toBeVisible();
  await page.goto("/#/register");
  await expect(
    page.getByText("Create an Account", { exact: true })
  ).toBeVisible();
  await page.getByRole("link", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/#\/login/);
});
test("pointer navigation opens the shipment workspace and drawer closes", async ({
  page,
}) => {
  await loginDemo(page);
  await navigate(page, "Shipments");
  await expect(
    page.getByRole("heading", { name: "Shipments", exact: true })
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/supply-chain\/shipments/);
});
