import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'comicbook-idml-'));
fs.symlinkSync(path.resolve('node_modules'),path.join(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
const names=['panelBorder.ts','panelGeometry.ts','imageView.ts','panelShape.ts','pageFormat.ts','pageTypography.ts','exportFiles.ts','albumExport.tsx','SvgOverlay.tsx','richText.ts','ConnectedBubbles.tsx','bubbleConnections.ts','idmlGeometry.ts','SfxArtwork.tsx','sfxShapes.ts','thoughtBubble.ts','overlayTypography.ts','idmlExport.ts'];
function archive(bytes) {
  const entries=new Map();let offset=0;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  while(view.getUint32(offset,true)===0x04034b50) {
    assert.equal(view.getUint16(offset+8,true),0,'stored ZIP entry');
    const size=view.getUint32(offset+18,true),length=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
    const name=new TextDecoder().decode(bytes.subarray(offset+30,offset+30+length));
    entries.set(name,bytes.subarray(offset+30+length+extra,offset+30+length+extra+size));offset+=30+length+extra+size;
  }
  return entries;
}
const decode=b=>new TextDecoder().decode(b);
function parse(bytes){const doc=new JSDOM(decode(bytes),{contentType:'text/xml'}).window.document;assert.equal(doc.querySelector('parsererror'),null);return doc;}
try {
  for(const name of names){const output=ts.transpileModule(fs.readFileSync(`src/${name}`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from "(\.[^"]+)"/g,'from "$1.mjs"').replace(/import\("(\.[^"]+)"\)/g,'import("$1.mjs")');fs.writeFileSync(path.join(dir,name.replace(/\.tsx?$/,'.mjs')),output);}
  const {svgGeometry}=await import(pathToFileURL(path.join(dir,'idmlGeometry.mjs')));
  const quadratic=svgGeometry('M 0 0 Q 30 60 90 0 Z')[0];
  assert.deepEqual(quadratic.points[0].right,{x:20,y:40});assert.deepEqual(quadratic.points[1].left,{x:50,y:40});
  const circle=svgGeometry('M 10 0 A 10 10 0 1 1 -10 0 A 10 10 0 1 1 10 0 Z')[0];assert.equal(circle.points.length,4);assert.equal(circle.open,false);
  assert.equal(svgGeometry('M 0 0 L 10 0 M 0 5 L 10 5').length,2);
  const {exportAlbum}=await import(pathToFileURL(path.join(dir,'albumExport.mjs')));
  const {DEFAULT_PAGE_FORMAT}=await import(pathToFileURL(path.join(dir,'pageFormat.mjs')));
  const overlay={id:'o&1',type:'speech',text:'ÅÄÖ <test> & friends\nSecond paragraph',x:8,y:12,width:72,height:30,rotation:12,fontSize:9,fontFamily:'Comic Neue, sans-serif',tailCurve:35,tailX:75,tailY:70,fillOpacity:.5};
  const layer={id:'layer',x:0,y:0,width:2,height:2,readingOrder:1,shapePoints:[{x:0,y:0},{x:4,y:0},{x:3,y:4},{x:0,y:4}],overlays:[overlay,{...overlay,id:'thought',type:'thought',rotation:0},{...overlay,id:'sfx',type:'sfx',sfxShapeId:'question'}]};
  const spacing={topMm:12,rightMm:14,bottomMm:16,leftMm:18,columnGapMm:3,rowGapMm:4};
  const project={title:'Test <album>',pageFormat:{...DEFAULT_PAGE_FORMAT,spacing},pages:[{id:'second',number:2,gridColumns:3,gridRows:5,placements:[layer]},{id:'first',number:1,gridColumns:3,gridRows:5,background:{...layer,id:'bg',overlays:[]},placements:[layer]}]};
  const {linkBubbles}=await import(pathToFileURL(path.join(dir,'bubbleConnections.mjs')));
  const linked=linkBubbles([{...overlay,id:'linked-a',text:'Linked first',rotation:0,width:30,height:20,tailEnabled:false},{...overlay,id:'linked-b',text:'Linked second',x:55,y:40,width:30,height:20,tailEnabled:false}],'linked-a','linked-b');
  linked[1].textStyles=[{start:7,end:13,fontFamily:'Comic Relief, sans-serif',fontSize:18,fontWeight:700}];
  project.pages[1].background.overlays=linked;
  const snapshot=JSON.stringify(project),progress=[];
  const options={format:'idml',pageIds:['second','first'],pageFormat:DEFAULT_PAGE_FORMAT,dpi:600,fit:'contain',jpegQuality:.95};
  const result=await exportAlbum(project,options,(...args)=>progress.push(args));
  assert.equal(JSON.stringify(project),snapshot,'export does not mutate project');assert.match(result.name,/-idml.zip$/);
  assert.deepEqual(progress,[[0,2],[1,2],[2,2]]);
  const outer=archive(new Uint8Array(await result.blob.arrayBuffer()));assert.ok(outer.has('README.txt'));
  const inner=archive(outer.get('Test -album-.idml'));
  assert.equal([...inner.keys()][0],'mimetype');assert.equal(decode(inner.get('mimetype')),'application/vnd.adobe.indesign-idml-package');
  const docs=new Map([...inner].filter(([p])=>p.endsWith('.xml')).map(([p,b])=>[p,parse(b)]));
  const design=docs.get('designmap.xml'),spreadRefs=[...design.getElementsByTagName('idPkg:Spread')];
  assert.equal(design.querySelectorAll('Layer').length,5);assert.equal(spreadRefs.length,2);
  assert.deepEqual(spreadRefs.map(e=>docs.get(e.getAttribute('src')).querySelector('Page').getAttribute('Name')),['1','2']);
  for(const e of [...design.querySelectorAll('[src]')])assert.ok(inner.has(e.getAttribute('src')),'all package parts exist');
  const joined=[...docs.values()].flatMap(d=>[...d.querySelectorAll('Polygon')]).filter(e=>e.getAttribute('Name')==='Connected bubbles linked-a linked-b');
  assert.equal(joined.length,1,'one shared vector fill for linked bubbles');
  assert.equal(joined[0].getAttribute('StrokeColor'),'Swatch/None','no internal strokes on fill');
  assert.equal(joined[0].querySelectorAll('GeometryPathType').length,1,'one joined contour');
  assert.ok([...docs.values()].some(d=>d.documentElement.outerHTML.includes('Linked first')));
  const richStory=[...docs.values()].find(d=>[...d.querySelectorAll('Content')].map(e=>e.textContent).join('').includes('Linked second'));
  assert.ok(richStory);
  const richRanges=[...richStory.querySelectorAll('CharacterStyleRange')];assert.equal(richRanges.length,2);
  assert.equal(richRanges[1].querySelector('AppliedFont').textContent,'Comic Relief');assert.equal(richRanges[1].getAttribute('FontStyle'),'Bold');
  assert.ok(Number(richRanges[1].getAttribute('PointSize'))>Number(richRanges[0].getAttribute('PointSize')));
  const allIds=new Set();for(const d of docs.values())for(const e of d.querySelectorAll('[Self]')){assert.ok(!allIds.has(e.getAttribute('Self')),'unique Self');allIds.add(e.getAttribute('Self'));}
  for(const d of docs.values()) {
    for(const e of d.querySelectorAll('[ItemLayer]'))assert.ok(allIds.has(e.getAttribute('ItemLayer')));
    for(const e of d.querySelectorAll('[ParentStory]'))assert.ok(allIds.has(e.getAttribute('ParentStory')));
    for(const e of d.querySelectorAll('[FillColor], [StrokeColor]'))for(const key of ['FillColor','StrokeColor'])if(e.hasAttribute(key))assert.ok(allIds.has(e.getAttribute(key)));
    assert.ok(!decode(new TextEncoder().encode(d.documentElement.outerHTML)).includes('NaN'));
  }
  const text=[...docs.values()].flatMap(d=>[...d.querySelectorAll('Content')].map(e=>e.textContent));assert.ok(text.includes('ÅÄÖ <test> & friends'));
  assert.ok([...docs.values()].some(d=>d.querySelector('BlendingSetting[Opacity="50"]')));
  const firstSpread=docs.get(spreadRefs[0].getAttribute('src'));assert.ok(firstSpread.querySelector('TextFrame'));assert.ok(firstSpread.querySelector('PathPointType'));
  const margins=firstSpread.querySelector('MarginPreference');for(const [key,mm] of [['Top',12],['Right',14],['Bottom',16],['Left',18]])assert.ok(Math.abs(Number(margins.getAttribute(key))-mm*72/25.4)<1e-5,'physical IDML margin guide');
  const controller=new AbortController();controller.abort();await assert.rejects(exportAlbum(project,options,()=>{},controller.signal),{name:'AbortError'});
  await assert.rejects(exportAlbum(project,{...options,pageIds:[]},()=>{}),/no-pages/);
  const mid=new AbortController();await assert.rejects(exportAlbum(project,options,(done)=>{if(done===1)mid.abort();},mid.signal),{name:'AbortError'});
  const huge=await exportAlbum(project,{...options,pageFormat:{...DEFAULT_PAGE_FORMAT,preset:'custom',widthMm:1000,heightMm:1000}},()=>{});assert.ok(huge.blob.size>0,'IDML ignores raster pixel limits');
  // A tiny source image exercises packaging, deduplication, offsets and 72 dpi bounds.
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=';
  globalThis.Image=class {naturalWidth=1;naturalHeight=1;async decode(){}};
  const image={id:'image',dataUrl:png,rotation:30,zoom:1.4,offsetX:22,offsetY:-10,positionMode:'frame',fit:'cover'};
  const pictured={...project,pages:[{...project.pages[1],placements:[{...layer,image},{...layer,id:'repeat',x:2,image}]}]};
  const pictureResult=await exportAlbum(pictured,options,()=>{}),pictureOuter=archive(new Uint8Array(await pictureResult.blob.arrayBuffer()));
  assert.equal([...pictureOuter.keys()].filter(p=>p.startsWith('Links/')).length,1);
  const pictureInner=archive(pictureOuter.get('Test -album-.idml'));
  const pictureSpread=parse([...pictureInner].find(([p])=>p.startsWith('Spreads/'))[1]);
  assert.equal(pictureSpread.querySelectorAll('Image').length,2);
  for(const element of pictureSpread.querySelectorAll('Image')) {
    const [a,b,c,d,e,f]=element.getAttribute('ItemTransform').split(' ').map(Number);
    assert.ok(Math.abs(Math.atan2(b,a)*180/Math.PI-30)<1e-5);
    assert.ok(Math.abs(Math.atan2(-c,d)*180/Math.PI-30)<1e-5);
    assert.ok([a,b,c,d,e,f].every(Number.isFinite));
  }
  for(const link of pictureSpread.querySelectorAll('Link'))assert.ok(pictureOuter.has(link.getAttribute('LinkResourceURI').replace('file:','')));
  console.log('PASS: IDML XML, part references, unique IDs, layers, page ordering, editable Unicode text, curved paths, opacity, image packaging/deduplication, cancellation and immutable project.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}

