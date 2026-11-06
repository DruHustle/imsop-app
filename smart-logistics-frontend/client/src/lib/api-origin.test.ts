import { describe, expect, it } from "vitest";
import { resolveApiOrigin } from "./api-origin";

describe("shared backend routing", () => {
  it.each([undefined, "", " \t ", "https://imsop-app.onrender.com"])(
    "keeps root-hosted production requests first-party with configured origin %j",
    configured => {
      expect(resolveApiOrigin(configured, true, "/")).toBe("");
    }
  );
  it.each([undefined, "", " \t "])(
    "uses the canonical API for subpath production with unconfigured origin %j",
    configured => {
      expect(resolveApiOrigin(configured, true, "/smart-logistics-frontend/")).toBe(
        "https://logistics-api.onesa.eu"
      );
    }
  );
  it("preserves custom development and Pages origins and trims slashes", () => {
    expect(resolveApiOrigin(" http://localhost:3001/// ", false, "/")).toBe(
      "http://localhost:3001"
    );
    expect(
      resolveApiOrigin("https://custom.example/", true, "/smart-logistics-frontend/")
    ).toBe("https://custom.example");
  });
  it.each([undefined, "", " \t "])(
    "preserves the local development fallback with unconfigured origin %j",
    configured => {
      expect(resolveApiOrigin(configured, false, "/")).toBe(
        "http://localhost:3001"
      );
    }
  );
});
