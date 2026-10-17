import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".guide-test-"));
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
  const { render, screen, within, cleanup } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { App } = await import(pathToFileURL(join(temporary, "App.mjs")));
  const { GUIDE, guideTopic } = await import(pathToFileURL(join(temporary, "guideContent.mjs")));
  localStorage.setItem("comicbook-ai.locale", "en");
  const user = userEvent.setup({ document });
  render(React.createElement(App));
  const trigger = await screen.findByRole("button", { name: "Guide", exact: true });
  await user.click(trigger);
  const dialog = screen.getByRole("dialog", { name: GUIDE.title });
  assert.equal(dialog.lang, "en");
  const close = within(dialog).getByRole("button", { name: "Close guide" });
  assert.equal(document.activeElement, close);
  for (const topic of GUIDE.topics) {
    const link = within(dialog).getByRole("link", { name: topic.title, exact: true });
    await user.click(link);
    assert.equal(document.activeElement, within(dialog).getByRole("heading", { name: topic.title, exact: true }));
    assert.ok(guideTopic(topic.id).shortHelp.length > 0);
  }
  await user.click(within(dialog).getAllByRole("link", { name: "Back to guide contents" }).at(-1));
  assert.equal(document.activeElement, close);
  await user.keyboard("{Shift>}{Tab}{/Shift}");
  assert.equal(document.activeElement, within(dialog).getAllByRole("link").at(-1));
  await user.keyboard("{Tab}");
  assert.equal(document.activeElement, close);
  await user.keyboard("{Escape}");
  assert.equal(screen.queryByRole("dialog"), null);
  assert.equal(document.activeElement, trigger);
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "Close guide" }));
  assert.equal(screen.queryByRole("dialog"), null);
  assert.equal(document.activeElement, trigger);
  cleanup();
  console.log("Guide opens from the app, topics navigate, keyboard focus stays in the dialog and closing returns focus.");
} finally {
  rmSync(temporary, { recursive: true, force: true });
  dom.window.close();
}
