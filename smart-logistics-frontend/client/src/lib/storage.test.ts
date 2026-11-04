import { afterEach, expect, it, vi } from "vitest";
import { createSafeStorage } from "./storage";
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
it("keeps the latest value and removals when storage fails after initialization", () => {
  const storage = createSafeStorage("localStorage");
  storage.setItem("session", "old");
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("Quota", "QuotaExceededError");
    });
  storage.setItem("session", "new");
  write.mockRestore();
  expect(localStorage.getItem("session")).toBe("old");
  expect(storage.getItem("session")).toBe("new");
  storage.removeItem("session");
  expect(storage.getItem("session")).toBeNull();
  storage.setItem("empty", "");
  expect(storage.getItem("empty")).toBe("");
  storage.clear();
  expect(storage.getItem("empty")).toBeNull();
});
it("works without access to the browser storage property", () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("Denied", "SecurityError");
  });
  const storage = createSafeStorage("localStorage");
  storage.setItem("session", "memory");
  expect(storage.getItem("session")).toBe("memory");
  storage.removeItem("session");
  expect(storage.getItem("session")).toBeNull();
});
