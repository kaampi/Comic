import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".settings-prompts-test-"));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:5176/" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "Node", "Event", "MouseEvent"]) {
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
  const React=await import('react'),{render,screen,within,fireEvent,cleanup,waitFor,act}=await import('@testing-library/react');
  const {default:userEvent}=await import('@testing-library/user-event');
  const local=name=>import(pathToFileURL(join(temporary,name+'.mjs')));
  const {App}=await local('App'),ai=await local('localAi'),prompts=await local('aiPrompts'),{suggestAiBeats}=await local('adaptation/aiBeats');
  localStorage.clear();localStorage.setItem('comicbook-ai.locale','en');
  const user=userEvent.setup({document});render(React.createElement(App));
  const trigger=screen.getByRole('button',{name:'Settings',exact:true});await user.click(trigger);
  let dialog=screen.getByRole('dialog',{name:'Settings',exact:true});
  assert.ok(dialog.classList.contains('settings-dialog'));assert.equal(dialog.querySelectorAll('.settings-column').length,2);
  assert.equal(document.body.style.overflow,'hidden');assert.equal(document.activeElement,within(dialog).getByRole('button',{name:'Close',exact:true}));
  const instructions=()=>screen.getByRole('textbox',{name:'Beat instructions',exact:true});
  assert.equal(instructions().value,prompts.DEFAULT_BEAT_PROMPT);
  assert.equal(screen.getByRole('button',{name:'Save prompt',exact:true}).disabled,true);
  const custom='Prioritize discoveries, decisions and quiet reactions. Merge repetitive dialogue exchanges.';
  fireEvent.change(instructions(),{target:{value:custom}});
  assert.equal(ai.readLocalAiSettings().prompts,undefined,'drafts do not alter the saved prompt');
  await user.click(screen.getByRole('button',{name:'Save prompt',exact:true}));assert.equal(ai.readLocalAiSettings().prompts.beats,custom);assert.ok(screen.getByText('Custom',{exact:true}));
  fireEvent.change(instructions(),{target:{value:'Unsaved draft'}});
  await user.keyboard('{Escape}');assert.equal(screen.queryByRole('dialog'),null);assert.equal(document.activeElement,trigger);
  await user.click(trigger);assert.equal(instructions().value,custom,'reopening keeps saved customization and discards unsaved draft');
  assert.equal(networkRequests,0,'opening, typing, saving and restoring settings never call AI');
  const saved=ai.readLocalAiSettings();saved.servers.ollama.model='test-model';
  let requestBody;
  const source='Mira opened the gate. She found a red envelope.';
  const reply={beats:[{from:1,to:2,title:'The envelope',summary:'Mira finds an envelope.',visualDescription:'Mira stands at the open gate, studying a red envelope held in one hand.',beatType:'action',characterIds:[],locationId:null}]};
  const beats=await suggestAiBeats({source,settings:saved,context:{characters:[],locations:[]},fetchImpl:async(url,init)=>{
    requestBody=JSON.parse(init.body);return new Response(JSON.stringify({message:{content:JSON.stringify(reply)},done_reason:'stop'}));
  }});
  assert.ok(requestBody.messages[0].content.includes(custom));assert.ok(requestBody.messages[0].content.includes('Return only JSON:'));assert.ok(requestBody.messages[0].content.includes('inclusive integer segment IDs'));
  assert.equal(beats[0].sourceTextExcerpt,source);
  await user.click(screen.getByRole('button',{name:'Restore default',exact:true}));assert.equal(instructions().value,prompts.DEFAULT_BEAT_PROMPT);assert.equal(ai.readLocalAiSettings().prompts,undefined);
  fireEvent.change(instructions(),{target:{value:'   '}});assert.equal(screen.getByRole('button',{name:'Save prompt',exact:true}).disabled,true);
  cleanup();
  ai.saveLocalAiSettings({...saved,prompts:{beats:custom}});assert.equal(ai.readLocalAiSettings().prompts.beats,custom);
  localStorage.setItem(ai.LOCAL_AI_KEY,JSON.stringify({...saved,prompts:{beats:{invalid:true}}}));assert.equal(ai.readLocalAiSettings().prompts,undefined);
  localStorage.setItem(ai.LOCAL_AI_KEY,JSON.stringify({...saved,prompts:{beats:'x'.repeat(prompts.MAX_BEAT_PROMPT_LENGTH+1)}}));assert.equal(ai.readLocalAiSettings().prompts,undefined);
  // A model-list response must not overwrite a prompt saved while it was pending.
  const {LocalAiSettings}=await local('LocalAiSettings'),{PromptSettings}=await local('PromptSettings');
  let resolveModels;
  globalThis.fetch=()=>new Promise(resolve=>{resolveModels=resolve;});
  function SettingsHarness(){const [value,set]=React.useState(saved);return React.createElement(React.Fragment,null,React.createElement(LocalAiSettings,{settings:value,locale:'en',onChange:set}),React.createElement(PromptSettings,{settings:value,locale:'en',onChange:set}));}
  render(React.createElement(SettingsHarness));
  await user.click(screen.getByRole('button',{name:/Connect.*models|Refresh.*models/i}));
  fireEvent.change(instructions(),{target:{value:custom}});await user.click(screen.getByRole('button',{name:'Save prompt',exact:true}));
  await act(async()=>resolveModels(new Response(JSON.stringify({models:[{name:'listed-model'}]}))));
  await waitFor(()=>assert.equal(screen.getByLabelText('Adaptation model').value,'listed-model'));
  assert.ok(screen.getByText('Custom',{exact:true}));assert.equal(instructions().value,custom);
  cleanup();console.log('PASS: settings columns, modal focus/Escape, prompt draft/save/reset/reopen, local persistence, protected request contract, exact source recovery, invalid settings and model-refresh race.');
} finally {rmSync(temporary,{recursive:true,force:true});dom.window.close();}
