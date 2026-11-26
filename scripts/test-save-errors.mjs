import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
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
  const { createProject, saveProjects } = await import(pathToFileURL(join(temporary, "project.mjs")));
  const { getProjectSaveFailure, projectSaveErrorText } = await import(pathToFileURL(join(temporary, "projectSaveStatus.mjs")));
  const user = userEvent.setup({ document });
  const project = createProject("Save diagnostics", "blank");
  localStorage.clear();
  localStorage.setItem("comicbook-ai.locale", "en");
  assert.equal(saveProjects([project]), true);
  const original = localStorage.getItem("comicbook-ai.projects");
  const originalSetItem = dom.window.Storage.prototype.setItem;
  const fail = name => {
    dom.window.Storage.prototype.setItem = function(key, value) {
      if (key === "comicbook-ai.projects") throw new dom.window.DOMException("Test only", name);
      return originalSetItem.call(this, key, value);
    };
  };
  for (const [name, reason] of [["QuotaExceededError", "quota"], ["SecurityError", "blocked"], ["UnknownError", "unknown"]]) {
    fail(name);
    assert.equal(saveProjects([{ ...project, title: "Unsaved edit" }]), false);
    const error = getProjectSaveFailure();
    assert.equal(error.reason, reason);
    assert.equal(error.errorName, name);
    assert.ok(error.textBytes > 0);
    assert.equal(localStorage.getItem("comicbook-ai.projects"), original);
    for (const locale of ["en", "sv", "nb"]) {
      const message = projectSaveErrorText(error, locale);
      assert.ok(message.includes(name));
      assert.ok(message.includes("MiB"));
      if (reason !== "quota") assert.ok(!message.includes("localStorage"));
    }
  }
  dom.window.Storage.prototype.setItem = originalSetItem;
  const cyclic = { ...project };
  cyclic.circular = cyclic;
  assert.equal(saveProjects([cyclic]), false);
  assert.equal(getProjectSaveFailure().reason, "serialization");
  assert.equal(localStorage.getItem("comicbook-ai.projects"), original);
  assert.equal(saveProjects([project]), true);
  assert.equal(getProjectSaveFailure(), null);

  render(React.createElement(App));
  await user.click(screen.getByRole("button", { name: /Save diagnostics/ }));
  await user.click(screen.getByRole("button", { name: /Open album for editing/ }));
  await user.click(screen.getByRole("button", { name: "Album settings", exact: true }));
  const dialog = screen.getByRole("dialog", { name: "Album settings" });
  assert.ok(dialog.textContent.includes("Changes are saved automatically"));
  fail("SecurityError");
  await user.type(within(dialog).getByRole("textbox", { name: "Album title" }), " edited");
  assert.ok(dialog.textContent.includes("SecurityError"));
  assert.ok(!dialog.textContent.includes("Changes are saved automatically"));
  assert.ok(!dialog.textContent.includes("may be full"));
  assert.ok(!dialog.textContent.includes("storage limit"));
  assert.equal(localStorage.getItem("comicbook-ai.projects"), original);
  assert.ok(within(dialog).getByRole("textbox", { name: "Album title" }).value.endsWith(" edited"));
  // Recovery writes the edits already held in memory and clears the warning.
  dom.window.Storage.prototype.setItem = originalSetItem;
  await user.click(within(dialog).getByRole("button", { name: "Retry save" }));
  assert.equal(screen.queryByRole("alert"), null);
  assert.ok(dialog.textContent.includes("Changes are saved automatically"));
  assert.ok(JSON.parse(localStorage.getItem("comicbook-ai.projects"))[0].title.endsWith(" edited"));
  cleanup();
  const { AppErrorBoundary } = await import(pathToFileURL(join(temporary, "AppErrorBoundary.mjs")));
  const { rememberEmergencyAlbums } = await import(pathToFileURL(join(temporary, "emergencyBackup.mjs")));
  const { parseAlbumBackup } = await import(pathToFileURL(join(temporary, "albumBackup.mjs")));
  const unsaved = { ...project, title: "Latest in-memory album" };
  rememberEmergencyAlbums([unsaved]);
  fail("SecurityError");
  const savedBeforeCrash = localStorage.getItem("comicbook-ai.projects");
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  const click = dom.window.HTMLAnchorElement.prototype.click;
  const originalConsoleError = console.error;
  const downloads = [];
  try {
    URL.createObjectURL = blob => { downloads.push(blob); return "blob:emergency-fixture"; };
    URL.revokeObjectURL = () => undefined;
    dom.window.HTMLAnchorElement.prototype.click = () => undefined;
    console.error = () => undefined;
    function BrokenEditor() { throw new Error("Synthetic render failure"); }
    render(React.createElement(AppErrorBoundary, null, React.createElement(BrokenEditor)));
    console.error = originalConsoleError;
    await user.click(screen.getByRole("button", { name: /Emergency backup.*Latest in-memory album/ }));
    assert.equal(downloads.length, 1);
    const decoded = parseAlbumBackup(JSON.parse(await downloads[0].text()));
    assert.equal(decoded.id, project.id);
    assert.equal(decoded.title, unsaved.title);
    assert.equal(localStorage.getItem("comicbook-ai.projects"), savedBeforeCrash);
    console.log("PASS: render failures can download the unsaved album as a restore-compatible file while project writes are blocked.");
  } finally {
    console.error = originalConsoleError;
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    dom.window.HTMLAnchorElement.prototype.click = click;
    dom.window.Storage.prototype.setItem = originalSetItem;
    cleanup();
  }
  assert.equal(networkRequests, 0);
  console.log("PASS: actual quota, blocked access, unknown and serialization errors; previous save preserved; honest UI status and retry preserves unsaved edits");
} finally {
  rmSync(temporary, { recursive: true, force: true });
  dom.window.close();
}

