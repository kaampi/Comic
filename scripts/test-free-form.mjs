import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
for(const name of ['window','document','HTMLElement','SVGElement','Node','MutationObserver'])globalThis[name]=dom.window[name];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'comicbook-free-form-'));
fs.symlinkSync(path.resolve('node_modules'),path.join(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
try {
  for(const name of ['PanelShapeControls.tsx','PanelFrameOutline.tsx','panelShape.ts','panelGeometry.ts','panelBorder.ts','pageFormat.ts','handDrawnBorder.ts']) {
    const output=ts.transpileModule(fs.readFileSync(`src/${name}`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from "(\.[^"]+)"/g,'from "$1.mjs"');
    fs.writeFileSync(path.join(dir,name.replace(/\.tsx?$/,'.mjs')),output);
  }
  const React=await import('react'),{render,fireEvent,screen,cleanup}=await import('@testing-library/react');
  const {PanelShapeControls,PanelShapeHandles}=await import(pathToFileURL(path.join(dir,'PanelShapeControls.mjs')));
  const {PanelFrameOutline}=await import(pathToFileURL(path.join(dir,'PanelFrameOutline.mjs')));
  const initial={id:'frame',x:0,y:0,width:1,height:1,readingOrder:1,overlays:[]};
  let saved;
  function Harness(){
    const [layer,setLayer]=React.useState(initial),[editing,onEditing]=React.useState(false),[selection,onSelection]=React.useState(null),[snapping,onSnapping]=React.useState(true);
    saved=layer;
    const onChange=(points,hidden)=>setLayer(old=>({...old,shapePoints:points,hiddenShapeEdges:hidden??old.hiddenShapeEdges}));
    const shared={layer,locale:'sv',selection,onSelection,snapping,onChange};
    return React.createElement(React.Fragment,null,
      React.createElement(PanelShapeControls,{...shared,editing,onEditing,onSnapping,onHidden:hidden=>setLayer(old=>({...old,hiddenShapeEdges:hidden}))}),
      editing&&React.createElement(PanelShapeHandles,shared),
      React.createElement(PanelFrameOutline,{project:{},page:{gridColumns:3,gridRows:5,placements:[layer]},layer}));
  }
  const view=render(React.createElement(Harness));
  const details=view.container.querySelector('details');details.open=true;fireEvent(details,new window.Event('toggle'));
  fireEvent.click(screen.getByRole('button',{name:'Redigera form'}));
  const edge=screen.getByRole('button',{name:'Kantsegment 1'});
  edge.ownerSVGElement.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
  fireEvent.doubleClick(edge,{clientX:50,clientY:0});
  assert.equal(saved.shapePoints.length,5);
  assert.deepEqual(saved.shapePoints[1],{x:2,y:0});
  fireEvent.keyDown(screen.getByRole('button',{name:'Formhörn 2'}),{key:'ArrowDown'});
  assert.deepEqual(saved.shapePoints[1],{x:2,y:1});
  fireEvent.keyDown(screen.getByRole('button',{name:'Kantsegment 1'}),{key:'Enter'});
  fireEvent.click(screen.getByRole('button',{name:'Dölj kantsegment'}));
  assert.deepEqual(saved.hiddenShapeEdges,[0]);
  assert.equal(view.container.querySelectorAll('.panel-frame-outline line').length,4);
  fireEvent.click(screen.getByRole('button',{name:'Visa kantsegment'}));
  assert.deepEqual(saved.hiddenShapeEdges,[]);
  fireEvent.focus(screen.getByRole('button',{name:'Formhörn 2'}));
  fireEvent.click(screen.getByRole('button',{name:'Ta bort nod'}));
  assert.equal(saved.shapePoints.length,4);
  fireEvent.click(screen.getByLabelText('Fäst mot rutnät'));
  assert.equal(view.container.querySelectorAll('.panel-shape-surface circle').length,0);
  fireEvent.click(screen.getByRole('button',{name:'Återställ till rektangel'}));
  assert.deepEqual(saved.shapePoints,[{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}]);
  assert.deepEqual(saved.hiddenShapeEdges,[]);
  details.open=false;fireEvent(details,new window.Event('toggle'));
  assert.equal(view.container.querySelector('.panel-shape-surface'),null);
  cleanup();
  console.log('PASS: free-form section, edge insertion, concave node movement, selection, hidden-frame preview, deletion, snapping and reset.');
}finally{fs.rmSync(dir,{recursive:true,force:true});dom.window.close();}
