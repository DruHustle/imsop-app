import { describe, it, expect } from "vitest";
import {
  parseResetToken,
  captureResetToken,
  forgetResetToken,
} from "./recovery";
describe("recovery credentials", () => {
  it("accepts both emitted and legacy links and rejects duplicate/malformed tokens", () => {
    expect(
      parseResetToken("https://app.test/#/reset-password?token=one.two.three")
    ).toBe("one.two.three");
    expect(
      parseResetToken("https://app.test/?token=one.two.three#/reset-password")
    ).toBe("one.two.three");
    for (const href of [
      "https://app.test/#/reset-password",
      "https://app.test/?token=a.b.c#/reset-password?token=a.b.c",
      "https://app.test/#/reset-password?token=a.b.c&token=d.e.f",
      "https://app.test/#/reset-password?token=%",
      "https://app.test/#/reset-password?token=plain",
    ])
      expect(parseResetToken(href)).toBeNull();
  });
  it("scrubs the address bar, retains the credential in memory for retry, and forgets it after consumption", () => {
    history.replaceState(
      null,
      "",
      "/?campaign=help#/reset-password?token=one.two.three&lang=en"
    );
    expect(captureResetToken()).toBe("one.two.three");
    expect(location.href).not.toContain("token=");
    expect(location.href).toContain("lang=en");
    expect(captureResetToken()).toBe("one.two.three");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    forgetResetToken();
    expect(captureResetToken()).toBeNull();
  });
});

it("notifies a fresh credential capture when another recovery link arrives in the same document", () => {
  history.replaceState(null, "", "/#/reset-password?token=one.two.three");
  let captures = 0;
  const receive = () => captures++;
  window.addEventListener("imsop:recovery-link", receive);
  expect(captureResetToken()).toBe("one.two.three");
  forgetResetToken();
  history.replaceState(null, "", "/#/reset-password?token=other.reset.link");
  expect(captureResetToken()).toBe("other.reset.link");
  expect(captures).toBe(2);
  expect(location.href).not.toContain("token=");
  window.removeEventListener("imsop:recovery-link", receive);
  forgetResetToken();
});
