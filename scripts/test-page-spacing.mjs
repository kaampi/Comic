import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";
const root=fileURLToPath(new URL("../",import.meta.url)),temporary=mkdtempSync(join(root,".page-spacing-test-"));
const dom=new JSDOM("<!doctype html><html><body></body></html>",{url:"http://localhost:5176/"});
for(const key of ["window","document","navigator","localStorage","HTMLElement","Node","Event","MouseEvent"])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let requests=0;globalThis.fetch=async()=>{requests++;throw new Error("offline");};
symlinkSync(join(root,"node_modules"),join(temporary,"node_modules"),process.platform==="win32"?"junction":"dir");
function compile(directory="") {
  for(const entry of readdirSync(join(root,"src",directory),{withFileTypes:true})) {
    const path=join(directory,entry.name);if(entry.isDirectory()){compile(path);continue;}if(!/\.tsx?$/.test(entry.name)||entry.name==="main.tsx")continue;
    const output=ts.transpileModule(readFileSync(join(root,"src",path),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/import "[^"\n]+\.css";?/g,"").replace(/from "(\.[^"]+)"/g,(_,imported)=>imported.endsWith(".json")?'from "'+pathToFileURL(resolve(root,"src",dirname(path),imported))+'" with { type: "json" }':'from "'+imported+'.mjs"');
    mkdirSync(join(temporary,directory),{recursive:true});writeFileSync(join(temporary,path.replace(/\.tsx?$/,".mjs")),output);
  }
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
try {
  compile();const load=name=>import(pathToFileURL(join(temporary,name+".mjs")));
  const f=await load("pageFormat"),{createProject,saveProjects,readProjects}=await load("project"),{packAlbumBackup,parseAlbumBackup}=await load("albumBackup");
  const {pageSvg}=await load("albumExport"),{pageLayerTextMetrics,overlayTextLayout}=await load("pageTypography"),{libraryDropTarget}=await load("libraryDrop");
  const page={id:"page",number:1,gridColumns:3,gridRows:5,placements:[]},layer={id:"frame",x:0,y:0,width:1,height:1,readingOrder:1,overlays:[{id:"text",type:"caption",text:"Preserve",x:10,y:10,width:70,height:25,rotation:0,fontSize:12}]};
  const old=f.layerRect(page,layer,f.DEFAULT_PAGE_FORMAT);assert.equal(old.x,10);assert.equal(old.y,10);close(old.width,(700-20-12)/3);
  const spacing={topMm:12,rightMm:18,bottomMm:20,leftMm:10,columnGapMm:4,rowGapMm:6};
  const format={...f.DEFAULT_PAGE_FORMAT,spacing},r=f.layerRect(page,layer,format),mm=210/700;
  close(r.x*mm,10);close(r.y*mm,12);close(r.width*mm,(210-10-18-8)/3);close(r.height*mm,(297-12-20-24)/5);
  const next=f.layerRect(page,{...layer,x:1,y:1},format);close((next.x-r.x-r.width)*mm,4);close((next.y-r.y-r.height)*mm,6);
  const span=f.layerRect(page,{...layer,width:3,height:5},format);close((span.x+span.width)*mm,210-18);close((span.y+span.height)*mm,297-20);
  assert.equal(f.spacingFitsAlbum(format,[page]),true);
  for(const value of [NaN,Infinity,-1])assert.equal(f.validPageFormat({...format,spacing:{...spacing,leftMm:value}}),false);
  assert.equal(f.spacingFitsAlbum({...format,spacing:{...spacing,columnGapMm:100}},[page]),false);
  assert.equal(f.spacingFitsAlbum({...format,spacing:{...spacing,topMm:200,bottomMm:200}},[page]),false);
  const zero={...format,spacing:{topMm:0,rightMm:0,bottomMm:0,leftMm:0,columnGapMm:0,rowGapMm:0}};
  assert.equal(f.spacingFitsAlbum(zero,[page]),true);const zr=f.layerRect(page,layer,zero);assert.equal(zr.x,0);assert.equal(zr.y,0);close(zr.width,700/3);
  const landscape={...format,orientation:"landscape"},lr=f.layerRect(page,layer,landscape);close(lr.x*297/700,10);close(lr.y*297/700,12);
  const css=f.pageGridStyle(format);close(parseFloat(css["--page-grid-top"])/100*210,12);close(parseFloat(css["--page-grid-row-gap"])/100*210,6);
  const project=createProject("Spacing fixture","blank");project.pages=[{...page,background:{...layer,id:"background",overlays:[]},placements:[layer]}];project.pageFormat=format;
  const snapshot=JSON.stringify(project),restored=parseAlbumBackup(packAlbumBackup(project));assert.deepEqual(restored.pageFormat.spacing,spacing);assert.equal(JSON.stringify(project),snapshot);
  assert.throws(()=>parseAlbumBackup(packAlbumBackup({...project,pageFormat:{...format,spacing:{...spacing,leftMm:300}}})),/invalid-backup/);
  saveProjects([project]);assert.deepEqual(readProjects()[0].pageFormat.spacing,spacing);
  const unspaced={...project,pageFormat:f.DEFAULT_PAGE_FORMAT},metrics=pageLayerTextMetrics(project,project.pages[0],layer),oldMetrics=pageLayerTextMetrics(unspaced,project.pages[0],layer);
  close(overlayTextLayout(layer.overlays[0],metrics).fontSize,overlayTextLayout(layer.overlays[0],oldMetrics).fontSize);
  const svg=await pageSvg(project,project.pages[0],"",1);assert.ok(svg.includes(`x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"`));assert.ok(svg.includes('width="700" height="990"'));
  const grid=f.pageGridMetrics(page,zero);assert.deepEqual(libraryDropTarget({...project,pageFormat:zero,pages:[page]},"page",grid.cellWidth+1,20,{width:grid.width,height:grid.height,gapX:0,gapY:0,border:3}),{kind:"new",x:1,y:0});
  const React=await import("react"),{render,screen,cleanup}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event"),{App}=await load("App");
  localStorage.setItem("comicbook-ai.locale","sv");saveProjects([project]);const user=userEvent.setup({document});render(React.createElement(App));
  await user.click(screen.getByRole("button",{name:/Spacing fixture/}));await user.click(screen.getByRole("button",{name:"Albuminställningar",exact:true}));
  const saved=()=>JSON.parse(localStorage.getItem("comicbook-ai.projects"))[0];const originalPages=JSON.parse(JSON.stringify(readProjects()[0].pages));
  const top=screen.getByLabelText("Överkant (mm)");await user.clear(top);await user.type(top,"15");close(saved().pageFormat.spacing.topMm,15);
  const gap=screen.getByLabelText("Mellan kolumner (mm)");await user.clear(gap);await user.type(gap,"0");assert.equal(saved().pageFormat.spacing.columnGapMm,0);
  await user.clear(top);await user.type(top,"900");assert.equal(saved().pageFormat.spacing.topMm,90,'last valid value is preserved when final input is invalid');assert.ok(screen.getByRole("alert"));
  await user.clear(top);await user.type(top,"15");assert.deepEqual(saved().pages,originalPages,'authored placements, images and overlays are untouched');
  await user.click(screen.getByRole("button",{name:"Stäng",exact:true}));await user.click(screen.getByRole("button",{name:"Sidor",exact:true}));
  for(const selector of [".construction-grid",".layout-panels"]){const style=document.querySelector(selector).style;close(parseFloat(style.getPropertyValue("--page-grid-top"))/100*210,15);assert.equal(style.getPropertyValue("--page-grid-column-gap"),"0cqw");close(parseFloat(style.getPropertyValue("--page-grid-left"))/100*210,10);}
  assert.equal(requests,0,'local editing does not access network');cleanup();
  console.log("PASS: physical margins/gaps, legacy layout, zero spacing, spanning panels, landscape, preview/export geometry, unchanged point sizes/content, backup validation/round trip, persistence and settings UI.");
}finally{dom.window.close();rmSync(temporary,{recursive:true,force:true});}
