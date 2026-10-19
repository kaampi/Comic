import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".storage-recovery-test-"));
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
  const React=await import("react"),{render,screen,within,waitFor,cleanup,fireEvent}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event");
  const moduleUrl=pathToFileURL(join(temporary,"projectDatabase.mjs")).href;
  const local=path=>import(pathToFileURL(join(temporary,path+".mjs")));
  const {createProject}=await local("project"),{parseAlbumBackup}=await local("albumBackup");
  Object.defineProperty(globalThis,"indexedDB",{value:new IDBFactory(),configurable:true});localStorage.clear();
  const tabA=await import(moduleUrl+"?tab-a"),tabB=await import(moduleUrl+"?tab-b");
  const project=createProject("Original synthetic album","blank");
  project.unplacedPanels=[{layer:{id:"pool-id",x:0,y:0,width:1,height:1,readingOrder:1,overlays:[],image:{name:"fixture",dataUrl:"data:image/png;base64,AAAA"}},sourceGrid:{gridColumns:3,gridRows:5}}];
  assert.deepEqual(await tabA.loadProjectCollection(),[]);await tabA.saveProjectCollection([project]);
  await tabB.loadProjectCollection();
  await tabA.saveProjectCollection([{...project,title:"New version from tab A"}]);
  await assert.rejects(tabB.saveProjectCollection([]),error=>error.failure.reason==="conflict","stale tab cannot erase the album collection");
  assert.equal((await tabA.loadProjectCollection())[0].title,"New version from tab A");
  await assert.rejects(tabB.saveProjectCollection([{...project,title:"Stale overwrite"}]),error=>error.failure.reason==="conflict");
  const tabC=await import(moduleUrl+"?unloaded-tab");
  await assert.rejects(tabC.saveProjectCollection([]),error=>error.failure.reason==="conflict","a new module cannot write to existing storage without loading it");
  const points=await tabA.listRecoveryPoints();assert.equal(points.length,1);
  assert.equal((await tabA.readRecoveryPoint(points[0].id))[0].title,project.title);
  assert.deepEqual((await tabA.readRecoveryPoint(points[0].id))[0].unplacedPanels,project.unplacedPanels);
  const beforeFailure=await tabA.listRecoveryPoints();const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){const request=put.apply(this,args);if(args[1]==="collection")this.transaction.abort();return request;};
  await assert.rejects(tabA.saveProjectCollection([]));IDBObjectStore.prototype.put=put;
  assert.deepEqual(await tabA.listRecoveryPoints(),beforeFailure,"aborted save cannot advance recovery history");
  assert.equal((await tabA.loadProjectCollection()).length,1);
  await tabA.saveProjectCollection([]);
  const deletedPoints=await tabA.listRecoveryPoints();assert.equal(deletedPoints.length,2);
  assert.equal((await tabA.readRecoveryPoint(deletedPoints[0].id))[0].title,"New version from tab A","deletion preserves the exact previous collection");
  for(let i=0;i<5;i++)await tabA.saveProjectCollection([{...project,id:`album-${i}`,title:`Version ${i}`}]);
  assert.equal((await tabA.listRecoveryPoints()).length,3,"history has a fixed disk bound");
  await tabB.loadProjectCollection();await tabB.saveProjectCollection([{...project,title:"Explicitly reloaded tab B"}]);
  assert.equal((await tabA.loadProjectCollection())[0].title,"Explicitly reloaded tab B");
  console.log("PASS: independent app modules share atomic conflict protection; failed writes preserve primary/history; deletion checkpoints retain complete albums; three-point bound and explicit reload recovery");

  const {App}=await local("App");localStorage.setItem("comicbook-ai.locale","en");
  const appUser=userEvent.setup({document});render(React.createElement(App));
  await appUser.click(await screen.findByRole("button",{name:/Explicitly reloaded tab B/}));
  await appUser.click(screen.getByRole("button",{name:/Open album for editing/}));
  await appUser.click(screen.getByRole("button",{name:"Album settings",exact:true}));
  await tabA.loadProjectCollection();await tabA.saveProjectCollection([{...project,title:"Newer external album"}]);
  fireEvent.change(screen.getByLabelText("Album title"),{target:{value:"Unsaved current tab"}});
  await waitFor(()=>assert.ok(screen.getAllByRole("alert").some(alert=>alert.textContent.includes("has not overwritten"))));
  assert.equal(screen.getByLabelText("Album title").value,"Unsaved current tab","conflict keeps unsaved user edits visible for backup");
  assert.equal((await tabA.loadProjectCollection())[0].title,"Newer external album");
  cleanup();console.log("PASS: real app surfaces save conflicts, preserves unsaved text and keeps the newer external album intact");

  // Downloading recovery data is read-only, including when the primary record is corrupt.
  const rawDb=await new Promise((resolve,reject)=>{const request=indexedDB.open("comicbook-ai.albums",1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  await new Promise((resolve,reject)=>{const tx=rawDb.transaction("snapshots","readwrite");tx.objectStore("snapshots").put("{broken","collection");tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});rawDb.close();
  await assert.rejects(tabA.loadProjectCollection());
  assert.ok((await tabA.listRecoveryPoints()).length>0,"checkpoints remain readable after primary corruption");
  const {LocalRecovery}=await local("LocalRecovery");
  const blobs=[];const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;URL.createObjectURL=blob=>{blobs.push(blob);return "blob:download-fixture";};URL.revokeObjectURL=()=>{};
  const originalClick=dom.window.HTMLAnchorElement.prototype.click;dom.window.HTMLAnchorElement.prototype.click=function(){};
  const user=userEvent.setup({document});render(React.createElement(LocalRecovery,{locale:"en"}));
  await waitFor(()=>assert.equal(screen.getAllByRole("button",{name:/View albums/}).length,3));
  await user.click(screen.getAllByRole("button",{name:/View albums/})[0]);
  await user.click(await screen.findByRole("button",{name:"Download album backup",exact:true}));
  assert.equal(blobs.length,1);const downloaded=parseAlbumBackup(JSON.parse(await blobs[0].text()));assert.ok(downloaded.id);assert.deepEqual(downloaded.unplacedPanels,project.unplacedPanels);
  await assert.rejects(tabA.loadProjectCollection(),undefined,"recovery download never replaces or clears the corrupt primary record");
  cleanup();URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;dom.window.HTMLAnchorElement.prototype.click=originalClick;
  localStorage.setItem("comicbook-ai.projects",JSON.stringify([project]));assert.ok((await tabA.listRecoveryPoints()).some(point=>point.id==="legacy-localStorage"));
  assert.equal((await tabA.readRecoveryPoint("legacy-localStorage"))[0].id,project.id);
  assert.equal(networkRequests,0);console.log("PASS: recovery download produces valid backups without overwriting current data; corrupt primary and surviving legacy storage remain recoverable offline");
} finally {rmSync(temporary,{recursive:true,force:true});dom.window.close();}
