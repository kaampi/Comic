import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {pathToFileURL} from 'node:url';
import ts from 'typescript';import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
for(const name of ['window','document','HTMLElement','SVGElement','Node','MutationObserver'])globalThis[name]=dom.window[name];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
window.PointerEvent=window.MouseEvent;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'comicbook-bubble-shape-'));
fs.symlinkSync(path.resolve('node_modules'),path.join(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
function compile(root='src',target=dir){for(const entry of fs.readdirSync(root,{withFileTypes:true})){const from=path.join(root,entry.name),to=path.join(target,entry.name.replace(/\.tsx?$/,'.mjs'));if(entry.isDirectory()){fs.mkdirSync(to);compile(from,to);}else if(/\.tsx?$/.test(from))fs.writeFileSync(to,ts.transpileModule(fs.readFileSync(from,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from "(\.[^"]+)"/g,'from "$1.mjs"').replace(/import\("(\.[^"]+)"\)/g,'import("$1.mjs")'));}}
try{
  compile();
  const React=await import('react'),{render,fireEvent,screen,cleanup}=await import('@testing-library/react');
  const {renderToStaticMarkup}=await import('react-dom/server');
  const shape=await import(pathToFileURL(path.join(dir,'bubbleShape.mjs')));
  const {BubbleShapeControls,BubbleShapeHandles}=await import(pathToFileURL(path.join(dir,'BubbleShapeEditor.mjs')));
  const {SvgOverlay,speechPath,bubbleTailStart,captionPath}=await import(pathToFileURL(path.join(dir,'SvgOverlay.mjs')));
  const {connectedBubbleGeometry,linkBubbles}=await import(pathToFileURL(path.join(dir,'bubbleConnections.mjs')));
  const base={id:'bubble',type:'speech',text:'Test',x:10,y:10,width:50,height:30,rotation:0,tailX:40,tailY:55};
  const points=[{x:.2,y:.2},{x:3.8,y:.2},{x:3.8,y:3.8},{x:2,y:2.2},{x:.2,y:3.8}];
  assert.ok(shape.validBubbleShape(points,true));
  assert.equal(shape.validBubbleShape([{x:0,y:0},{x:4,y:4},{x:4,y:0},{x:0,y:4}]),false);
  for(const type of ['speech','thought','caption']){
    const custom={...base,type,bubbleShapePoints:points};
    const markup=renderToStaticMarkup(React.createElement('svg',null,React.createElement(SvgOverlay,{overlay:custom})));
    assert.ok(markup.includes(type==='speech'?speechPath(custom,'organic'):type==='caption'?captionPath(custom):shape.customBubblePath(custom)));
    assert.ok(!markup.includes('NaN'));
    const root=bubbleTailStart(custom);assert.ok(Number.isFinite(root.x)&&Number.isFinite(root.y));
    const regular=renderToStaticMarkup(React.createElement(SvgOverlay,{overlay:{...custom,bubbleShapePoints:undefined}}));
    assert.notEqual(markup,regular);
  }
  const originalGroup=linkBubbles([{...base,tailEnabled:false},{...base,id:'other',x:65,width:25,tailEnabled:false}],'bubble','other');
  const first=connectedBubbleGeometry(originalGroup);
  const customGroup=originalGroup.map(o=>o.id==='bubble'?{...o,bubbleShapePoints:points}:o);
  const next=connectedBubbleGeometry(customGroup);assert.notEqual(first.fillPath,next.fillPath,'connection cache follows shape changes');assert.ok(next.fillPath.length>0);
  let saved;
  function Harness(){const [o,set]=React.useState({...base,tailEnabled:false}),[editing,onEditing]=React.useState(false),[selected,onSelected]=React.useState(null),[snapping,onSnapping]=React.useState(false);saved=o;
    const props={overlay:o,locale:'sv',editing,onEditing,selected,onSelected,snapping,onSnapping,onChange:patch=>set(old=>({...old,...patch}))};
    return React.createElement(React.Fragment,null,React.createElement(BubbleShapeControls,props),React.createElement('svg',{viewBox:'0 0 100 100'},React.createElement(SvgOverlay,{overlay:o}),editing&&React.createElement(BubbleShapeHandles,props)));}
  const view=render(React.createElement(Harness));
  const details=view.container.querySelector('details');details.open=true;fireEvent(details,new window.Event('toggle'));
  fireEvent.click(screen.getByRole('button',{name:'Redigera form'}));
  assert.equal(saved.bubbleShapePoints,undefined,'opening tools preserves existing artwork');
  assert.equal(screen.getAllByRole('button',{name:/Bubbelnod/}).length,16);
  const firstNode=screen.getByRole('button',{name:'Bubbelnod 1',exact:true});fireEvent.focus(firstNode);fireEvent.keyDown(firstNode,{key:'ArrowLeft'});
  assert.equal(saved.bubbleShapePoints.length,16);
  const before=structuredClone(saved.bubbleShapePoints);
  const svg=view.container.querySelector('svg');svg.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
  fireEvent.pointerDown(firstNode,{button:0,clientX:59,clientY:25});fireEvent.pointerMove(window,{clientX:55,clientY:25});
  assert.notDeepEqual(saved.bubbleShapePoints,before);
  fireEvent.keyDown(window,{key:'Escape'});assert.deepEqual(saved.bubbleShapePoints,before);
  fireEvent.click(screen.getByLabelText('Mjuk kontur'));assert.equal(saved.bubbleShapeSmooth,false);
  const count=saved.bubbleShapePoints.length;fireEvent.doubleClick(view.container.querySelector('.bubble-shape-edge'),{clientX:35,clientY:12.1});
  assert.equal(saved.bubbleShapePoints.length,count+1);
  fireEvent.click(screen.getByRole('button',{name:'Ta bort nod'}));assert.equal(saved.bubbleShapePoints.length,count);
  fireEvent.click(screen.getByRole('button',{name:'Återställ grundform'}));assert.equal(saved.bubbleShapePoints,undefined);assert.equal(view.container.querySelector('.bubble-shape-handles'),null);
  cleanup();
  console.log('PASS: speech/thought/caption shapes, smooth/straight contours, custom tail roots, connection cache, nodes, Escape rollback, insert/delete and reset.');
}finally{fs.rmSync(dir,{recursive:true,force:true});dom.window.close();}
