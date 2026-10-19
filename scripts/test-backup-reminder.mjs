import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".backup-reminder-test-"));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:5176/" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent", "FileReader", "File", "HTMLInputElement", "SVGElement", "NodeFilter", "HTMLTextAreaElement"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.PointerEvent=dom.window.MouseEvent;
Object.defineProperty(globalThis,"PointerEvent",{value:dom.window.MouseEvent,configurable:true});
dom.window.confirm=()=>true;
let networkRequests = 0;
const nativeFetch=globalThis.fetch;
globalThis.fetch = async url => { if(String(url).startsWith('data:'))return nativeFetch(url); networkRequests++; throw new Error("offline"); };
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
    writeFileSync(join(temporary, path.replace(/\.tsx?$/, ".mjs")), output.replace(/import\("(\.[^"]+)"\)/g,'import("$1.mjs")'));
  }
}


try {
  compile();
  const React=await import("react"),{render,screen,fireEvent,waitFor,cleanup,act}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event");
  const local=path=>import(pathToFileURL(join(temporary,path+".mjs")));
  const reminder=await local("backupReminder"),{createProject}=await local("project"),{AlbumMenu}=await local("AlbumMenu");
  const project=createProject("Backup reminder fixture","blank");
  const first=reminder.observeBackupReminder(undefined,project);assert.equal(reminder.backupReminderDue(first),false);
  let worked=first;for(let i=0;i<119;i++)worked=reminder.advanceBackupWork(worked,15000);
  assert.equal(reminder.backupReminderDue(worked),false);worked=reminder.advanceBackupWork(worked,15000);assert.equal(reminder.backupReminderDue(worked),true);
  const saved=reminder.createdBackupState(project);assert.equal(reminder.advanceBackupWork(saved,15000),saved,"unchanged backed-up albums do not accrue unbacked work");
  const edited={...project,updatedAt:new Date(Date.parse(project.updatedAt)+1000).toISOString()};assert.equal(reminder.backupReminderDue(reminder.observeBackupReminder(saved,edited)),false);
  const rich={...project,panels:Array.from({length:10},(_,i)=>({id:`panel-${i}`,sceneId:"",order:i+1,action:"",dialogue:"",narration:"",imagePrompt:"",characterIds:[]}))};
  const richState=reminder.observeBackupReminder(undefined,rich);assert.equal(richState.added,10);assert.equal(reminder.backupReminderDue(richState),true);
  assert.equal(reminder.observeBackupReminder(richState,rich).added,10,"re-renders do not recount resources");
  const image={name:"fixture.png",dataUrl:"data:image/png;base64,AAAA"},layer={id:"frame-1",panelId:"panel-0",x:0,y:0,width:1,height:1,readingOrder:1,image,overlays:[]};
  const illustrated={...rich,pages:[{id:"page",number:1,gridColumns:3,gridRows:5,placements:[layer]}]};
  const before=reminder.backupResources(illustrated),moved={...illustrated,pages:[{...illustrated.pages[0],placements:[]}],unplacedPanels:[{layer,sourceGrid:{gridColumns:3,gridRows:5}}]};
  assert.deepEqual(new Set(reminder.backupResources(moved)),new Set(before),"pool transfers do not count as new panels or images");
  reminder.markBackupCreated(project);reminder.saveBackupReminder(rich.id,richState); // Same ID now has a due state.
  assert.equal(reminder.backupReminderDue(reminder.readBackupReminder(rich.id)),true);
  const other={...project,id:"other-album"};reminder.markBackupCreated(other);
  assert.equal(reminder.backupReminderDue(reminder.readBackupReminder(other.id)),false);assert.equal(reminder.backupReminderDue(reminder.readBackupReminder(rich.id)),true);
  console.log("PASS: active-work threshold, new resource threshold, dirty revisions, backup reset, no repeated counting, pool moves and per-album persistence");

  function Harness({project}){const [mode,setMode]=React.useState(null);return React.createElement(AlbumMenu,{project,locale:"en",mode,onMode:setMode,onUpdate:()=>{},onRestore:()=>{},styles:[],onClose:()=>{},section:"pages",onSection:()=>{}});}
  let fail=true,blobs=[];const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL,oldClick=dom.window.HTMLAnchorElement.prototype.click;
  URL.createObjectURL=blob=>{if(fail)throw new Error("could not create file");blobs.push(blob);return "blob:backup-fixture";};URL.revokeObjectURL=()=>{};dom.window.HTMLAnchorElement.prototype.click=function(){};
  const user=userEvent.setup({document});const view=render(React.createElement(Harness,{project:rich}));
  const backup=()=>screen.getByRole("button",{name:"Backup",exact:true});
  await waitFor(()=>assert.ok(backup().classList.contains("backup-reminder")));
  assert.ok(backup().getAttribute("title").includes("separate backup file"));
  await user.click(backup());assert.ok(screen.getAllByText("Restore backup…").length>0);
  await user.click(screen.getByRole("button",{name:"Create backup…",exact:true}));
  assert.ok(backup().classList.contains("backup-reminder"),"failed backup leaves the reminder active");
  fail=false;await user.click(screen.getByRole("button",{name:"Create backup…",exact:true}));
  assert.equal(backup().classList.contains("backup-reminder"),false);assert.equal(blobs.length,1);
  assert.equal(JSON.parse(await blobs[0].text()).project.id,rich.id);
  assert.equal(reminder.backupReminderDue(reminder.readBackupReminder(rich.id)),false);
  view.unmount();render(React.createElement(Harness,{project:rich}));await waitFor(()=>assert.equal(backup().classList.contains("backup-reminder"),false));cleanup();
  URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;dom.window.HTMLAnchorElement.prototype.click=oldClick;
  console.log("PASS: real backup button turns red, uses new action labels, keeps reminder after creation failure, resets only on created backup and stays reset after reopening");

  // Check real hook gating without waiting 30 minutes.
  const {useBackupReminder}=await local("useBackupReminder");let tick,time=0;
  const oldInterval=window.setInterval,oldClear=window.clearInterval;
  window.setInterval=callback=>{tick=callback;return 1;};window.clearInterval=()=>{};
  const ownNow=Object.getOwnPropertyDescriptor(performance,"now");Object.defineProperty(performance,"now",{value:()=>time,configurable:true});
  let visible="hidden",focused=true;
  Object.defineProperty(document,"visibilityState",{get:()=>visible,configurable:true});Object.defineProperty(document,"hasFocus",{value:()=>focused,configurable:true});
  reminder.saveBackupReminder(project.id,{...first,workedMs:reminder.BACKUP_WORK_MS-15000});
  function Clock(){const value=useBackupReminder(project);return React.createElement("p",null,value.due?"due":"not due");}
  render(React.createElement(Clock));
  time+=15000;act(()=>tick());assert.ok(screen.getByText("not due"),"hidden time does not count");
  visible="visible";focused=false;time+=15000;act(()=>tick());assert.ok(screen.getByText("not due"),"unfocused time does not count");
  focused=true;time+=120000;act(()=>tick());assert.ok(screen.getByText("not due"),"idle time does not count");
  fireEvent.pointerDown(window);time+=15000;act(()=>tick());assert.ok(screen.getByText("due"),"active focused work reaches the threshold");
  cleanup();window.setInterval=oldInterval;window.clearInterval=oldClear;if(ownNow)Object.defineProperty(performance,"now",ownNow);else delete performance.now;
  assert.equal(networkRequests,0);console.log("PASS: reminder excludes hidden, unfocused and idle time and counts only active work, offline");
}finally{rmSync(temporary,{recursive:true,force:true});dom.window.close();}
