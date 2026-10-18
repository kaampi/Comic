import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".panel-move-test-"));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:5176/" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent", "FileReader", "File", "HTMLInputElement", "SVGElement"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
class TestPointerEvent extends dom.window.MouseEvent {
  constructor(type, options={}) { super(type, options); this.pointerId=options.pointerId??1; this.isPrimary=options.isPrimary??true; }
}
dom.window.PointerEvent=TestPointerEvent;
Object.defineProperty(globalThis,"PointerEvent",{value:TestPointerEvent,configurable:true});
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
  const React = await import('react');
  const {render,screen,fireEvent,act,cleanup} = await import('@testing-library/react');
  const {default:userEvent} = await import('@testing-library/user-event');
  const {App} = await import(pathToFileURL(join(temporary,'App.mjs')));
  const {createProject,saveProjects} = await import(pathToFileURL(join(temporary,'project.mjs')));
  const {relocatePanel,panelMoveAllowed} = await import(pathToFileURL(join(temporary,'panelMove.mjs')));
  const {pageGridMetrics,albumPageFormat,layerRect} = await import(pathToFileURL(join(temporary,'pageFormat.mjs')));
  const {panelsOverlap} = await import(pathToFileURL(join(temporary,'panelGeometry.mjs')));
  const project = createProject('Panel move test','blank');
  project.typographyVersion=2;
  project.pageFormat={preset:'a4',orientation:'portrait',widthMm:210,heightMm:297,spacing:{topMm:12,rightMm:10,bottomMm:8,leftMm:15,columnGapMm:3,rowGapMm:4}};
  const text={id:'speech',type:'speech',text:'Keep everything',x:10,y:10,width:45,height:25,fontSize:10,rotation:0,strokeColor:'#171411',strokeWidth:2,fillColor:'#fffdf7',fillOpacity:1,tailEnabled:true,tailX:50,tailY:70,bubbleLinks:[{targetId:'next',startWidth:20,endWidth:30}]};
  const original={id:'moving',x:0,y:0,width:1,height:1,readingOrder:2,panelId:'panel-source',adaptationPanelPlanId:'source-plan',shapePoints:[{x:2,y:0},{x:4,y:2},{x:2,y:4},{x:0,y:2}],panelBorder:{color:'#ff0000',thicknessPt:2,visible:true},image:{name:'image.png',dataUrl:'data:image/png;base64,iVBORw0KGgo=',fit:'cover',positionMode:'frame',zoom:1.5,rotation:25,flipX:true,offsetX:12,offsetY:-8},overlays:[text,{...text,id:'next',x:40,bubbleLinks:undefined}]};
  const blocker={id:'blocker',x:2,y:0,width:1,height:1,readingOrder:1,overlays:[]};
  project.pages=[{id:'page',number:1,gridColumns:4,gridRows:4,placements:[original,blocker],foregrounds:[{id:'foreground',x:0,y:0,width:4,height:4,readingOrder:0,overlays:[]}]}, {id:'second',number:2,gridColumns:4,gridRows:4,placements:[]}];
  const moved=relocatePanel(project,'page','moving',1,1);
  assert.deepEqual(moved.pages[0].placements[0],{...original,x:1,y:1});
  assert.equal(moved.pages[0].placements[1],blocker);
  assert.equal(moved.pages[1],project.pages[1]);
  assert.equal(relocatePanel(project,'page','moving',-1,0),project);
  assert.equal(relocatePanel(project,'page','moving',2,0),project);
  assert.equal(relocatePanel(project,'page','moving',0.5,0),project);
  assert.equal(relocatePanel(project,'page','moving',NaN,0),project);
  assert.equal(relocatePanel(project,'page','moving',4,0),project);
  // Two convex forms may share grid bounding boxes, while their contours remain separated.
  const shapesPage={...project.pages[0],placements:[]};
  const upper={...blocker,x:1,y:1,shapePoints:[{x:0,y:0},{x:4,y:0},{x:0,y:1.5}]};
  const lower={...original,x:1,y:1,shapePoints:[{x:4,y:2.5},{x:4,y:4},{x:0,y:4}]};
  shapesPage.placements=[upper];
  assert.equal(panelsOverlap(shapesPage,upper,lower,albumPageFormat(project),project.panelBorderDefaults),false);
  assert.equal(panelMoveAllowed(project,shapesPage,lower),true,'use actual contour rather than bounding rectangles');
  const behind={...project.pages[0],background:{id:'bg',x:0,y:0,width:4,height:4,readingOrder:0,overlays:[{...text,x:0,y:0,width:100,height:100}]}};
  assert.equal(panelMoveAllowed(project,behind,{...original,x:1}),false,'respect reserved page background text');

  localStorage.clear(); localStorage.setItem('comicbook-ai.locale','en');saveProjects([project]);
  const current=()=>JSON.parse(localStorage.getItem('comicbook-ai.projects'))[0];
  const user=userEvent.setup({document});
  render(React.createElement(App));
  await user.click(screen.getByRole('button',{name:/Panel move test/}));
  await user.click(screen.getByRole('button',{name:'Pages',exact:true}));
  const panel=()=>document.querySelector('.drawn-panel[aria-label="Row 2"]')??document.querySelector('.drawn-panel');
  const grid=document.querySelector('.layout-panels');
  const metrics=pageGridMetrics(project.pages[0],albumPageFormat(project));
  const scale=0.75, width=metrics.width*scale,height=metrics.height*scale;
  grid.getBoundingClientRect=()=>({left:20,top:30,width,height,right:20+width,bottom:30+height});
  const stepX=(width+metrics.gapX*scale)/4,stepY=(height+metrics.gapY*scale)/4;
  const pause=ms=>act(()=>new Promise(resolve=>setTimeout(resolve,ms)));
  const down=(extra={})=>fireEvent.pointerDown(panel().querySelector('.panel-shape-fill polygon')??panel(),{button:0,clientX:100,clientY:100,pointerId:7,...extra});
  const move=(dx,dy,extra={})=>fireEvent.pointerMove(window,{clientX:100+dx*stepX,clientY:100+dy*stepY,pointerId:7,...extra});
  const up=(dx=0,dy=0)=>fireEvent.pointerUp(window,{clientX:100+dx*stepX,clientY:100+dy*stepY,pointerId:7});
  let saves=0;
  const originalSet=window.Storage.prototype.setItem;
  window.Storage.prototype.setItem=function(key,value){if(key==='comicbook-ai.projects')saves++;return originalSet.call(this,key,value);};
  const baseline=current().pages[0].placements;
  down(); await pause(100); up(); await pause(340);
  assert.equal(document.querySelector('.is-panel-moving'),null,'ordinary click never activates movement');
  assert.equal(saves,0);
  fireEvent.doubleClick(panel());
  assert.ok(document.querySelector('.panel-editor-modal'),'double click still opens editor');
  await user.click(document.querySelector('.panel-editor-header-actions button'));
  down(); move(0.2,0); await pause(440); up(0.2,0);
  assert.equal(document.querySelector('.is-panel-moving'),null,'movement before hold cancels activation');
  assert.equal(saves,0);
  down({button:2}); await pause(440); up();
  assert.equal(document.querySelector('.is-panel-moving'),null,'right click does not move');

  down(); await pause(440);
  assert.ok(panel().classList.contains('is-panel-moving'),'400ms hold lifts panel');
  move(1,1,{pointerId:8});
  assert.equal(panel().style.transform,'translate(0px, 0px)','ignore another pointer');
  move(1,1);
  assert.equal(panel().style.transform,`translate(${stepX}px, ${stepY}px)`,'snap with actual margins, gaps and display scale');
  assert.equal(saves,0,'preview never writes the album');
  const previewText=document.querySelector('.page-foreground-texts [data-text-layer="moving"]');
  assert.equal(Number(previewText.getAttribute('x')),layerRect(project.pages[0],{...original,x:1,y:1},albumPageFormat(project)).x+3,'panel text above foregrounds follows the preview');
  assert.deepEqual(current().pages[0].placements,baseline);
  up(1,1);
  assert.equal(saves,1,'commit once on release');
  assert.deepEqual(current().pages[0].placements[0],{...baseline[0],x:1,y:1},'all picture, text, link, shape and source metadata preserved');
  assert.deepEqual(current().pages[0].placements[1],baseline[1]);
  fireEvent.click(panel());fireEvent.doubleClick(panel());
  assert.equal(document.querySelector('.panel-editor-modal'),null,'release click does not open the editor');

  const checkpoint=JSON.stringify(current());
  down(); await pause(440);move(1,-1);
  assert.ok(panel().classList.contains('is-move-invalid'),'colliding contour is red');up(1,-1);
  assert.equal(JSON.stringify(current()),checkpoint,'invalid drop leaves original album untouched');
  assert.equal(saves,1);
  down();await pause(440);move(-3,0);
  assert.ok(panel().classList.contains('is-move-invalid'),'out of bounds preview is invalid');up(-3,0);
  assert.equal(JSON.stringify(current()),checkpoint);

  for(const cancel of [()=>fireEvent.keyDown(window,{key:'Escape'}),()=>fireEvent.pointerCancel(window,{pointerId:7}),()=>fireEvent.blur(window),()=>fireEvent.scroll(window),()=>fireEvent.resize(window)]) {
    down();await pause(440);move(0,1);cancel();
    assert.equal(document.querySelector('.is-panel-moving'),null);
    up(0,1);assert.equal(JSON.stringify(current()),checkpoint,'cancel leaves album untouched');
  }
  down();await pause(440);move(0,1);
  await user.click(screen.getByRole('switch',{name:'Free shape'}));
  assert.equal(document.querySelector('.is-panel-moving'),null,'changing mode cancels drag');up(0,1);
  down();await pause(440);assert.equal(document.querySelector('.is-panel-moving'),null,'shape editing uses corner tools immediately');up();
  await user.click(screen.getByRole('switch',{name:'Free shape'}));
  down();await pause(440);move(0,1);
  await user.click(screen.getByRole('button',{name:'Next page',exact:true}));
  assert.equal(document.querySelector('.is-panel-moving'),null,'page navigation cancels drag');up(0,1);
  assert.equal(JSON.stringify(current()),checkpoint);
  assert.equal(saves,1);
  await user.click(screen.getByRole('button',{name:'Previous page',exact:true}));
  const restoredGrid=document.querySelector('.layout-panels');
  restoredGrid.getBoundingClientRect=grid.getBoundingClientRect;
  down();await pause(440);move(0,1);
  assert.ok(document.querySelector('.is-panel-moving'));
  cleanup();up(0,1);
  assert.equal(JSON.stringify(current()),checkpoint,'unmount during drag does not save');
  assert.equal(saves,1);
  assert.equal(networkRequests,0);
  window.Storage.prototype.setItem=originalSet;
  cleanup();
  console.log('PASS: hold threshold, click/double click, early motion, shaped contours, scaled grid snapping, preview without saves, single commit with content intact, invalid drops and cancellation');
} finally {
  rmSync(temporary,{recursive:true,force:true});dom.window.close();
}
