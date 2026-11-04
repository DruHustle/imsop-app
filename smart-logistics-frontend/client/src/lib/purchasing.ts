import { z } from "zod";
import { requestJSON } from "./requests";

/** Load complete bounded catalogs rather than silently omitting options after 100 rows. */
export async function readPurchaseCatalog<T>(
  path: string,
  item: z.ZodType<T>,
  signal?: AbortSignal
): Promise<T[]> {
  const schema = z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive().max(500),
  });
  const items: T[] = [];
  let total: number | undefined;
  do {
    const page = schema.parse(
      await requestJSON(
        `${path}?paged=true&offset=${items.length}`,
        "GET",
        undefined,
        undefined,
        signal
      )
    );
    if (page.total > 10000)
      throw new Error(
        "This purchasing catalog exceeds the supported 10,000 options. Ask your administrator to review the catalog."
      );
    if (
      (total !== undefined && page.total !== total) ||
      page.offset !== items.length ||
      (!page.items.length && page.total > items.length)
    )
      throw new Error(
        "The purchasing catalog changed during the read. Refresh purchasing to retry."
      );
    total = page.total;
    items.push(...page.items);
    if (items.length > total)
      throw new Error("Invalid purchasing catalog response.");
  } while (items.length < total);
  const ids = items.map(value => (value as { id: string }).id);
  if (new Set(ids).size !== ids.length)
    throw new Error(
      "The purchasing catalog changed during the read. Refresh purchasing to retry."
    );
  return items;
}
