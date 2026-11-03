import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { readPurchaseCatalog } from "./purchasing";
afterEach(() => vi.unstubAllGlobals());
it("reads options beyond the first page and rejects changing or duplicated catalogs", async () => {
  const rows = Array.from({ length: 101 }, (_, n) => ({
    id: String(n),
    name: `Product ${n}`,
  }));
  const schema = z.object({ id: z.string(), name: z.string() });
  const fetch = vi.fn(async (url: string) => {
    const offset = Number(
      new URL(url, "http://localhost").searchParams.get("offset")
    );
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items: rows.slice(offset, offset + 100),
        total: rows.length,
        offset,
        limit: 100,
      }),
    };
  });
  vi.stubGlobal("fetch", fetch);
  expect(await readPurchaseCatalog("/catalog", schema)).toEqual(rows);
  expect(fetch).toHaveBeenCalledTimes(2);
  fetch.mockImplementation(async (url: string) => {
    const offset = Number(
      new URL(url, "http://localhost").searchParams.get("offset")
    );
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items: offset ? [rows[0]] : rows.slice(0, 100),
        total: 101,
        offset,
        limit: 100,
      }),
    };
  });
  await expect(readPurchaseCatalog("/catalog", schema)).rejects.toThrow(
    "changed during the read"
  );
});
