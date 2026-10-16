import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".about-test-"));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:5176/" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent", "FormData"]) {
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
  const org = await import(pathToFileURL(join(temporary, "styleOrganization.mjs")));
  const { StyleTags, OwnTagManager } = await import(pathToFileURL(join(temporary, "StyleTags.mjs")));
  const { BUILTIN_STYLES } = await import(pathToFileURL(join(temporary, "stylesLibrary.mjs")));
  const user = userEvent.setup({ document });
  const style = BUILTIN_STYLES[0], prompt = style.promptText;
  let value = org.emptyOrganization();
  function Wrapper() { const [state, setState] = React.useState(value); return React.createElement(React.Fragment, null, React.createElement(StyleTags, { style, value: state, sv: true, onChange: next => { value = next; org.saveOrganization(next); setState(next); } }), React.createElement(OwnTagManager, { value: state, sv: true, onChange: next => { value = next; org.saveOrganization(next); setState(next); } })); }
  render(React.createElement(Wrapper));
  await user.click(screen.getByRole("button", { name: `Favorit: ${style.name}` }));
  assert.deepEqual(org.readOrganization().favorites, [style.id]);
  await user.click(screen.getByText("Hantera taggar"));
  await user.type(screen.getByRole("textbox", { name: "Ny tagg" }), "Min bok");
  await user.click(screen.getByRole("button", { name: "Lägg till" }));
  assert.equal(Object.values(value.tags)[0], "Min bok");
  assert.equal(value.assignments[style.id].length, 1);
  await user.type(screen.getByRole("textbox", { name: "Ny tagg" }), "min bok");
  await user.click(screen.getByRole("button", { name: "Lägg till" }));
  assert.equal(Object.keys(value.tags).length, 1);
  await user.click(screen.getByText("Redigera egna taggar"));
  const rename = screen.getByRole("textbox", { name: "Byt namn på Min bok" });
  await user.clear(rename); await user.type(rename, "Projekt A");
  await user.click(screen.getByRole("button", { name: "Spara" }));
  assert.equal(Object.values(org.readOrganization().tags)[0], "Projekt A");
  const incoming = { tags: { [Object.keys(value.tags)[0]]: "Annan tagg" }, assignments: { [style.id]: Object.keys(value.tags) }, favorites: ["fb-1"] };
  const merged = org.mergeOrganization(value, incoming);
  assert.equal(Object.keys(merged.tags).length, 2);
  assert.equal(merged.assignments[style.id].length, 2);
  assert.deepEqual(org.parseOrganization(merged), merged);
  assert.throws(() => org.parseOrganization({ tags: {}, assignments: { x: ["missing"] }, favorites: [] }));
  assert.equal(style.promptText, prompt);
  await user.click(screen.getByRole("button", { name: "Ta bort" }));
  assert.equal(Object.keys(org.readOrganization().tags).length, 0);
  assert.deepEqual(value.assignments[style.id], []);
  const { createProject } = await import(pathToFileURL(join(temporary, "project.mjs")));
  const { packAlbumBackup, parseAlbumBackup } = await import(pathToFileURL(join(temporary, "albumBackup.mjs")));
  const project = createProject("Tag test", "blank");
  const backup = JSON.parse(JSON.stringify(packAlbumBackup(project)));
  assert.deepEqual(org.parseOrganization(backup.styleOrganization), org.readOrganization());
  assert.equal(parseAlbumBackup(backup).title, "Tag test");
  delete backup.styleOrganization;
  assert.equal(parseAlbumBackup(backup).title, "Tag test");
  cleanup();
  const { App } = await import(pathToFileURL(join(temporary, "App.mjs")));
  render(React.createElement(App));
  await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "sv");
  await user.click(screen.getByRole("button", { name: "Stillmallar", exact: true }));
  const count = () => document.querySelectorAll(".style-grid .style-card").length;
  assert.equal(count(), BUILTIN_STYLES.length);
  await user.click(screen.getByRole("checkbox", { name: "Bara favoriter" }));
  assert.equal(count(), 1);
  await user.selectOptions(screen.getByRole("combobox", { name: "Filtrera på tagg" }), "Barnbok");
  assert.equal(count(), 0);
  await user.click(screen.getByRole("checkbox", { name: "Bara favoriter" }));
  assert.ok(count() > 0 && count() < BUILTIN_STYLES.length);
  await user.selectOptions(screen.getByRole("combobox", { name: "Filtrera på tagg" }), "");
  await user.type(screen.getByRole("textbox", { name: "Sök stillmall…" }), "Barnbok");
  assert.ok(count() > 0 && count() < BUILTIN_STYLES.length);
  assert.equal(networkRequests, 0);
  cleanup();
  console.log("Style tags: favorites, create, assign, duplicate, rename, delete, persistence and backup merge passed.");
} finally { dom.window.close(); rmSync(temporary, { recursive: true, force: true }); }
