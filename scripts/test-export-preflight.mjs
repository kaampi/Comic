import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".export-preflight-test-"));
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
  const {checkExport,textOverflows,readImageSize}=await local("exportPreflight");
  const {AlbumExportPanel}=await local("AlbumExportPanel");
  const {createProject}=await local("project");
  const project=createProject("Synthetic export checks","blank");
  project.pageFormat={preset:"custom",orientation:"portrait",widthMm:210,heightMm:210};
  const overlay={id:"text",type:"caption",text:"Hi",x:10,y:10,width:50,height:30,rotation:0,fontSize:8};
  const layer={id:"frame",x:0,y:0,width:1,height:1,readingOrder:1,overlays:[overlay]};
  const page={id:"page",number:1,gridColumns:1,gridRows:1,placements:[layer]};project.pages=[page];
  const options={format:"png",pageIds:[page.id],pageFormat:project.pageFormat,dpi:300,fit:"contain",jpegQuality:.95};
  const image={name:"synthetic.png",dataUrl:"data:image/png;base64,AAAA",zoom:1,offsetX:0,offsetY:0,fit:"cover"};
  let decodes=0;const size=async()=>{decodes++;return {width:700,height:700};};
  const snapshot=JSON.stringify(project);
  const missing=await checkExport(project,options,undefined,size);
  assert.deepEqual(missing.map(i=>[i.kind,i.layerId,i.severity]),[["empty-image","frame","warning"]]);
  assert.equal(decodes,0);
  assert.equal(textOverflows({...overlay,text:"Line\n".repeat(20)},{width:100,height:100,pageWidthMm:210}),true);
  assert.equal(textOverflows({...overlay,text:"Hi",textStyles:[{start:0,end:2,fontSize:100}]},{width:100,height:100,pageWidthMm:210}),true,"mixed typography uses the tallest actual row");
  assert.equal(textOverflows({...overlay,text:"Hi",width:1},{width:100,height:100,pageWidthMm:210}),true,"a glyph wider than the available line is reported");
  assert.equal(textOverflows({...overlay,text:" ",height:0},{width:100,height:100,pageWidthMm:210}),false);
  assert.equal(textOverflows({...overlay,type:"sfx",sfxTextHidden:true,fontSize:100},{width:100,height:100,pageWidthMm:210}),false);
  assert.equal(textOverflows(overlay,{width:674,height:674,pageWidthMm:210}),false);
  const illustrated={...project,pages:[{...page,placements:[{...layer,image}]}]};
  const low=await checkExport(illustrated,options,undefined,size);
  assert.equal(low[0].kind,"low-resolution");assert.equal(low[0].dpi,88,"700 pixels over the actual 202.2mm frame gives about 88dpi");
  const zoomed=structuredClone(illustrated);zoomed.pages[0].placements[0].image.zoom=2;
  assert.equal((await checkExport(zoomed,options,undefined,size))[0].dpi,44,"zoom halves effective density");
  zoomed.pages[0].placements[0].image.rotation=67;zoomed.pages[0].placements[0].image.flipX=true;
  assert.equal((await checkExport(zoomed,options,undefined,size))[0].dpi,44,"rotation and flipping preserve density");
  assert.equal((await checkExport(illustrated,{...options,dpi:600},undefined,size))[0].dpi,88,"higher raster export DPI adds no original image detail");
  const small={...options,pageFormat:{...project.pageFormat,widthMm:52.5,heightMm:52.5}};
  assert.equal((await checkExport(illustrated,small,undefined,size)).length,0,"a small print can have enough pixels");
  const wide={...options,pageFormat:{...project.pageFormat,heightMm:105}};
  assert.equal((await checkExport(illustrated,wide,undefined,size))[0].dpi,176);
  assert.equal((await checkExport(illustrated,{...wide,fit:"cover"},undefined,size))[0].dpi,88,"cover and contain use their actual physical scale");
  const high=async()=>({width:4000,height:4000});
  assert.equal((await checkExport(illustrated,options,undefined,high)).length,0);
  const bad=await checkExport(illustrated,options,undefined,async()=>{throw new Error("bad image");});
  assert.equal(bad[0].kind,"unreadable-image");assert.equal(bad[0].severity,"error");
  const external=structuredClone(illustrated);external.pages[0].placements[0].image.dataUrl="https://example.com/image.png";
  decodes=0;assert.equal((await checkExport(external,options,undefined,size))[0].kind,"unreadable-image");assert.equal(decodes,0,"external image URLs are not fetched");
  await assert.rejects(readImageSize("https://example.com/image.png"),/unreadable-image/);
  const vector=structuredClone(illustrated);vector.pages[0].placements[0].image.dataUrl="data:image/svg+xml;base64,AAAA";
  assert.equal((await checkExport(vector,options,undefined,size)).length,0,"vector images have no raster density warning");
  const layers=structuredClone(illustrated);layers.pages[0].background={...layer,id:"bg",overlays:[],image};layers.pages[0].foregrounds=[{...layer,id:"fg",overlays:[],image}];
  decodes=0;const allLayers=await checkExport(layers,options,undefined,size);assert.equal(decodes,1,"shared images decode only once per check");
  assert.deepEqual(new Set(allLayers.map(i=>i.layerKind)),new Set(["panel","background","foreground"]));
  const textOnly=structuredClone(project);textOnly.pages[0].placements=[];textOnly.pages[0].foregrounds=[{...layer,id:"text-only",overlays:[{...overlay,fontSize:600}]}];
  assert.deepEqual((await checkExport(textOnly,options,undefined,size)).map(i=>i.kind),["text-overflow"],"text-only page layers do not need images");
  const unselected=await checkExport({...project,pages:[page,{...page,id:"unselected",number:2}]},{...options,pageIds:["unselected"]},undefined,size);
  assert.ok(unselected.every(i=>i.pageId==="unselected"));
  const controller=new AbortController();controller.abort();await assert.rejects(checkExport(project,options,controller.signal,size),{name:"AbortError"});
  assert.equal(JSON.stringify(project),snapshot,"checks never change images, source, text or layout");
  console.log("PASS: actual print density, cover/contain, zoom/rotation, mixed text overflow, page-wide layers, unreadable/local/vector images, selection, decode reuse, cancellation and immutable project");

  let pending=[];
  globalThis.Image=class{
    naturalWidth=4000;naturalHeight=4000;
    set src(value){if(!value)return;pending.push(()=>{if(value.includes("BROKEN"))this.onerror?.();else this.onload?.();});}
  };
  const user=userEvent.setup({document});let inspected;
  const view=render(React.createElement(AlbumExportPanel,{project:illustrated,locale:"en",onInspect:issue=>{inspected=issue;}}));
  const download=()=>screen.getByRole("button",{name:"Download export",exact:true});
  assert.equal(download().disabled,true,"export waits for the current image check");
  assert.ok(screen.getByText("Checking text and images…"));
  for(const finish of pending.splice(0))finish();
  await waitFor(()=>assert.equal(download().disabled,false));
  assert.ok(screen.getByText("No issues found on the selected pages."));
  view.rerender(React.createElement(AlbumExportPanel,{project:external,locale:"en",onInspect:issue=>{inspected=issue;}}));
  await waitFor(()=>assert.ok(screen.getByText(/The image cannot be read/)));
  assert.equal(download().disabled,true,"unreadable images block an export that would fail");
  await user.click(screen.getByRole("button",{name:"Show",exact:true}));assert.equal(inspected.layerId,"frame");assert.equal(inspected.pageId,"page");
  view.rerender(React.createElement(AlbumExportPanel,{project,locale:"en",onInspect:issue=>{inspected=issue;}}));
  await waitFor(()=>assert.equal(download().disabled,false));
  assert.ok(screen.getByText(/This frame has no image/));
  await user.click(screen.getByLabelText("Page 1"));
  await waitFor(()=>assert.equal(download().disabled,true));
  assert.equal(screen.queryByText(/This frame has no image/),null,"deselected pages remove their warnings");
  cleanup();
  const stale=render(React.createElement(AlbumExportPanel,{project:illustrated,locale:"en"}));
  assert.equal(download().disabled,true);
  stale.rerender(React.createElement(AlbumExportPanel,{project:external,locale:"en"}));
  for(const finish of pending.splice(0))finish();
  await waitFor(()=>assert.ok(screen.getByText(/The image cannot be read/)));
  assert.equal(download().disabled,true,"late results cannot replace a newer blocked report");
  cleanup();
  const {App}=await local("App");
  const appProject=structuredClone(project);appProject.pages[0].placements[0].overlays[0].fontSize=600;
  localStorage.clear();localStorage.setItem("comicbook-ai.locale","en");localStorage.setItem("comicbook-ai.projects",JSON.stringify([appProject]));
  render(React.createElement(App));
  await user.click(screen.getByRole("button",{name:/Synthetic export checks/}));
  await user.click(screen.getByRole("button",{name:/Open album for editing/}));
  await user.click(screen.getByRole("button",{name:"Export",exact:true}));
  await waitFor(()=>assert.ok(screen.getByText(/Text may not fit its text box/)));
  const issueItem=screen.getByText(/Text may not fit its text box/).closest("li");
  await user.click(within(issueItem).getByRole("button",{name:"Show",exact:true}));
  assert.ok(document.querySelector(".panel-editor-modal"),"Show opens the actual panel editor");
  assert.ok(document.querySelector(".editable-overlay.is-selected"),"the reported text is selected for correction");
  assert.equal(screen.queryByRole("dialog",{name:"Export",exact:true}),null,"navigation closes export");
  assert.deepEqual(JSON.parse(localStorage.getItem("comicbook-ai.projects"))[0],JSON.parse(JSON.stringify(appProject)),"navigating to a warning does not alter the project");
  cleanup();
  assert.equal(networkRequests,0);
  console.log("PASS: current-result gating, warning-only draft exports, blocking broken images, navigation targets, page deselection, stale-result cancellation and zero network access");
} finally {rmSync(temporary,{recursive:true,force:true});dom.window.close();}
