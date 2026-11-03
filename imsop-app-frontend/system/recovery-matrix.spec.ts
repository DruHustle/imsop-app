import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
const backend = path.resolve("../imsop-app-backend");
for (const identity of ["signed out", "live", "demo"])
  for (const shape of ["emitted", "legacy"])
    test(`real recovery: ${identity}, ${shape} link`, async ({
      page,
      request,
    }) => {
      // A fresh process window preserves the actual 10-request production limiter for each isolated scenario.
      execFileSync(
        "docker",
        ["compose", "-f", "server/system/compose.yaml", "restart", "backend"],
        { cwd: backend, stdio: "pipe" }
      );
      await expect
        .poll(
          async () => {
            try {
              return (await request.get("http://127.0.0.1:18067/ready")).ok();
            } catch {
              return false;
            }
          },
          { timeout: 30000 }
        )
        .toBe(true);
      const email = randomUUID() + "@imsop.test",
        password = "Matrix-isolated-password-123";
      expect(
        (
          await request.post("http://127.0.0.1:18067/api/auth/register", {
            headers: { Origin: "http://127.0.0.1:4189" },
            data: { email, password, name: "Recovery Verification" },
          })
        ).status()
      ).toBe(201);
      if (identity === "live") {
        await page.goto("/#/login");
        await page.getByLabel("Email", { exact: true }).fill(email);
        await page.getByLabel("Password", { exact: true }).fill(password);
        await page
          .getByRole("button", { name: "Sign In", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "Operational overview" })
        ).toBeVisible();
      }
      if (identity === "demo") {
        await page.goto("/#/login");
        await page.getByRole("button", { name: "Demo", exact: true }).click();
        await page
          .getByRole("button", { name: "Sign In", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "Operational overview" })
        ).toBeVisible();
      }
      expect(
        (
          await request.post("http://127.0.0.1:18067/api/auth/request-reset", {
            headers: { Origin: "http://127.0.0.1:4189" },
            data: { email },
          })
        ).status()
      ).toBe(202);
      let link = "";
      await expect
        .poll(
          async () => {
            const mail = (
              await (
                await request.get("http://127.0.0.1:18027/messages")
              ).json()
            ).find(
              (m: any) =>
                m.text.includes(email) &&
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
      if (shape === "legacy") {
        const url = new URL(link),
          params = new URLSearchParams(url.hash.split("?")[1]),
          token = params.get("token")!;
        params.delete("token");
        url.searchParams.set("token", token);
        url.hash = "/reset-password?" + params;
        link = url.href;
      }
      await page.goto(link);
      await expect(
        page.getByLabel("New Password", { exact: true })
      ).toBeVisible();
      expect(page.url()).not.toContain("token=");
      await page
        .getByLabel("New Password", { exact: true })
        .fill("Matrix-replacement-password-123");
      await page
        .getByLabel("Confirm Password", { exact: true })
        .fill("Matrix-replacement-password-123");
      await page
        .getByRole("button", { name: "Reset Password", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Password Reset!" })
      ).toBeVisible();
      expect(
        (
          await request.post("http://127.0.0.1:18067/api/auth/login", {
            headers: { Origin: "http://127.0.0.1:4189" },
            data: { email, password: "Matrix-replacement-password-123" },
          })
        ).status()
      ).toBe(200);
    });
