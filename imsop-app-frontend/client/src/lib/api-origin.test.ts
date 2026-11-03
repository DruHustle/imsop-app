import { describe, expect, it } from "vitest";
import { resolveApiOrigin } from "./api-origin";

describe("shared backend routing", () => {
  it("keeps Operations and auth requests on the root-hosted proxy despite a stale dashboard value", () => {
    expect(resolveApiOrigin("https://imsop-app.onrender.com", true, "/")).toBe(
      ""
    );
  });
  it("uses Oracle for unconfigured Pages production", () => {
    expect(resolveApiOrigin(undefined, true, "/imsop-app-frontend/")).toBe(
      "https://imsop-api.152-70-22-84.sslip.io"
    );
  });
  it("preserves custom development and Pages origins and trims slashes", () => {
    expect(resolveApiOrigin(" http://localhost:3001/// ", false, "/")).toBe(
      "http://localhost:3001"
    );
    expect(
      resolveApiOrigin("https://custom.example/", true, "/imsop-app-frontend/")
    ).toBe("https://custom.example");
  });
});
