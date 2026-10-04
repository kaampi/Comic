import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src", import.meta.url));
const files = [];
function collect(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) collect(path);
    else files.push(path);
  }
}
collect(root);
const insensitivePaths = new Map(
  files.map((path) => [path.toLowerCase(), path]),
);
const host = {
  ...ts.sys,
  useCaseSensitiveFileNames: false,
  fileExists: (path) =>
    insensitivePaths.has(resolve(path).toLowerCase()) ||
    ts.sys.fileExists(path),
  readFile: (path) =>
    ts.sys.readFile(insensitivePaths.get(resolve(path).toLowerCase()) ?? path),
};
const options = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.ReactJSX,
};
for (const file of files.filter((path) => /\.tsx?$/.test(path))) {
  for (const imported of ts.preProcessFile(readFileSync(file, "utf8"))
    .importedFiles) {
    const name = imported.fileName;
    if (!name.startsWith(".") || name.endsWith(".css")) continue;
    const exact = ts.resolveModuleName(name, file, options, ts.sys)
      .resolvedModule?.resolvedFileName;
    const insensitive = ts.resolveModuleName(name, file, options, host)
      .resolvedModule?.resolvedFileName;
    assert.ok(exact, `Cannot resolve ${name} from ${file}`);
    assert.equal(
      resolve(insensitive).toLowerCase(),
      resolve(exact).toLowerCase(),
      `Windows resolves ${name} from ${file} to a different module`,
    );
  }
}
console.log(
  "PASS: relative modules resolve identically on case-sensitive and Windows-style filesystems",
);
