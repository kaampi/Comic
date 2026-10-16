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
  const { render, screen, cleanup, within, fireEvent } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const org = await import(pathToFileURL(join(temporary, "styleOrganization.mjs")));
  const { StyleTags, OwnTagManager } = await import(pathToFileURL(join(temporary, "StyleTags.mjs")));
  const { BUILTIN_STYLES, readCustomStyles } = await import(pathToFileURL(join(temporary, "stylesLibrary.mjs")));
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
  await user.clear(screen.getByRole('textbox',{name:'Sök stillmall…'}));
  const source=BUILTIN_STYLES.find(s=>s.id==='er-1');
  const card=screen.getByRole('heading',{name:source.name,exact:true}).closest('article');
  await user.click(within(card).getByTitle('Duplicera'));
  const editor=()=>within(document.querySelector('.style-editor'));
  assert.equal(editor().getByLabelText('Linjer & former').value,source.promptModules.lines);
  fireEvent.change(editor().getByLabelText('Linjer & former'),{target:{value:'CUSTOM LINE RULE'}});
  fireEvent.change(editor().getByLabelText('Färg & skuggning'),{target:{value:'CUSTOM COLOR RULE'}});
  fireEvent.change(editor().getByLabelText('Ytstruktur & finish'),{target:{value:'CUSTOM TEXTURE RULE'}});
  assert.equal(editor().queryByLabelText('Promptvariant: color'),null,'derived variants cannot contradict structured fields');
  await user.click(editor().getByRole('button',{name:'Spara',exact:true}));
  const copy=readCustomStyles().find(s=>s.name===source.name+' – kopia');
  assert.ok(copy&&copy.id!==source.id);
  assert.equal(copy.promptModules.lines,'CUSTOM LINE RULE');
  assert.equal(copy.reinforceAfterScene,source.reinforceAfterScene);
  assert.deepEqual(copy.visualReferences,source.visualReferences);
  assert.equal(copy.previewImage,source.previewImage);
  assert.match(copy.modePromptText.color,/CUSTOM LINE RULE/);
  assert.match(copy.modePromptText.color,/CUSTOM COLOR RULE/);
  assert.match(copy.modePromptText.grayscale,/CUSTOM TEXTURE RULE/);
  assert.doesNotMatch(copy.modePromptText.grayscale,/CUSTOM COLOR RULE/);
  const {buildImagePrompt}=await import(pathToFileURL(join(temporary,'adaptation/prompts.mjs')));
  const copiedProject=createProject('Copied template','blank',copy);
  const panel={id:'copy-panel',visualDescription:'A captain walks in the rain.',characterIds:[],promptDirection:{cameraAngle:'high',effects:[]},sizeHint:'full-width'};
  const generated=buildImagePrompt(copiedProject,panel);
  for(const rule of ['CUSTOM LINE RULE','CUSTOM COLOR RULE','CUSTOM TEXTURE RULE'])assert.equal(generated.split(rule).length-1,2,'edited fields reach both style module and closing reminder');
  assert.doesNotMatch(generated,/MODULE 3/,'no effects means no effects module');
  assert.match(generated,/MODULE 4: SUBJECT/);
  // An actual supported effect must be the only reason module 3 appears.
  const {EFFECTS}=await import(pathToFileURL(join(temporary,'adaptation/prompts.mjs')));
  assert.match(buildImagePrompt(copiedProject,{...panel,promptDirection:{effects:[Object.keys(EFFECTS)[0]]}}),/MODULE 3/);
  const copyCard=screen.getByRole('heading',{name:copy.name,exact:true}).closest('article');
  await user.click(within(copyCard).getByTitle('Redigera'));
  assert.equal(editor().getByLabelText('Linjer & former').value,'CUSTOM LINE RULE','reopening retains the structured edits');
  console.log('PASS: template duplicate/edit/save/reopen retains all style modules, metadata and emphasis; mode variants and new image prompts use the edited fields.');
  assert.equal(networkRequests, 0);
  cleanup();
  console.log("Style tags: favorites, create, assign, duplicate, rename, delete, persistence and backup merge passed.");
} finally { dom.window.close(); rmSync(temporary, { recursive: true, force: true }); }

