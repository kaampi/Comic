import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

for (const file of readdirSync(new URL("./", import.meta.url)).filter(name => /^test-.*\.mjs$/.test(name)).sort()) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(file, import.meta.url))], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

