import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".library-drop-test-"));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:5176/" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.DragEvent = window.MouseEvent;
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
  const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { App } = await import(pathToFileURL(join(temporary, "App.mjs")));
  const { createProject, saveProjects } = await import(pathToFileURL(join(temporary, "project.mjs")));
  const { libraryDropTarget, dropLibraryPanel, undoLibraryDrop, LIBRARY_DRAG_TYPE } = await import(pathToFileURL(join(temporary, "libraryDrop.mjs")));
  const { packAlbumBackup, parseAlbumBackup } = await import(pathToFileURL(join(temporary, "albumBackup.mjs")));
  const image = name => ({name, dataUrl:"data:image/png;base64,iVBORw0KGgo=",zoom:1,offsetX:0,offsetY:0,fit:"cover"});
  const project = createProject("Drag fixture", "blank");
  project.typographyVersion=2;
  project.panels = ["old","new","third"].map((id,index)=>({id,sceneId:"scene",order:index+1,action:"Image "+id,dialogue:"Hello "+id,narration:"",imagePrompt:"",characterIds:[],image:image(id)}));
  const original={id:"diamond",panelId:"old",x:0,y:0,width:2,height:2,readingOrder:1,shapePoints:[{x:2,y:0},{x:4,y:2},{x:2,y:4},{x:0,y:2}],panelBorder:{color:"#ff0000",thicknessPt:2,visible:true},image:image("old"),overlays:[{id:"authored",type:"speech",text:"Keep this text",x:10,y:10,width:40,height:24,rotation:0,fontSize:8}]};
  project.pages=[{id:"page",number:1,gridColumns:3,gridRows:3,placements:[original]}];
  const grid={width:680,height:680,gapX:6,gapY:6};
  assert.deepEqual(libraryDropTarget(project,"page",225,225,grid),{kind:"frame",placementId:"diamond"});
  assert.equal(libraryDropTarget(project,"page",5,5,grid),null,"clipped corner cannot receive an overlapping new frame");
  assert.equal(libraryDropTarget(project,"page",679,225,{...grid,width:0}),null);
  assert.equal(libraryDropTarget(project,"page",-1,20,grid),null);
  assert.equal(libraryDropTarget(project,"page",224,600,grid),null,"gap is not a cell");
  assert.deepEqual(libraryDropTarget(project,"page",568,568,grid),{kind:"new",x:2,y:2});
  const replacement=dropLibraryPanel(project,"page",{kind:"frame",placementId:"diamond"},"new");
  assert.equal(replacement.project.pages[0].placements[0].image.name,"new");
  assert.deepEqual(replacement.project.pages[0].placements[0].overlays,original.overlays);
  assert.deepEqual(replacement.project.pages[0].placements[0].shapePoints,original.shapePoints);
  assert.deepEqual(replacement.project.pages[0].placements[0].panelBorder,original.panelBorder);
  assert.deepEqual(undoLibraryDrop(replacement.project,replacement.undo),project);
  assert.equal(dropLibraryPanel(project,"page",{kind:"new",x:2,y:2},"old"),null,"placed source cannot be duplicated");
  assert.equal(dropLibraryPanel(project,"page",{kind:"new",x:0,y:0},"new"),null,"overlap rejected");
  assert.equal(dropLibraryPanel(project,"page",{kind:"frame",placementId:"missing"},"new"),null);
  const created=dropLibraryPanel(project,"page",{kind:"new",x:2,y:2},"new");
  const newFrame=created.project.pages[0].placements[1];
  assert.equal(newFrame.width,1);assert.equal(newFrame.height,1);assert.equal(newFrame.readingOrder,2);
  assert.ok(newFrame.overlays.some(overlay=>overlay.text==="Hello new"));
  assert.deepEqual(undoLibraryDrop(created.project,created.undo),project);
  assert.deepEqual(parseAlbumBackup(packAlbumBackup(created.project)).pages,created.project.pages);
  const laterEdit={...replacement.project,pages:replacement.project.pages.map(page=>({...page,placements:page.placements.map(layer=>({...layer,overlays:[]}))}))};
  assert.equal(undoLibraryDrop(laterEdit,replacement.undo),laterEdit,"undo cannot overwrite a later edit");

  localStorage.clear();localStorage.setItem("comicbook-ai.locale","sv");saveProjects([project]);
  const user=userEvent.setup({document});render(React.createElement(App));
  await user.click(screen.getByRole("button",{name:/Drag fixture/}));
  await user.click(screen.getByRole("button",{name:/Öppna album för redigering/}));
  await user.click(screen.getByRole("button",{name:"Sidor",exact:true}));
  const canvas=document.querySelector(".layout-canvas"), layout=document.querySelector(".layout-panels");
  layout.getBoundingClientRect=()=>({left:10,top:10,width:680,height:680,right:690,bottom:690});
  const saved=()=>JSON.parse(localStorage.getItem("comicbook-ai.projects"))[0];
  const start=id=>{
    const values=new Map();
    const transfer={types:[LIBRARY_DRAG_TYPE],effectAllowed:"",dropEffect:"",setData:(type,value)=>values.set(type,value),getData:type=>values.get(type)||""};
    const card=document.querySelector('[data-panel-id="'+id+'"]');assert.equal(card.disabled,false);assert.equal(card.draggable,true);
    fireEvent.dragStart(card,{dataTransfer:transfer});return {card,transfer};
  };
  const hover=(transfer,x,y)=>fireEvent.dragOver(canvas,{dataTransfer:transfer,clientX:x+10,clientY:y+10});
  const drop=(transfer,x,y)=>fireEvent.drop(canvas,{dataTransfer:transfer,clientX:x+10,clientY:y+10});
  let drag=start("new");hover(drag.transfer,225,225);
  assert.ok(document.querySelector(".library-drop-outline polygon"));assert.equal(drag.transfer.dropEffect,"copy");
  drop(drag.transfer,225,225);
  assert.equal(saved().pages[0].placements[0].image.name,"new");
  assert.equal(saved().pages[0].placements[0].overlays[0].text,"Keep this text");
  assert.equal(document.querySelector(".library-drop-outline"),null);
  await user.click(screen.getByRole("button",{name:"Ångra bildplacering"}));
  assert.equal(saved().pages[0].placements[0].image.name,"old");
  drag=start("new");hover(drag.transfer,568,568);
  assert.ok(document.querySelector(".library-drop-new"));drop(drag.transfer,568,568);
  assert.equal(saved().pages[0].placements.length,2);assert.equal(saved().pages[0].placements[1].image.name,"new");
  assert.equal(document.querySelector('[data-panel-id="new"]').disabled,true);
  await user.click(screen.getByRole("button",{name:"Ångra bildplacering"}));
  assert.equal(saved().pages[0].placements.length,1);
  drag=start("new");hover(drag.transfer,5,5);
  assert.equal(document.querySelector(".library-drop-new"),null);assert.equal(drag.transfer.dropEffect,"none");
  drop(drag.transfer,5,5);assert.equal(saved().pages[0].placements.length,1);
  drag=start("new");hover(drag.transfer,568,568);await user.keyboard("{Escape}");
  assert.equal(document.querySelector(".library-drop-new"),null);drop(drag.transfer,568,568);assert.equal(saved().pages[0].placements.length,1);
  drag=start("new");hover(drag.transfer,568,568);fireEvent.dragLeave(canvas,{dataTransfer:drag.transfer,relatedTarget:null});
  assert.equal(document.querySelector(".library-drop-new"),null);
  fireEvent.dragEnd(drag.card,{dataTransfer:drag.transfer});
  cleanup();
  console.log("PASS: library drag/drop, shaped hover, new grid frame, replacement, undo, backup, cancellation and overlap/duplicate rejection");
} finally {
  rmSync(temporary,{recursive:true,force:true});dom.window.close();
}

