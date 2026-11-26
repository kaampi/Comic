import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { scripts } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const tests = Object.keys(scripts).filter(name => name.startsWith("test:"));
const failed = [];
const npm = process.env.npm_execpath;

if (!npm || !tests.length) throw new Error("Run this suite via npm test.");

for (const name of tests) {
  const run = spawnSync(process.execPath, [npm, "run", name], { stdio: "inherit" });
  if (run.status !== 0) {
    failed.push(name);
    if (run.error) console.error(run.error);
  }
}

console.log(`\n${tests.length - failed.length}/${tests.length} test scripts passed.`);
if (failed.length) {
  console.error(`Failed: ${failed.join(", ")}`);
  process.exitCode = 1;
}
