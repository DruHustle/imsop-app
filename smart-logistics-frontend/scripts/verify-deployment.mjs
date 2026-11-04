import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function verifyDeployment(output) {
  let checked = 0;
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await inspect(filename);
      else if (entry.name.endsWith(".js")) {
        const source = await readFile(filename, "utf8");
        assert(
          !/\b[a-z0-9.-]+\.onrender\.com\b/i.test(source),
          `${filename}: retired Render backend in browser JavaScript`
        );
        checked++;
      }
    }
  }
  await inspect(path.join(output, "assets"));
  assert(checked > 0, "Build the frontend before verifying deployment");
  return checked;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const output = path.resolve(process.argv[2] || "dist");
  console.log(
    `Verified ${await verifyDeployment(output)} browser chunks use no retired backend`
  );
}
