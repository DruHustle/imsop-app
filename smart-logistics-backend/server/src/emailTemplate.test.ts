import { test } from "node:test";
import assert from "node:assert/strict";
import { renderEmail } from "./services/emailTemplate";

test("operational email escapes content without recursively substituting user text", () => {
  const html = renderEmail('<img src=x onerror="bad()">', '<script>bad()</script>\n\n@@ACTION@@ & shipment details', { webUrl: "https://logistics.onesa.eu" });
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /@@ACTION@@ &amp; shipment details/);
  assert.match(html, /href="https:\/\/logistics.onesa.eu\/#\/insights\/recommendations"/);
});

test("reset keeps the exact one-time link and rejects foreign or script actions", () => {
  const resetUrl = "https://logistics.onesa.eu/#/reset-password?token=" + "a".repeat(80);
  const html = renderEmail("Reset", `Use this link:\n\n${resetUrl}\n\nExpires in 15 minutes.`, { resetUrl, webUrl: "https://logistics.onesa.eu" });
  assert.ok(html.includes(`href="${resetUrl}"`));
  assert.match(html, /Expires in 15 minutes/);
  for (const unsafe of [resetUrl.replace("logistics.onesa.eu", "attacker.example"), 'javascript:alert(1)', resetUrl + '&extra=" onmouseover="bad()'])
    assert.deepEqual(renderEmail("Reset", unsafe, { resetUrl: unsafe, webUrl: "https://logistics.onesa.eu" }).match(/href="[^"]*"/g), ['href="mailto:info@onesa.eu"']);
});

test("an explicitly configured loopback development origin keeps a usable recovery button", () => {
  const resetUrl = "http://localhost:5173/#/reset-password?token=" + "a".repeat(80);
  assert.ok(renderEmail("Reset", resetUrl, { resetUrl, webUrl: "http://localhost:5173" }).includes(`href="${resetUrl}"`));
  assert.deepEqual(renderEmail("Reset", "http://attacker.example", { webUrl: "http://attacker.example" }).match(/href="[^"]*"/g), ['href="mailto:info@onesa.eu"']);
});
