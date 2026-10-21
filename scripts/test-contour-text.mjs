import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {pathToFileURL} from 'node:url';
import ts from 'typescript';import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
for(const name of ['window','document','HTMLElement','SVGElement','Node','MutationObserver'])globalThis[name]=dom.window[name];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
window.PointerEvent=window.MouseEvent;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'comicbook-contour-text-'));
fs.symlinkSync(path.resolve('node_modules'),path.join(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
function compile(root='src',target=dir){for(const entry of fs.readdirSync(root,{withFileTypes:true})){const from=path.join(root,entry.name),to=path.join(target,entry.name.replace(/\.tsx?$/,'.mjs'));if(entry.isDirectory()){fs.mkdirSync(to);compile(from,to);}else if(/\.tsx?$/.test(from))fs.writeFileSync(to,ts.transpileModule(fs.readFileSync(from,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from "(\.[^"]+)"/g,'from "$1.mjs"').replace(/import\("(\.[^"]+)"\)/g,'import("$1.mjs")'));}}
try{
  compile();
  const React=await import('react'),{render,fireEvent,screen,cleanup}=await import('@testing-library/react');
  const {renderToStaticMarkup}=await import('react-dom/server');
  const {richTextLayout}=await import(pathToFileURL(path.join(dir,'richText.mjs')));
  const {overlayTextLayout}=await import(pathToFileURL(path.join(dir,'pageTypography.mjs')));
  const {contourIntervals,textBodyPolygon}=await import(pathToFileURL(path.join(dir,'contourText.mjs')));
  const {textOverflows}=await import(pathToFileURL(path.join(dir,'exportPreflight.mjs')));
  const {SvgOverlay}=await import(pathToFileURL(path.join(dir,'SvgOverlay.mjs')));
  const {InlineOverlayEditor}=await import(pathToFileURL(path.join(dir,'InlineOverlayEditor.mjs')));
  const {TextOverflowNotice}=await import(pathToFileURL(path.join(dir,'TextOverflowNotice.mjs')));
  const metrics={width:400,height:260,pageWidthMm:210};
  const shape=[{x:.1,y:.1},{x:3.9,y:.1},{x:3.9,y:3.9},{x:2.5,y:3.9},{x:2.5,y:1.6},{x:1.5,y:1.6},{x:1.5,y:3.9},{x:.1,y:3.9}];
  const base={id:'contour',type:'speech',text:'This is a long text in a free shape bubble. Wonder if it will break? '.repeat(4),x:0,y:0,width:100,height:100,rotation:0,fontSize:10,textPadding:4,textAlign:'left',bubbleShapePoints:shape,bubbleShapeSmooth:false};
  const checkRows=(o,layout)=>{
    const width=o.width*metrics.width/100,height=o.height*metrics.height/100,polygon=textBodyPolygon(o,width,height),margin=width*(o.textPadding??4)/100+(o.strokeWidth??2)/2;
    for(const row of layout.rows){const top=row.y-row.size*.85,intervals=contourIntervals(polygon,top,top+row.lineHeight,margin),left=row.runs[0]?.x??row.x;
      assert.ok(intervals.some(i=>left>=i.left-1e-6&&left+row.lineWidth<=i.right+1e-6),'the entire glyph band lies inside one padded connected region');
      assert.ok(row.lineWidth<=row.available+1e-6);
    }
  };
  for(const smooth of [false,true])for(const rotation of [0,25,-40])for(const align of ['left','center','right']){
    const o={...base,bubbleShapeSmooth:smooth,rotation,textAlign:align},layout=richTextLayout(o,metrics);assert.ok(layout.rows.length>0);checkRows(o,layout);
    assert.equal(layout.overflow,textOverflows(o,metrics));
    assert.deepEqual(overlayTextLayout(o,metrics).textLines,layout.rows.map(r=>o.text.slice(r.start,r.end)));
    const markup=renderToStaticMarkup(React.createElement(SvgOverlay,{overlay:o,textMetrics:metrics}));
    for(const row of layout.rows)for(const run of row.runs)assert.ok(markup.includes(`x="${run.x}"`));
  }
  const plain=richTextLayout(base,metrics);assert.ok(new Set(plain.rows.map(r=>Math.round(r.available))).size>1,'rows narrow at the notch');
  const huge={...base,text:'A very long text '.repeat(100),fontSize:18},before=JSON.stringify(huge),overflow=richTextLayout(huge,metrics);
  assert.ok(overflow.overflow);assert.ok(overflow.overflowStart<huge.text.length);assert.equal(JSON.stringify(huge),before,'overflow never changes source or point size');
  const mixed={...base,text:'Small BIG text with a bold word and more text.',textStyles:[{start:6,end:9,fontSize:24,fontWeight:700,textColor:'#ff0000'}]};
  const rich=richTextLayout(mixed,metrics);checkRows(mixed,rich);assert.ok(rich.rows.some(r=>r.runs.some(run=>run.style.textColor==='#ff0000')));
  const unicode={...base,text:'ÅÄÖ 😀Supercalifragilisticexpialidocious\n\nBlank line then text.',width:45,fontSize:11};const unicodeLayout=richTextLayout(unicode,metrics);
  checkRows(unicode,unicodeLayout);assert.ok(unicodeLayout.rows.some(r=>r.start===r.end),'authored blank lines survive');
  assert.ok(unicodeLayout.rows.every(r=>!/[\uD800-\uDBFF]$/.test(unicode.text.slice(r.start,r.end))),'no split surrogate pairs');
  const tailA=richTextLayout({...base,tailX:20,tailY:90,tailEnabled:true},metrics),tailB=richTextLayout({...base,tailX:300,tailY:400,tailCurve:80,tailEnabled:false},metrics);
  assert.deepEqual(tailA.rows.map(({start,end,y,lineWidth})=>({start,end,y,lineWidth})),tailB.rows.map(({start,end,y,lineWidth})=>({start,end,y,lineWidth})),'the tail is excluded from text space');
  const view=render(React.createElement(TextOverflowNotice,{overlay:huge,metrics,locale:'sv'}));assert.match(screen.getByRole('status').textContent,/Texten ryms inte/);view.rerender(React.createElement(TextOverflowNotice,{overlay:{...base,text:'Hi'},metrics,locale:'sv'}));assert.equal(screen.queryByRole('status'),null);cleanup();
  let finished=0;
  let draft={...base,text:'First row with spaces.\nSecond 😀 row.',textStyles:[{start:0,end:5,fontWeight:700}]};
  function Editor(){const [o,set]=React.useState(draft);draft=o;return React.createElement('svg',null,React.createElement(InlineOverlayEditor,{overlay:o,textMetrics:metrics,label:'Edit contour',onChange:text=>set(old=>({...old,text})),onFinish:()=>{finished++;},onCancel:()=>{}}));}
  render(React.createElement(Editor));const input=screen.getByRole('textbox',{name:'Edit contour'});
  assert.equal(input.textContent,draft.text,'inline editor keeps all original spaces, newlines and Unicode');
  fireEvent.pointerDown(input);assert.equal(finished,0,'clicking contour text keeps inline editing open');
  const laidOut=richTextLayout(draft,metrics),positioned=[...input.querySelectorAll('span')].filter(s=>s.style.fontSize!=='0px');
  assert.deepEqual(positioned.map(s=>parseFloat(s.style.left)),laidOut.rows.flatMap(r=>r.runs.map(run=>run.x)),'inline editor uses SVG run positions');
  input.textContent='Edited 😀 text';fireEvent.input(input);assert.equal(draft.text,'Edited 😀 text');assert.equal(input.textContent,draft.text);
  fireEvent.pointerDown(document.body);assert.equal(finished,1,'outside click finishes inline editing');
  cleanup();console.log('PASS: padded concave/smooth shapes, rotations, alignment, mixed styles, Unicode, blank lines, long words, overflow warnings, tail exclusion and matching inline/SVG positions.');
}finally{fs.rmSync(dir,{recursive:true,force:true});dom.window.close();}
