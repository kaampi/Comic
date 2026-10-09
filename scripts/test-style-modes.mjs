import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".about-test-"));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:5176/" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let networkRequests = 0;
globalThis.fetch = async () => { networkRequests++; throw new Error("offline"); };
symlinkSync(join(root, "node_modules"), join(temporary, "node_modules"), process.platform === "win32" ? "junction" : "dir");

function compile(directory = "") {
  for (const entry of readdirSync(join(root, "src", directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { compile(path); continue; }
    if (!/\.tsx?$/.test(entry.name) || entry.name === "main.tsx") continue;
    const output = ts.transpileModule(readFileSync(join(root, "src", path), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText.replace(/import "[^"\n]+\.css";?/g, "").replace(/from "(\.[^"]+)"/g, (_, imported) => {
      if (imported.endsWith(".json")) return 'from "' + pathToFileURL(resolve(root, "src", dirname(path), imported)) + '" with { type: "json" }';
      return 'from "' + imported + '.mjs"';
    });
    mkdirSync(join(temporary, directory), { recursive: true });
    writeFileSync(join(temporary, path.replace(/\.tsx?$/, ".mjs")), output);
  }
}

try {
  compile();
  const React = await import("react");
  const { render, screen, cleanup } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { ColorModeSelect } = await import(pathToFileURL(join(temporary, "ColorModeSelect.mjs")));
  const { PAINTERLY_STYLES } = await import(pathToFileURL(join(temporary, "painterlyStyles.mjs")));
  const user = userEvent.setup({ document });
  let selected;
  const oil = PAINTERLY_STYLES.find(s => s.id === "paint-zorn-alla-prima");
  const charcoal = PAINTERLY_STYLES.find(s => s.id === "draw-expressive-charcoal");
  const vintage = PAINTERLY_STYLES.find(s => s.id === "print-vintage-halftone");
  const props = { locale: "sv", onChange: options => { selected = options; } };
  const view = render(React.createElement(ColorModeSelect, { ...props, style: oil, options: { linesOnly: true } }));
  assert.equal(screen.getByRole("combobox").value, "color");
  assert.equal(screen.getByRole("option", { name: "Svartvitt (gråskala)" }).disabled, true);
  assert.equal(screen.getByRole("option", { name: "Enbart linjer" }).disabled, true);
  await user.selectOptions(screen.getByRole("combobox"), "grayscale");
  assert.equal(selected, undefined);
  view.rerender(React.createElement(ColorModeSelect, { ...props, style: charcoal, options: { linesOnly: false } }));
  assert.equal(screen.getByRole("combobox").value, "grayscale");
  assert.equal(screen.getByRole("option", { name: "Färg", exact: true }).disabled, true);
  view.rerender(React.createElement(ColorModeSelect, { ...props, style: vintage, options: { linesOnly: false } }));
  await user.selectOptions(screen.getByRole("combobox"), "grayscale");
  assert.deepEqual(selected, { colorMode: "grayscale", linesOnly: false });
  cleanup();
  assert.equal(networkRequests, 0);
  console.log("PASS: unsupported modes disabled, fallback shown, grayscale selection stays distinct from line art, offline UI");
} finally {
  rmSync(temporary, { recursive: true, force: true });
  dom.window.close();
}
