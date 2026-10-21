import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".bubble-menu-test-"));
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
  const React=await import('react'),{render,screen,within,fireEvent,waitFor,cleanup}=await import('@testing-library/react'),{default:userEvent}=await import('@testing-library/user-event');
  const local=p=>import(pathToFileURL(join(temporary,p+'.mjs')));
  const {App}=await local('App'),{createProject}=await local('project'),{textStyleAt}=await local('richText'),{packAlbumBackup,parseAlbumBackup}=await local('albumBackup'),{cloneOverlay}=await local('overlayActions'),{selectionOffsets}=await local('InlineOverlayEditor');
  const project=createProject('Bubble menu fixture','blank');project.pageDefaults={gridColumns:2,gridRows:2};
  const original={id:'first',type:'speech',text:'Alpha beta gamma',x:10,y:10,width:60,height:45,rotation:0,fontSize:9,strokeColor:'#171411',strokeWidth:2,fillColor:'#fffdf7',fillOpacity:1,tailEnabled:true,tailX:30,tailY:70,bubbleShapePoints:[{x:.2,y:.2},{x:3.8,y:.2},{x:3.8,y:3.8},{x:.2,y:3.8}],bubbleShapeSmooth:true};
  project.pages=[{id:'page',number:1,gridColumns:2,gridRows:2,placements:[{id:'panel-a',x:0,y:0,width:1,height:1,readingOrder:1,overlays:[original]},{id:'panel-b',x:1,y:0,width:1,height:1,readingOrder:2,overlays:[]}]}];
  localStorage.clear();localStorage.setItem('comicbook-ai.locale','en');localStorage.setItem('comicbook-ai.projects',JSON.stringify([project]));
  let clipboard='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:async()=>clipboard,writeText:async text=>{clipboard=text;}}});
  const stored=()=>JSON.parse(localStorage.getItem('comicbook-ai.projects'))[0],first=()=>stored().pages[0].placements[0].overlays[0];
  const user=userEvent.setup({document});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:async()=>clipboard,writeText:async text=>{clipboard=text;}}});render(React.createElement(App));
  await user.click(screen.getByRole('button',{name:/Bubble menu fixture/}));await user.click(screen.getByRole('button',{name:/Open album for editing/}));await user.click(screen.getByRole('button',{name:'Pages',exact:true}));
  const openPanel=number=>fireEvent.doubleClick(screen.getByLabelText(`panel ${number}`,{exact:true}));
  openPanel(1);
  const surface=()=>document.querySelector('.panel-editor-modal .editable-overlay.is-selected .overlay-drag-surface');
  const context=target=>fireEvent.contextMenu(target,{clientX:300,clientY:200});
  const item=label=>within(screen.getByRole('menu')).getByRole('menuitem',{name:label,exact:true});
  context(surface());assert.ok(item('Edit text'));assert.ok(item('Edit bubble shape'));
  await user.click(item('Copy'));
  context(surface());await user.click(item('Duplicate'));assert.equal(stored().pages[0].placements[0].overlays.length,2);
  const copy=stored().pages[0].placements[0].overlays[1];assert.notEqual(copy.id,original.id);assert.deepEqual(copy.bubbleShapePoints,original.bubbleShapePoints);assert.equal(copy.tailX-original.tailX,copy.x-original.x);
  context(surface());await user.click(item('Delete'));assert.equal(stored().pages[0].placements[0].overlays.length,1);
  await user.click(screen.getByRole('button',{name:'Close',exact:true}));openPanel(2);
  const stage=document.querySelector('.panel-editor-stage');stage.getBoundingClientRect=()=>({left:0,top:0,width:500,height:500});context(stage);await user.click(item('Paste'));
  const pasted=stored().pages[0].placements[1].overlays[0];assert.ok(pasted);assert.notEqual(pasted.id,original.id);assert.equal(pasted.text,original.text);assert.deepEqual(stored().pages[0].placements[0].overlays[0],original);
  await user.click(screen.getByRole('button',{name:'Close',exact:true}));openPanel(1);
  context(surface());await user.click(item('Edit text'));
  let input=screen.getByRole('textbox',{name:'Edit text in the bubble',exact:true});assert.equal(input.getAttribute('contenteditable'),'true');
  const select=(start,end)=>{const root=input,walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];let at=0;while(walker.nextNode()){const n=walker.currentNode;nodes.push({n,start:at,end:at+n.textContent.length});at+=n.textContent.length;}const position=i=>{const n=nodes.find(n=>n.end>=i)||nodes.at(-1);return [n.n,i-n.start];};const range=document.createRange();range.setStart(...position(start));range.setEnd(...position(end));window.getSelection().removeAllRanges();window.getSelection().addRange(range);fireEvent.mouseUp(root);};
  select(6,10);context(input);await user.click(within(screen.getByRole('menu')).getByRole('menuitemcheckbox',{name:'Bold',exact:true}));
  await waitFor(()=>assert.equal(textStyleAt(first(),6).fontWeight,700));assert.equal(textStyleAt(first(),0).fontWeight,undefined);await waitFor(()=>assert.deepEqual(selectionOffsets(screen.getByRole('textbox',{name:'Edit text in the bubble',exact:true})),[6,10]));
  input=screen.getByRole('textbox',{name:'Edit text in the bubble',exact:true});select(6,10);context(input);await user.click(within(screen.getByRole('menu')).getByRole('menuitemcheckbox',{name:'Italic',exact:true}));
  await waitFor(()=>assert.equal(textStyleAt(first(),6).fontStyle,'italic'));
  input=screen.getByRole('textbox',{name:'Edit text in the bubble',exact:true});select(6,10);context(input);await user.click(within(screen.getByRole('menu')).getByRole('menuitemcheckbox',{name:'Underline',exact:true}));
  await waitFor(()=>assert.equal(textStyleAt(first(),6).underline,true));
  input=screen.getByRole('textbox',{name:'Edit text in the bubble',exact:true});select(6,10);context(input);await user.click(item('Copy'));await waitFor(()=>assert.equal(clipboard,'beta'));
  input=screen.getByRole('textbox',{name:'Edit text in the bubble',exact:true});select(6,10);context(input);await user.click(item('Cut'));await waitFor(()=>assert.equal(first().text,'Alpha  gamma'));
  input=screen.getByRole('textbox',{name:'Edit text in the bubble',exact:true});select(6,6);context(input);await user.click(item('Paste'));await waitFor(()=>assert.equal(first().text,'Alpha beta gamma'));assert.equal(textStyleAt(first(),6).fontStyle,'italic','internal copy/paste keeps selected typography');
  input=screen.getByRole('textbox',{name:'Edit text in the bubble',exact:true});context(input);await user.click(item('Finish editing text'));assert.equal(document.querySelector('.inline-overlay-editor'),null);
  context(surface());await user.click(item('Edit bubble shape'));assert.equal(document.querySelectorAll('.bubble-shape-node').length,4);
  const node=()=>screen.getByRole('button',{name:'Bubble node 1',exact:true});context(node());await user.click(item('Make sharp'));assert.equal(first().bubbleShapePoints[0].smooth,false);
  context(node());await user.click(item('Make smooth'));assert.equal(first().bubbleShapePoints[0].smooth,true);
  context(node());await user.click(item('Delete node'));assert.equal(first().bubbleShapePoints.length,3);
  context(node());assert.equal(item('Delete node').disabled,true);fireEvent.keyDown(window,{key:'Escape'});assert.equal(screen.queryByRole('menu'),null);assert.equal(document.querySelectorAll('.bubble-shape-node').length,3,'Escape dismisses menu before leaving mode');
  const outline=document.querySelector('.bubble-shape-edge'),body=first(),a=body.bubbleShapePoints[0],b=body.bubbleShapePoints[1];outline.ownerSVGElement.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
  fireEvent.contextMenu(outline,{clientX:body.x+(a.x+b.x)/2*body.width/4,clientY:body.y+(a.y+b.y)/2*body.height/4});await user.click(item('Add node here'));assert.equal(first().bubbleShapePoints.length,4);
  fireEvent.keyDown(window,{key:'Escape'});assert.equal(document.querySelector('.bubble-shape-handles'),null);assert.ok(document.querySelector('.panel-editor-modal'),'Escape finishes shape before closing the editor');
  const backup=parseAlbumBackup(packAlbumBackup(stored()));assert.deepEqual(backup.pages[0].placements[0].overlays,stored().pages[0].placements[0].overlays);
  for(const bad of [{fontStyle:'oblique'},{underline:'yes'},{bubbleShapePoints:[{x:.2,y:.2,smooth:'yes'},{x:3.8,y:.2},{x:3.8,y:3.8}]}]){const broken=structuredClone(packAlbumBackup(stored()));Object.assign(broken.project.pages[0].placements[0].overlays[0],bad);assert.throws(()=>parseAlbumBackup(broken),/invalid-backup/);}

  context(surface());fireEvent.keyDown(window,{key:'End'});assert.equal(document.activeElement.textContent,'Delete');fireEvent.keyDown(window,{key:'Escape'});assert.equal(screen.queryByRole('menu'),null);
  assert.equal(networkRequests,0);
  cleanup();console.log('PASS: mode menus, copy/duplicate/paste across panels, clipboard text, selected Bold/Italic/Underline, preserved selection, per-node sharp/smooth, delete limits, Escape ordering, keyboard menus and backup.');
}finally{globalThis.fetch=nativeFetch;rmSync(temporary,{recursive:true,force:true});dom.window.close();}
