import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".panel-pool-test-"));
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
  const React=await import("react");
  const {render,screen,within,fireEvent,waitFor,cleanup}=await import("@testing-library/react");
  const {default:userEvent}=await import("@testing-library/user-event");
  const local=path=>import(pathToFileURL(join(temporary,path+".mjs")));
  const pool=await local("panelPool"),{createProject}=await local("project");
  const {parseAlbumBackup,packAlbumBackup}=await local("albumBackup"),{checkExport}=await local("exportPreflight");
  const {assignLibraryPanel,libraryEntries}=await local("comicPanelLibrary");
  const {pageSvg}=await local("albumExport");
  const project=createProject("Panel pool fixture","blank");project.pageDefaults={gridColumns:2,gridRows:2};
  const image={name:"synthetic.png",dataUrl:"data:image/png;base64,AAAA",zoom:1.7,rotation:13,offsetX:20,offsetY:-10,positionMode:"frame",fit:"contain"};
  const speech={id:"speech-a",type:"speech",text:"Pool-only dialogue",x:5,y:8,width:35,height:25,rotation:11,fontSize:6,tailEnabled:true,tailX:23,tailY:47,tailRootWidth:30,bubbleLinks:[{targetId:"speech-b",width:15,startWidth:10,endWidth:30,startControl:{along:.3,across:.15}}],textStyles:[{start:0,end:4,fontSize:9,fontWeight:700}]};
  const speechB={...speech,id:"speech-b",text:"Reply",x:55,bubbleLinks:undefined,textStyles:undefined};
  const layers=Array.from({length:4},(_,i)=>({id:`layer-${i}`,x:i%2,y:Math.floor(i/2),width:1,height:1,readingOrder:i+1,overlays:i===0?[speech,speechB]:[],image:i===0?image:undefined,shapePoints:i===0?[{x:0,y:0},{x:4,y:0},{x:3.5,y:4},{x:0,y:4}]:undefined,panelId:i===0?"script-panel":undefined,sourceBeatIds:["beat-source"]}));
  const page1={id:"page-1",number:1,gridColumns:2,gridRows:2,placements:layers};
  const page2={id:"page-2",number:2,gridColumns:2,gridRows:2,placements:[{id:"full",x:0,y:0,width:2,height:2,readingOrder:1,overlays:[]}]};
  project.pages=[page1,page2];project.panels=[{id:"script-panel",sceneId:"scene",order:1,action:"Fixture",dialogue:"",narration:"",imagePrompt:"",characterIds:[],image}];
  const selected=layers.map(layer=>({pageId:page1.id,layerId:layer.id}));
  const snapshot=JSON.stringify(project);
  const parked=pool.parkPanels(project,selected,page2.id);
  assert.equal(parked.pages[0].placements.length,0);assert.deepEqual(parked.pages[1],page2);assert.equal(parked.unplacedPanels.length,4);
  assert.deepEqual(parked.unplacedPanels[0].layer,layers[0],"image, crop, rich text, tails, connections, free shape and source links remain exact");
  assert.equal(JSON.stringify(project),snapshot,"parking never changes the input album");
  assert.equal(pool.parkPanels(parked,selected,page2.id),parked,"repeated moves cannot duplicate layers");
  assert.equal(pool.parkPanels(project,selected,"missing"),project);
  assert.equal(pool.placePooledPanel(parked,"layer-0",page2.id,0,0),parked,"full page keeps the panel waiting");
  assert.equal(pool.placePooledPanel(parked,"layer-0",page1.id,-1,0),parked);
  assert.equal(pool.placePooledPanel(parked,"layer-0",page1.id,2,0),parked);
  const placed=pool.placePooledPanel(parked,"layer-0",page1.id,1,1);
  assert.equal(placed.unplacedPanels.length,3);assert.equal(placed.pages[0].placements[0].id,"layer-0");
  assert.deepEqual({...placed.pages[0].placements[0],x:0,y:0},layers[0]);
  assert.equal(pool.placePooledPanel(placed,"layer-0",page1.id,0,0),placed,"already placed layers cannot be placed again");
  const wider={...parked,unplacedPanels:[{...parked.unplacedPanels[0],layer:{...layers[0],width:3}}]};
  assert.equal(pool.placePooledPanel(wider,"layer-0",page1.id,0,0),wider,"oversized panels wait for a suitable grid");
  const background={...parked,pages:parked.pages.map(page=>page.id!==page1.id?page:{...page,background:{id:"bg",x:0,y:0,width:2,height:2,readingOrder:0,overlays:[{...speech,bubbleLinks:undefined,textStyles:undefined,x:0,y:0,width:100,height:100}]}})};
  assert.equal(pool.placePooledPanel(background,"layer-0",page1.id,0,0),background,"reserved background text blocks placement");
  const undo=pool.poolUndo(project,parked);assert.ok(pool.canUndoPool(parked,undo));assert.equal(JSON.stringify(pool.undoPool(parked,undo)),JSON.stringify(project));
  assert.ok(!pool.canUndoPool(placed,undo));assert.equal(pool.undoPool(placed,undo),placed,"undo never overwrites later panel changes");
  assert.equal(pool.undoPool({...parked,title:"New title"},undo).title,"New title","unrelated metadata survives undo");
  const retargeted=pool.retargetPooledPanel(parked,"layer-0");assert.equal(retargeted.unplacedPanels[0].targetPageId,undefined);
  assert.equal(pool.retargetPooledPanel(parked,"layer-0","missing"),parked);
  const deletedPage=pool.deletePageToPool(parked,page2.id);assert.equal(deletedPage.pages.length,1);assert.equal(deletedPage.unplacedPanels.length,5);assert.ok(deletedPage.unplacedPanels.every(item=>!item.targetPageId));
  const restored=parseAlbumBackup(packAlbumBackup(parked));assert.deepEqual(restored.unplacedPanels,parked.unplacedPanels,"all held content survives backup");
  for(const mutate of [p=>p.unplacedPanels.push(p.unplacedPanels[0]),p=>p.unplacedPanels[0].targetPageId="missing",p=>p.unplacedPanels[0].sourceGrid.gridColumns=0,p=>p.unplacedPanels[0].layer.overlays[0].bubbleLinks[0].targetId="missing",p=>p.unplacedPanels[0].layer.id="full"]){const bad=structuredClone(parked);mutate(bad);assert.throws(()=>parseAlbumBackup(packAlbumBackup(bad)),/invalid-backup/);}
  assert.equal(libraryEntries(parked)[0].parked,true);assert.equal(assignLibraryPanel(parked,page2.id,"full","script-panel"),parked,"image library cannot recreate a panel that is in the pool");
  const options={format:"png",pageIds:[page2.id],pageFormat:project.pageFormat,dpi:300,fit:"contain",jpegQuality:.95};
  const issues=await checkExport(parked,options,undefined,async()=>{throw new Error("held images must not be decoded");});
  assert.equal(issues.filter(issue=>issue.kind==="unplaced-panel").length,4);
  assert.equal((await checkExport(parked,{...options,pageIds:[page1.id]},undefined,async()=>({width:4000,height:4000}))).filter(issue=>issue.kind==="unplaced-panel").length,0,"waiting panels follow the export page selection");
  assert.ok(!(await pageSvg(parked,parked.pages[1],"",1)).includes("Pool-only dialogue"),"held panels never enter page export");
  console.log("PASS: batch moves to full pages, stable complete panels, invalid/occupied/background placement, source immutability, duplicates, retargeting, page deletion, safe undo, backup validation, library guard and export exclusion/warnings");

  const {App}=await local("App");localStorage.clear();localStorage.setItem("comicbook-ai.locale","en");localStorage.setItem("comicbook-ai.projects",JSON.stringify([project]));
  const user=userEvent.setup({document});const stored=()=>JSON.parse(localStorage.getItem("comicbook-ai.projects"))[0];
  render(React.createElement(App));await user.click(screen.getByRole("button",{name:/Panel pool fixture/}));await user.click(screen.getByRole("button",{name:/Open album for editing/}));await user.click(screen.getByRole("button",{name:"Pages",exact:true}));
  await user.click(screen.getByText("Move / lift panels from this page"));
  const organizer=document.querySelector(".pool-organize");
  for(const label of ["Panel 1","Panel 2","Panel 3","Panel 4"])await user.click(within(organizer).getByLabelText(label,{exact:true}));
  await user.click(screen.getByRole("button",{name:"Move selected…"}));
  const dialog=screen.getByRole("dialog",{name:"Move panels (4)"});
  await user.selectOptions(within(dialog).getByLabelText("Destination"),page2.id);
  await user.click(within(dialog).getByRole("button",{name:"Cancel",exact:true}));assert.equal(stored().unplacedPanels,undefined,"cancelled transfer saves nothing");
  await user.click(screen.getByRole("button",{name:"Move selected…"}));
  await user.selectOptions(screen.getByLabelText("Destination"),page2.id);await user.click(screen.getByRole("button",{name:"Move panels",exact:true}));
  assert.equal(stored().pages[0].placements.length,0);assert.equal(stored().pages[1].placements.length,1);assert.equal(stored().unplacedPanels.length,4);
  assert.ok(screen.getByText("Waiting for placement · 2 (4)"));
  assert.equal(document.querySelectorAll(".pool-item").length,4);assert.equal(document.querySelectorAll(".drawn-panel").length,1);
  await user.click(screen.getByRole("button",{name:"Undo panel change",exact:true}));assert.equal(stored().pages[0].placements.length,4);assert.equal(stored().unplacedPanels,undefined);
  // Move one panel to a new page, then place it via keyboard-accessible coordinates.
  await user.click(screen.getByRole("button",{name:/Previous page/}));
  fireEvent.contextMenu(document.querySelector(".drawn-panel"),{clientX:100,clientY:100});
  await user.click(screen.getByRole("button",{name:"Move to another page…",exact:true}));
  await user.selectOptions(screen.getByLabelText("Destination"),"__new__");await user.click(screen.getByRole("button",{name:"Move panels",exact:true}));
  assert.equal(stored().pages.length,3);assert.equal(stored().unplacedPanels.length,1);const newId=stored().pages[2].id;
  await user.click(screen.getByRole("button",{name:"Place on page",exact:true}));
  assert.equal(stored().unplacedPanels.length,0);assert.equal(stored().pages[2].placements[0].id,"layer-0");assert.deepEqual(stored().pages[2].placements[0].image,image);
  // Lift to album pool and drop onto a precise free cell using the same drag path as the browser.
  await user.click(screen.getByRole("button",{name:"Reading order",exact:true}));
  await user.click(screen.getByRole("button",{name:"Lift from page",exact:true}));
  await user.click(screen.getByRole("button",{name:"Image library",exact:true}));
  const data={types:[],values:{},setData(type,value){this.types.push(type);this.values[type]=value;},getData(type){return this.values[type]??"";}};
  fireEvent.dragStart(document.querySelector(".pool-drag"),{dataTransfer:data});
  const grid=document.querySelector(".layout-panels");grid.getBoundingClientRect=()=>({left:0,top:0,width:680,height:970,right:680,bottom:970});
  const canvas=document.querySelector(".layout-canvas");
  const drag=type=>{const event=new dom.window.Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{dataTransfer:{value:data},clientX:{value:400},clientY:{value:500}});fireEvent(canvas,event);};drag("dragover");
  assert.ok(document.querySelector(".pool-drop-preview"));
  drag("drop");
  assert.equal(stored().unplacedPanels.length,0);assert.equal(stored().pages[2].placements[0].id,"layer-0");
  assert.equal(stored().pages[2].placements[0].x,1);assert.equal(stored().pages[2].placements[0].y,1);
  assert.equal(stored().pages[2].id,newId);assert.equal(networkRequests,0);
  cleanup();console.log("PASS: real-app multi-select/cancel/full-page waiting, destination navigation, undo, new-page transfer, coordinate placement and native drag/drop with preserved images/text");
}finally{rmSync(temporary,{recursive:true,force:true});dom.window.close();}
