import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";

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
  const { render, screen, within, cleanup, waitFor } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { App } = await import(pathToFileURL(join(temporary, "App.mjs")));
  const { createProject } = await import(pathToFileURL(join(temporary, "project.mjs")));
  const { loadProjectCollection, saveProjectCollection, ProjectStorageError } = await import(pathToFileURL(join(temporary, "projectDatabase.mjs")));
  const legacyKey = "comicbook-ai.projects";
  const setFactory = () => Object.defineProperty(globalThis, "indexedDB", { value: new IDBFactory(), configurable: true });
  const originalPut = IDBObjectStore.prototype.put;
  const originalSet = dom.window.Storage.prototype.setItem;
  const project = createProject("Storage migration", "blank");
  project.pages = [{ id: "page-storage", number: 1, gridColumns: 3, gridRows: 5, placements: [{ id: "frame-storage", x: 0, y: 0, width: 1, height: 1, readingOrder: 1, overlays: [], image: { id: "image-storage", name: "image", dataUrl: "data:image/png;base64,AAAA", zoom: 2, offsetX: 10, offsetY: 20, fit: "contain" } }] }];
  project.introduction="A synthetic album introduction.";project.cover={name:"cover.webp",dataUrl:"data:image/webp;base64,AAAA"};
  const legacy = JSON.stringify([project]);
  setFactory();localStorage.clear();localStorage.setItem(legacyKey, legacy);
  const migrated = await loadProjectCollection();
  assert.equal(migrated[0].id, project.id);
  assert.equal(migrated[0].introduction,project.introduction);assert.deepEqual(migrated[0].cover,project.cover);
  assert.deepEqual(JSON.parse(JSON.stringify(migrated[0].pages[0].placements[0])), project.pages[0].placements[0]);
  assert.equal(localStorage.getItem(legacyKey), null);
  assert.equal((await loadProjectCollection())[0].id, project.id);
  console.log("PASS: committed, verified migration retains IDs, images and geometry and releases legacy text quota");

  const huge = { ...project, title: "Large album", source: { ...project.source, textSnapshot: "x".repeat(6_000_000) } };
  dom.window.Storage.prototype.setItem = function(key, value) {
    if (key === legacyKey) throw new dom.window.DOMException("Text quota full", "QuotaExceededError");
    return originalSet.call(this, key, value);
  };
  assert.ok(JSON.stringify([huge]).length * 2 > 11_000_000);
  await saveProjectCollection([huge]);
  assert.equal((await loadProjectCollection())[0].source.textSnapshot.length, 6_000_000);
  assert.deepEqual((await loadProjectCollection())[0].cover,project.cover);assert.equal((await loadProjectCollection())[0].introduction,project.introduction);
  assert.equal(localStorage.getItem(legacyKey), null);
  await Promise.all(["Revision one", "Revision two", "Newest revision"].map(title => saveProjectCollection([{ ...project, title }])));
  assert.equal((await loadProjectCollection())[0].title, "Newest revision");
  console.log("PASS: projects larger than the reported 10.76 MiB persist with localStorage writes blocked; rapid saves retain newest revision");

  let burstWrites = 0;
  IDBObjectStore.prototype.put = function(...args) { burstWrites++; return originalPut.apply(this, args); };
  const firstSave = saveProjectCollection([{ ...project, title: "Active revision" }]);
  await Promise.resolve(); // Start the active write, leaving IndexedDB pending.
  const burst = Array.from({ length: 250 }, (_, index) => saveProjectCollection([{ ...project, title: "Burst " + index }]));
  assert.ok(burst.every(promise => promise === burst[0]), "Pending callers share a bounded batch");
  await Promise.all([firstSave, ...burst]);
  assert.equal(burstWrites, 2, "One active write plus the latest pending revision, not 251 full snapshots");
  assert.equal((await loadProjectCollection())[0].title, "Burst 249");
  const captured = { ...project, title: "Captured revision" };
  const capturedSave = saveProjectCollection([captured]);
  captured.title = "Mutation after save request";
  await capturedSave;
  assert.equal((await loadProjectCollection())[0].title, "Captured revision");
  IDBObjectStore.prototype.put = originalPut;
  await saveProjectCollection([{ ...project, title: "Newest revision" }]);
  console.log("PASS: 250 rapid edits retain only one pending batch, commit the newest revision and preserve snapshot isolation");

  IDBObjectStore.prototype.put = function(...args) { const request = originalPut.apply(this, args); this.transaction.abort(); return request; };
  await assert.rejects(saveProjectCollection([{ ...project, title: "Must not commit" }]), error => error instanceof ProjectStorageError && error.failure.errorName === "AbortError");
  IDBObjectStore.prototype.put = originalPut;
  assert.equal((await loadProjectCollection())[0].title, "Newest revision");
  await saveProjectCollection([project]);
  assert.equal((await loadProjectCollection())[0].title, project.title);
  console.log("PASS: transaction abort never reports save success, preserves previous snapshot, and retry recovers");

  dom.window.Storage.prototype.setItem = originalSet;
  setFactory();localStorage.setItem(legacyKey, legacy);
  IDBObjectStore.prototype.put = function(...args) { const request = originalPut.apply(this, args); this.transaction.abort(); return request; };
  await assert.rejects(loadProjectCollection(), ProjectStorageError);
  assert.equal(localStorage.getItem(legacyKey), legacy);
  IDBObjectStore.prototype.put = originalPut;
  assert.equal((await loadProjectCollection())[0].id, project.id);
  assert.equal(localStorage.getItem(legacyKey), null);
  setFactory();localStorage.setItem(legacyKey, "{corrupt");
  await assert.rejects(loadProjectCollection(), ProjectStorageError);
  assert.equal(localStorage.getItem(legacyKey), "{corrupt");
  console.log("PASS: failed migration and corrupt input retain legacy data and never create an empty replacement");

  // A load failure blocks editing; retry loads the existing collection instead of overwriting it.
  localStorage.clear();localStorage.setItem("comicbook-ai.locale", "en");
  setFactory();await saveProjectCollection([project]);
  const realFactory = indexedDB;
  Object.defineProperty(globalThis, "indexedDB", { value: { open() { throw new DOMException("Blocked", "SecurityError"); } }, configurable: true });
  render(React.createElement(App));
  await waitFor(() => assert.match(screen.getByRole("alert").textContent, /SecurityError/));
  assert.equal(screen.queryByRole("button", { name: /Storage migration/ }), null);
  Object.defineProperty(globalThis, "indexedDB", { value: realFactory, configurable: true });
  const user = userEvent.setup({ document });
  await user.click(screen.getByRole("button", { name: "Retry", exact: true }));
  await user.click(await screen.findByRole("button", { name: /Storage migration/ }));
  await user.click(screen.getByRole("button", { name: /Open album for editing/ }));
  await user.click(screen.getByRole("button", { name: "Album settings", exact: true }));
  const dialog = screen.getByRole("dialog", { name: "Album settings" });
  dom.window.Storage.prototype.setItem = function(key, value) { if (key === legacyKey) throw new DOMException("Full", "QuotaExceededError"); return originalSet.call(this, key, value); };
  await user.type(within(dialog).getByRole("textbox", { name: "Album title" }), " edited");
  await waitFor(() => assert.ok(dialog.textContent.includes("Changes are saved automatically")));
  assert.equal(screen.queryByRole("alert"), null);
  assert.equal((await loadProjectCollection())[0].title, "Storage migration edited");
  assert.deepEqual(JSON.parse(JSON.stringify((await loadProjectCollection())[0].pages[0].placements[0])), project.pages[0].placements[0]);
  cleanup();
  dom.window.Storage.prototype.setItem = originalSet;
  assert.equal(networkRequests, 0);
  console.log("PASS: startup failure blocks editing, retry recovers, native autosave persists edits and page images with full text storage, offline");
} finally {
  rmSync(temporary, { recursive: true, force: true });
  dom.window.close();
}

