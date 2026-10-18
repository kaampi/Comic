import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".about-test-"));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:5176/" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent", "FileReader", "File", "HTMLInputElement", "SVGElement"]) {
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
  const React=await import('react');
  const {render,screen,within,fireEvent,waitFor,cleanup}=await import('@testing-library/react');
  const {default:userEvent}=await import('@testing-library/user-event');
  const {App}=await import(pathToFileURL(join(temporary,'App.mjs')));
  const {createProject,saveProjects,readProjects}=await import(pathToFileURL(join(temporary,'project.mjs')));
  const {packAlbumBackup,parseAlbumBackup}=await import(pathToFileURL(join(temporary,'albumBackup.mjs')));
  const {pageLayerTextMetrics}=await import(pathToFileURL(join(temporary,'pageTypography.mjs')));
  const {editPageForeground,changeForegroundImage,reorderForegrounds}=await import(pathToFileURL(join(temporary,'pageForeground.mjs')));
  const {pageAspect,albumPageFormat}=await import(pathToFileURL(join(temporary,'pageFormat.mjs')));
  const {crc32}=await import(pathToFileURL(join(temporary,'exportFiles.mjs')));
  const {deflateSync}=await import('node:zlib');
  const chunk=(type,data)=>{const kind=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([kind,data])));return Buffer.concat([size,kind,data,crc]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(4,0);header.writeUInt32BE(4,4);header[8]=8;header[9]=6;
  // RGBA fixture: red left half, fully transparent right half.
  const rows=Buffer.concat(Array.from({length:4},()=>Buffer.from([0,...Array.from({length:4},(_,x)=>[255,0,0,x<2?255:0]).flat()])));
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
  const pngUrl='data:image/png;base64,'+png.toString('base64');
  const text={id:'panel-text',type:'speech',text:'Panel text',x:5,y:5,width:40,height:20,fontSize:10,rotation:0,tailEnabled:false,strokeColor:'#171411',strokeWidth:2,fillColor:'#fffdf7',fillOpacity:1};
  const project=createProject('Foreground test','blank');
  project.pages=[{id:'page',number:1,gridColumns:2,gridRows:2,placements:[{id:'top',x:0,y:0,width:2,height:1,readingOrder:1,overlays:[text]},{id:'bottom',x:0,y:1,width:2,height:1,readingOrder:2,overlays:[]}]}];
  const originalPanels=structuredClone(project.pages[0].placements);
  localStorage.clear();localStorage.setItem('comicbook-ai.locale','en');saveProjects([project]);
  const current=()=>JSON.parse(localStorage.getItem('comicbook-ai.projects'))[0];
  const user=userEvent.setup({document});
  render(React.createElement(App));
  await user.click(screen.getByRole('button',{name:/Foreground test/}));
  await user.click(screen.getByRole('button',{name:'Pages',exact:true}));
  await user.upload(screen.getByLabelText('Add foreground image',{selector:'input'}),new window.File([png],'hero.png',{type:'image/png'}));
  await waitFor(()=>assert.equal(current().pages[0].foregrounds?.length,1));
  const id=current().pages[0].foregrounds[0].id;
  assert.equal(current().pages[0].foregrounds[0].image.dataUrl,pngUrl,'upload preserves original RGBA PNG');
  assert.equal(current().pages[0].foregrounds[0].image.fit,'contain');
  assert.deepEqual(current().pages[0].placements,originalPanels,'foreground is independent of grid frames');
  assert.ok(document.querySelector('.layout-canvas.has-page-foregrounds'));
  assert.ok(document.querySelector('.page-foreground-texts [data-text-layer="top"]'));
  await user.click(screen.getByRole('button',{name:'Edit image and bubbles',exact:true}));
  const editor=document.querySelector('.panel-editor-modal');
  assert.ok(editor.querySelector('.is-foreground-editor'));
  assert.equal(Number(editor.querySelector('.panel-editor-stage').style.getPropertyValue('--panel-aspect')),pageAspect(albumPageFormat(current())));
  assert.ok(editor.querySelector('.foreground-editor-context .composition-panel'));
  const add=()=>user.click(editor.querySelector('.panel-editor-add-actions button.primary-button'));
  await add();
  fireEvent.change(within(editor.querySelector('.selected-panel-tool')).getByLabelText('Text',{exact:true}),{target:{value:'First page bubble'}});
  const first=current().pages[0].foregrounds[0].overlays[0];
  await add();
  const svg=editor.querySelector('.panel-editor-stage > svg');
  svg.getBoundingClientRect=()=>({left:0,top:0,width:700,height:1000,right:700,bottom:1000});
  fireEvent.pointerDown(editor.querySelector('.editable-overlay.is-selected .overlay-drag-surface'),{button:0,clientX:0,clientY:0});
  fireEvent.pointerMove(window,{clientX:0,clientY:550});fireEvent.pointerUp(window);
  const second=current().pages[0].foregrounds[0].overlays[1];
  assert.ok(second.y>50,'bubble can cross into the lower frame');
  await user.selectOptions(within(editor).getByLabelText('Connect to'),first.id);
  assert.ok(editor.querySelector('.connected-bubble-outline'));
  let layer=current().pages[0].foregrounds[0];
  assert.equal(pageLayerTextMetrics(current(),current().pages[0],layer).width,700);
  const originalText=structuredClone(layer.overlays);
  const controls=editor.querySelector('.panel-image-controls');
  const position=controls.querySelectorAll('.image-position-grid input');
  fireEvent.change(position[0],{target:{value:'10'}});
  assert.deepEqual(current().pages[0].foregrounds[0].overlays,originalText,'image-only movement leaves bubbles fixed');
  await user.click(within(editor).getByLabelText('Move image and bubbles together'));
  fireEvent.change(position[0],{target:{value:'20'}});fireEvent.change(position[1],{target:{value:'15'}});
  layer=current().pages[0].foregrounds[0];
  layer.overlays.forEach((o,i)=>{assert.equal(o.x,originalText[i].x+10);assert.equal(o.y,originalText[i].y+15);assert.equal(o.tailX,originalText[i].tailX+10);assert.equal(o.tailY,originalText[i].tailY+15);});
  assert.deepEqual(layer.overlays[1].bubbleLinks,originalText[1].bubbleLinks);
  await user.click(controls.querySelector('.panel-image-controls-head button'));
  fireEvent.change(position[2],{target:{value:'150'}});fireEvent.change(position[3],{target:{value:'30'}});
  await user.click(within(controls).getByRole('button',{name:'Flip horizontally',exact:true}));
  assert.equal(current().pages[0].foregrounds[0].image.flipX,true);
  assert.equal(current().pages[0].foregrounds[0].image.rotation,30);
  assert.equal(current().pages[0].foregrounds[0].image.zoom,1.5);
  const panStage=editor.querySelector('.panel-editor-stage');panStage.getBoundingClientRect=()=>({left:0,top:0,width:700,height:1000,right:700,bottom:1000});
  const beforePan=JSON.stringify(current()),imageLayer=editor.querySelector('.panel-editor-image-layer');
  fireEvent.pointerDown(imageLayer,{button:0,clientX:0,clientY:0});
  fireEvent.pointerMove(window,{clientX:70,clientY:50});
  assert.equal(JSON.stringify(current()),beforePan,'foreground dragging previews without saving full albums');
  assert.equal(Number(position[0].value),30,'position control follows local preview');
  fireEvent.pointerUp(window);
  assert.equal(current().pages[0].foregrounds[0].image.offsetX,30);
  assert.equal(current().pages[0].foregrounds[0].image.offsetY,20);
  const committedPan=JSON.stringify(current());
  fireEvent.pointerDown(imageLayer,{button:0,clientX:0,clientY:0});fireEvent.pointerMove(window,{clientX:70,clientY:50});fireEvent.keyDown(window,{key:'Escape'});
  assert.equal(JSON.stringify(current()),committedPan,'Escape restores both image and group text without a save');
  await user.click(within(controls).getByRole('button',{name:'Reset image',exact:true}));
  assert.equal(current().pages[0].foregrounds[0].image.fit,'contain');
  assert.equal(current().pages[0].foregrounds[0].image.offsetX,0);
  const textBeforeReplacement=structuredClone(current().pages[0].foregrounds[0].overlays);
  await user.click(within(controls).getByRole('button',{name:'Remove image',exact:true}));
  assert.equal(current().pages[0].foregrounds[0].image,undefined);
  assert.deepEqual(current().pages[0].foregrounds[0].overlays,textBeforeReplacement);
  await user.upload(editor.querySelector('.panel-editor-dropzone input'),new window.File([png],'replacement.png',{type:'image/png'}));
  await waitFor(()=>assert.equal(current().pages[0].foregrounds[0].image?.name,'replacement.png'));
  assert.equal(current().pages[0].foregrounds[0].image.fit,'contain');
  assert.deepEqual(current().pages[0].foregrounds[0].overlays,textBeforeReplacement,'replacement does not move or overwrite page-wide text');
  await user.click(within(editor.querySelector('header')).getByRole('button',{name:'Close',exact:true}));
  await user.upload(screen.getByLabelText('Add foreground image',{selector:'input'}),new window.File([png],'second.png',{type:'image/png'}));
  await waitFor(()=>assert.equal(current().pages[0].foregrounds.length,2));
  const otherId=current().pages[0].foregrounds[1].id;
  const row=document.querySelector(`[data-foreground-id="${id}"]`);
  await user.click(within(row).getByRole('button',{name:'Bring forward',exact:true}));
  assert.deepEqual(current().pages[0].foregrounds.map(l=>l.id),[otherId,id]);
  const composed=current(),page=composed.pages[0];
  const backup=JSON.parse(JSON.stringify(packAlbumBackup(composed)));
  assert.deepEqual(parseAlbumBackup(backup).pages[0].foregrounds,page.foregrounds);
  assert.deepEqual(readProjects()[0].pages[0].foregrounds,page.foregrounds,'normalization retains IDs, image alpha, transforms, group mode and linked bubbles');
  const duplicate=structuredClone(backup);duplicate.project.pages[0].foregrounds[0].id='top';assert.throws(()=>parseAlbumBackup(duplicate),/invalid-backup/);
  const invalid=structuredClone(backup);invalid.project.pages[0].foregrounds[0].moveWithText='yes';assert.throws(()=>parseAlbumBackup(invalid),/invalid-backup/);
  const projected=editPageForeground(composed,page.id,id,p=>({...p,pages:p.pages.map(pg=>({...pg,placements:pg.placements.map(l=>l.id===id?{...l,overlays:l.overlays.map(o=>({...o,text:o.text+' edited'}))}:l)}))}));
  assert.deepEqual(projected.pages[0].placements,composed.pages[0].placements);
  assert.deepEqual(projected.pages[0].foregrounds.map(l=>l.id),[otherId,id]);
  assert.equal(projected.pages[0].foregrounds[1].overlays[0].text,'First page bubble edited');
  await user.click(within(document.querySelector(`[data-foreground-id="${id}"]`)).getByRole('button',{name:'Remove foreground layer',exact:true}));
  assert.deepEqual(current().pages[0].foregrounds.map(l=>l.id),[otherId]);
  assert.deepEqual(current().pages[0].placements,originalPanels);
  cleanup();
  const {IDBFactory}=await import('fake-indexeddb');Object.defineProperty(globalThis,'indexedDB',{value:new IDBFactory(),configurable:true});
  const {saveProjectCollection,loadProjectCollection}=await import(pathToFileURL(join(temporary,'projectDatabase.mjs')));
  await saveProjectCollection([composed]);assert.deepEqual((await loadProjectCollection())[0].pages[0].foregrounds,page.foregrounds);
  // Raster exports share this SVG composition. PNG data remains RGBA and all
  // text is painted after the foreground image passes.
  globalThis.Image=class {naturalWidth=4;naturalHeight=4;async decode(){}};
  const {pageSvg,exportAlbum}=await import(pathToFileURL(join(temporary,'albumExport.mjs')));
  const beforeExport=JSON.stringify(composed);
  const transformed=structuredClone(composed),transformedLayer=transformed.pages[0].foregrounds.at(-1);
  transformedLayer.image={...transformedLayer.image,rotation:30,flipX:true,zoom:1.5,offsetX:20};
  const transformedMarkup=await pageSvg(transformed,transformed.pages[0],'',1);
  const transformedVector=new JSDOM(transformedMarkup,{contentType:'image/svg+xml'}).window.document;
  const transformedImage=[...transformedVector.querySelectorAll('image')].at(-1);
  assert.ok(transformedImage.getAttribute('transform').includes('rotate(30'));
  assert.ok(transformedImage.getAttribute('transform').includes('scale(-1 1)'));
  assert.equal(Number(transformedImage.getAttribute('width')),1050,'full-page contain zoom uses page dimensions');
  assert.equal(Number(transformedImage.getAttribute('x')),-35,'image offset is relative to full page width');
  const markup=await pageSvg(composed,page,'',1);
  const vector=new JSDOM(markup,{contentType:'image/svg+xml'}).window.document;
  const images=[...vector.querySelectorAll('image')];assert.equal(images.length,2);
  for(const image of images){
    assert.equal(image.getAttribute('href'),pngUrl);
    assert.equal(image.parentNode.querySelector('rect'),null,'foreground image has no opaque backing');
    const clip=vector.querySelector(image.parentNode.getAttribute('clip-path').slice(4,-1)+' rect');
    assert.equal(Number(clip.getAttribute('x')),0);assert.equal(Number(clip.getAttribute('width')),700);
  }
  const panelText=[...vector.querySelectorAll('text')].find(el=>el.textContent==='Panel text');
  const foregroundText=[...vector.querySelectorAll('text')].find(el=>el.textContent==='First page bubble');
  assert.ok(panelText&&foregroundText);
  assert.ok(images.at(-1).compareDocumentPosition(panelText)&4,'panel text appears above foreground art');
  assert.ok(images.at(-1).compareDocumentPosition(foregroundText)&4,'foreground bubbles appear above every foreground image');
  assert.ok(vector.querySelector('.connected-bubble-outline'));
  if(process.env.FOREGROUND_TEST_SVG)writeFileSync(process.env.FOREGROUND_TEST_SVG,markup);
  const unzip=bytes=>{
    const entries=new Map();let offset=0;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    while(view.getUint32(offset,true)===0x04034b50){const size=view.getUint32(offset+18,true),length=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true),start=offset+30+length+extra;
      entries.set(new TextDecoder().decode(bytes.subarray(offset+30,offset+30+length)),bytes.subarray(start,start+size));offset=start+size;}
    return entries;
  };
  const output=await exportAlbum(composed,{format:'idml',pageIds:[page.id],pageFormat:albumPageFormat(composed),dpi:300,fit:'contain',jpegQuality:.95},()=>{});
  const outer=unzip(new Uint8Array(await output.blob.arrayBuffer()));
  const inner=unzip([...outer].find(([name])=>name.endsWith('.idml'))[1]);
  const xml=bytes=>new JSDOM(new TextDecoder().decode(bytes),{contentType:'text/xml'}).window.document;
  const design=xml(inner.get('designmap.xml')),order=[...design.querySelectorAll('Layer')].map(l=>l.getAttribute('Self'));
  assert.ok(order.indexOf('cbForeground')>order.indexOf('cbBubbles')&&order.indexOf('cbForeground')<order.indexOf('cbFrames'),'IDML foreground layer is above frames and below bubbles');
  const spread=xml([...inner].find(([name])=>name.startsWith('Spreads/'))[1]);
  const foregroundFrames=[...spread.querySelectorAll('Polygon[ItemLayer="cbForeground"]')];
  assert.equal(foregroundFrames.length,2);assert.ok(foregroundFrames.every(f=>f.getAttribute('FillColor')==='Swatch/None'));
  assert.ok(spread.querySelector('TextFrame[ItemLayer="cbText"]'));
  const assets=[...outer].filter(([name])=>name.startsWith('Links/'));
  assert.equal(assets.length,1,'original PNG is deduplicated without flattening');
  const pngBytes=Buffer.from(assets[0][1]);assert.equal(pngBytes[25],6,'PNG keeps RGBA alpha channel');
  const idat=[];for(let offset=8;offset<pngBytes.length;){const n=pngBytes.readUInt32BE(offset),kind=pngBytes.subarray(offset+4,offset+8).toString();if(kind==='IDAT')idat.push(pngBytes.subarray(offset+8,offset+8+n));offset+=12+n;}
  const {inflateSync}=await import('node:zlib');assert.deepEqual(inflateSync(Buffer.concat(idat)),rows,'alpha pixels are unchanged in the packaged PNG');
  assert.equal(JSON.stringify(composed),beforeExport,'exports never mutate the album');
  assert.equal(networkRequests,0);
  console.log('PASS: page-wide SVG ordering, transparent frames, shared cross-panel bubble geometry and IDML layers/PNG alpha preservation');
  console.log('PASS: original transparent PNG, page-wide editing and connected bubbles across frames; image/group movement; transforms, stack order, isolated deletion; backup, normalization and IndexedDB');
} finally {
  rmSync(temporary,{recursive:true,force:true});dom.window.close();
}
