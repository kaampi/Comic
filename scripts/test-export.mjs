import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'comicbook-export-'));
fs.symlinkSync(path.resolve('node_modules'),path.join(dir,'node_modules'),process.platform === 'win32'?'junction':'dir');
try {
  for(const name of ['handDrawnBorder.ts','panelBorder.ts','panelGeometry.ts','imageView.ts','panelShape.ts','pageFormat.ts','pageTypography.ts','pageBackground.ts','exportFiles.ts','albumExport.tsx','SvgOverlay.tsx','richText.ts','ConnectedBubbles.tsx','bubbleConnections.ts','idmlGeometry.ts','SfxArtwork.tsx','sfxShapes.ts','thoughtBubble.ts','overlayTypography.ts']) {
    const source=fs.readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8');
    const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from "(\.[^"]+)"/g,'from "$1.mjs"');
    fs.writeFileSync(path.join(dir,name.replace(/\.tsx?$/,'.mjs')),output);
  }
  const f=await import(pathToFileURL(path.join(dir,'pageFormat.mjs'))), files=await import(pathToFileURL(path.join(dir,'exportFiles.mjs')));
  assert.equal(f.pageAspect(f.albumPageFormat({})),.6);
  assert.deepEqual(f.pageDimensions(f.DEFAULT_PAGE_FORMAT),{widthMm:210,heightMm:297});
  assert.deepEqual(f.pageDimensions({...f.DEFAULT_PAGE_FORMAT,preset:'letter',orientation:'landscape'}),{widthMm:279.4,heightMm:215.9});
  assert.deepEqual(f.pageDimensions({...f.DEFAULT_PAGE_FORMAT,preset:'custom',widthMm:170,heightMm:260}),{widthMm:170,heightMm:260});
  assert.deepEqual(f.rasterDimensions(f.DEFAULT_PAGE_FORMAT,300),{width:2480,height:3508});
  assert.deepEqual(f.rasterDimensions({...f.DEFAULT_PAGE_FORMAT,orientation:'landscape'},300),{width:3508,height:2480});
  assert.equal(f.validPageFormat({...f.DEFAULT_PAGE_FORMAT,widthMm:NaN}),false);
  assert.throws(()=>f.rasterDimensions({...f.DEFAULT_PAGE_FORMAT,preset:'custom',widthMm:1000,heightMm:1000},600),/export-too-large/);
  const rect=f.layerRect({gridColumns:3,gridRows:5},{x:0,y:0,width:3,height:5},f.LEGACY_PAGE_FORMAT);
  assert.equal(rect.x,10);assert.equal(rect.width,680);assert.equal(rect.height,700/.6-20);
  assert.equal(files.crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const archive=Buffer.from(await files.imageArchive([{name:'Å-001.png',bytes:new Uint8Array([1,2,3])},{name:'Å-002.png',bytes:new Uint8Array([4,5])}]).arrayBuffer());
  assert.equal(archive.readUInt32LE(0),0x04034b50);assert.equal(archive.readUInt16LE(6),0x800);assert.equal(archive.readUInt16LE(archive.length-12),2);
  const pdf=Buffer.from(await files.rasterPdf([{bytes:new Uint8Array([255,216,255,217]),width:20,height:30},{bytes:new Uint8Array([255,216,255,217]),width:20,height:30}],210,297).arrayBuffer());
  const text=pdf.toString('latin1');assert.match(text,/\/Count 2/);assert.match(text,/\/MediaBox \[0 0 595\.27559 841\.88976\]/);
  const xref=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(text.slice(xref,xref+4),'xref');
  for(const [i,line] of text.slice(xref).split('\n').slice(3,11).entries()) assert.equal(text.slice(Number(line.slice(0,10)),Number(line.slice(0,10))+7),`${i+1} 0 obj`);
  const jpeg=files.imageDensity(new Uint8Array([255,216,255,217]),'image/jpeg',300);assert.equal(jpeg[13],1);assert.equal((jpeg[14]<<8)|jpeg[15],300);assert.equal(jpeg.at(-1),217);
  const {pageSvg,exportAlbum,exportFilename}=await import(pathToFileURL(path.join(dir,'albumExport.mjs')));
  assert.equal(exportFilename('My:/album?'), 'My--album-');
  const layer={id:'frame',x:0,y:0,width:1,height:1,readingOrder:9,overlays:[{id:'text',type:'speech',text:'ÅÄÖ\nSecond line',fontFamily:'Comic Neue, sans-serif',x:5,y:5,width:85,height:45,fontSize:8,rotation:0,tailEnabled:true,tailX:30,tailY:65}]};
  const page={id:'page',number:1,gridColumns:3,gridRows:5,placements:[layer]}, project={pageFormat:f.DEFAULT_PAGE_FORMAT,pages:[page]};
  const markup=await pageSvg(project,page,'@font-face{font-family:test}',3);
  assert.match(markup,/<svg[^>]+width="2100"/);assert.match(markup,/stroke-width="6"[^>]*vector-effect="non-scaling-stroke"/);
  assert.match(markup,/ÅÄÖ/);assert.match(markup,/Second line/);assert.match(markup,/clip-path/);
  assert.ok(!markup.includes('readingOrder')&&!markup.includes('panel-corner-handle')&&!markup.includes('grid-cell'));
  const {linkBubbles,unlinkBubble,bubbleGroups,connectedBubbleGeometry,bubbleTailIsConnection,bubbleConnectionControls,bubbleConnectionRibbon,moveConnectionHandle}=await import(pathToFileURL(path.join(dir,'bubbleConnections.mjs')));
  const a={...layer.overlays[0],id:'a',text:'First',x:10,y:10,width:30,height:20,tailEnabled:false,rotation:0};
  const b={...a,id:'b',text:'Second',x:60,y:10};
  const {captionPath,bodyPath}=await import(pathToFileURL(path.join(dir,'SvgOverlay.mjs')));
  const {svgGeometry}=await import(pathToFileURL(path.join(dir,'idmlGeometry.mjs')));
  const caption={...a,type:'caption',roundness:0};
  const square=svgGeometry(captionPath(caption))[0];
  assert.equal(square.points.length,4,'zero-roundness captions have four exact corners');
  assert.ok(square.points.every(p=>p.anchor.x===p.left.x&&p.anchor.y===p.left.y&&p.anchor.x===p.right.x&&p.anchor.y===p.right.y),'square edges have no curve handles');
  for(const roundness of [-100,-50,-1]){
    const d=captionPath({...caption,roundness}),inward=svgGeometry(d)[0];
    assert.deepEqual(inward.points.map(p=>p.anchor),square.points.map(p=>p.anchor),'inward captions retain bounds and pointed corners');
    assert.ok(inward.points[0].right.y>inward.points[0].anchor.y,'top side bows inward');
    assert.ok(inward.points[1].right.x<inward.points[1].anchor.x,'right side bows inward');
    const captionPage={...page,placements:[{...layer,overlays:[{...caption,roundness}]}]};
    const captionMarkup=await pageSvg({...project,pages:[captionPage]},captionPage,'',1);
    assert.ok(captionMarkup.includes(d),'export uses the same concave caption path');
  }
  for(const roundness of [1,18,50,100])assert.equal(captionPath({...caption,roundness}),bodyPath({...caption,roundness},'organic'),'existing positive caption rounding is unchanged');
  const original=[a,b],linked=linkBubbles(original,'a','b');
  assert.equal(original[0].bubbleLinks,undefined,'linking does not mutate source');
  assert.deepEqual(linked[0].bubbleLinks,[{targetId:'b',width:20}]);
  assert.equal(linkBubbles(linked,'b','a'),linked,'duplicate and cyclic connections are rejected');
  assert.equal(bubbleGroups(linked).length,1);
  const shape=connectedBubbleGeometry(linked);
  assert.equal(connectedBubbleGeometry(linked.map(o=>({...o,fillColor:'#abcdef',strokeColor:'#123456',text:'Edited text',fontSize:14}))),shape,'color/text changes reuse contours');
  assert.notEqual(connectedBubbleGeometry(linked,{width:500,height:200}),shape,'physical panel dimensions invalidate contours');
  for(const patch of [{x:11},{width:31},{rotation:10},{roundness:10},{bubbleStyle:'shout'},{bubbleLinks:[{targetId:'b',width:40}]}]) {
    assert.notEqual(connectedBubbleGeometry([{...linked[0],...patch},linked[1]]),shape,'shape changes invalidate cached contours');
  }
  const curveMetrics={width:500,height:250};
  const curvedLink={targetId:'b',width:20,startControl:{along:.3,across:.5},endControl:{along:.3,across:-.5}};
  const curved=[{...linked[0],bubbleLinks:[curvedLink]},linked[1]];
  const curveGeometry=connectedBubbleGeometry(curved,curveMetrics);
  assert.notEqual(curveGeometry.fillPath,connectedBubbleGeometry(linked,curveMetrics).fillPath);
  assert.equal(curveGeometry.polygons.length,1,'S curve stays joined to both bubbles');
  const ribbon=bubbleConnectionRibbon(a,b,curvedLink,curveMetrics),controls=bubbleConnectionControls(a,b,curvedLink,curveMetrics);
  assert.ok(ribbon.some(p=>p.y<controls.start.y)&&ribbon.some(p=>p.y>controls.start.y),'S curve crosses both sides of its chord');
  for(const handle of ['start','end','control1','control2']){
    const changed=moveConnectionHandle(a,b,curvedLink,handle,{x:45,y:45},curveMetrics);
    assert.notDeepEqual(changed,curvedLink);
    assert.ok(!/NaN|Infinity/.test(connectedBubbleGeometry([{...a,bubbleLinks:[changed]},b],curveMetrics).fillPath));
  }
  for(const type of ['speech','thought']) for(const rotation of [0,37,-90]) for(const across of [-.75,-.3,0,.3,.75]) {
    const pair=[{...a,type,rotation,bubbleLinks:[{...curvedLink,startAngle:rotation/180,endAngle:Math.PI,startControl:{along:.05,across},endControl:{along:.45,across:-across}}]},{...b,type,y:60,rotation:-rotation}];
    const geometry=connectedBubbleGeometry(pair,curveMetrics);
    assert.ok(geometry.polygons.length&&geometry.boundary.length);
    assert.ok(!/NaN|Infinity/.test(geometry.fillPath));
  }
  assert.equal(connectedBubbleGeometry([{...a,bubbleLinks:[{targetId:'b',width:20}]},b],curveMetrics).fillPath,connectedBubbleGeometry(linked,curveMetrics).fillPath,'reset preserves legacy straight geometry');
  const endpointWidth=(ribbon,index)=>{
    const count=(ribbon.length-2)/2;
    const left=ribbon[1+index],right=ribbon[2+count+(count-1-index)];
    return Math.hypot((left.x-right.x)*curveMetrics.width/100,(left.y-right.y)*curveMetrics.height/100);
  };
  for(const controls of [{}, {startControl:{along:.3,across:.5},endControl:{along:.3,across:-.5}}]){
    const taper={targetId:'b',width:20,startWidth:60,endWidth:10,...controls};
    const taperedRibbon=bubbleConnectionRibbon(a,b,taper,curveMetrics);
    assert.ok(Math.abs(endpointWidth(taperedRibbon,0)/endpointWidth(taperedRibbon,48)-6)<1e-6,'endpoint ratio survives bend safety limits');
    const reverse=bubbleConnectionRibbon(a,b,{...taper,startWidth:10,endWidth:60},curveMetrics);
    assert.ok(Math.abs(endpointWidth(reverse,48)/endpointWidth(reverse,0)-6)<1e-6,'taper reverses independently');
    const taperedPair=[{...a,bubbleLinks:[taper]},b];
    const g=connectedBubbleGeometry(taperedPair,curveMetrics);
    assert.equal(g.polygons.length,1,'straight and curved tapers retain one joined contour');
    assert.notEqual(g.fillPath,connectedBubbleGeometry([{...a,bubbleLinks:[{...taper,startWidth:10,endWidth:60}]},b],curveMetrics).fillPath);
    const taperedPage={...page,placements:[{...layer,overlays:taperedPair}]};
    const taperMarkup=await pageSvg({...project,pages:[taperedPage]},taperedPage,'',1);
    assert.match(taperMarkup,/connected-bubble-outline/);
  }
  assert.equal(connectedBubbleGeometry([{...a,bubbleLinks:[{targetId:'b',width:20,startWidth:20,endWidth:20}]},b],curveMetrics).fillPath,connectedBubbleGeometry(linked,curveMetrics).fillPath,'equal explicit widths preserve legacy appearance');
  const curvedPage={...page,placements:[{...layer,overlays:curved}]};
  const curvedMarkup=await pageSvg({...project,pages:[curvedPage]},curvedPage,'',1);
  assert.match(curvedMarkup,/connected-bubble-outline/);
  assert.ok(!curvedMarkup.includes('connection-handle'),'editing guides do not appear in exported pages');
  // Reproduce a narrow-to-wide S join on elliptical bubbles. Only turns with
  // visible-length neighbors count; tiny intersection slivers have no area.
  for(const endWidth of [30,50]){
    const rootA={...a,x:0,y:55,width:45,height:35,roundness:100};
    const rootB={...rootA,id:'b',x:50,y:0};
    const rootLink={targetId:'b',width:20,startWidth:10,endWidth,startAngle:-1.3,endAngle:1.3,startControl:{along:.3,across:-.45},endControl:{along:.3,across:.45}};
    const contour=connectedBubbleGeometry([{...rootA,bubbleLinks:[rootLink]},rootB],{width:600,height:400});
    assert.equal(contour.polygons.length,1);
    const turns=contour.polygons[0].map((p,i,poly)=>{
      const previous=poly[(i+poly.length-1)%poly.length],next=poly[(i+1)%poly.length];
      const v={x:(p.x-previous.x)*6,y:(p.y-previous.y)*4},w={x:(next.x-p.x)*6,y:(next.y-p.y)*4};
      const lv=Math.hypot(v.x,v.y),lw=Math.hypot(w.x,w.y);
      return Math.min(lv,lw)<.25?0:Math.acos(Math.max(-1,Math.min(1,(v.x*w.x+v.y*w.y)/(lv*lw))));
    });
    assert.ok(Math.max(...turns)<1,'10–'+endWidth+' join has no exposed sharp cap corner: '+Math.max(...turns));
  }
  let curveSeed=42;
  const curveRandom=()=>((curveSeed=(Math.imul(curveSeed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<500;i++){
    const body={...a,type:i%2?'thought':'speech',x:curveRandom()*60,y:curveRandom()*60,width:8+curveRandom()*30,height:8+curveRandom()*30,rotation:curveRandom()*360,tailEnabled:false};
    const other={...body,id:'b',x:curveRandom()*60,y:curveRandom()*60,rotation:curveRandom()*360};
    const link={targetId:'b',width:2+curveRandom()*78,startWidth:2+curveRandom()*78,endWidth:2+curveRandom()*78,startAngle:curveRandom()*6.28,endAngle:curveRandom()*6.28,startControl:{along:.05+curveRandom()*.4,across:curveRandom()*1.5-.75},endControl:{along:.05+curveRandom()*.4,across:curveRandom()*1.5-.75}};
    const geometry=connectedBubbleGeometry([{...body,bubbleLinks:[link]},other],{width:100+curveRandom()*700,height:100+curveRandom()*700});
    assert.ok(geometry.polygons.length&&!/NaN|Infinity/.test(geometry.fillPath),'seeded extreme attachments, overlaps and bends retain closed finite contours');
  }
  console.log('PASS: independent endpoints and handles, S curves, physical aspect ratios, rotated speech/thought bubbles and curved SVG export');
  assert.equal(shape.polygons.length,1,'separate bubbles become one closed contour');
  assert.ok(shape.boundary.every(([a,b])=>Number.isFinite(a.x+b.y)));
  const area=poly=>Math.abs(poly.reduce((sum,p,i)=>sum+p.x*poly[(i+1)%poly.length].y-p.y*poly[(i+1)%poly.length].x,0))/2;
  assert.ok(area(shape.polygons[0])>area(connectedBubbleGeometry([a]).polygons[0])*2,'bridge adds filled area');
  const moved=linked.map(o=>o.id==='b'?{...o,y:65,rotation:40}:o);
  assert.notEqual(connectedBubbleGeometry(moved,{width:500,height:200}).fillPath,shape.fillPath,'moving and rotating updates the connector in physical coordinates');
  for(const type of ['speech','thought'])for(const [x,y,rotation] of [[10,10,0],[10,10,30],[15,15,0],[40,10,0],[60,60,-30],[60,10,0]]){
    const pair=linkBubbles([{...a,type,tailEnabled:true,tailX:5,tailY:65},{...b,type,x,y,rotation,tailEnabled:true,tailX:95,tailY:80}],'a','b');
    const geometry=connectedBubbleGeometry(pair,{width:500,height:300});
    assert.ok(geometry.polygons.length&&geometry.boundary.length,`${type} overlap and tail contours remain closed`);
    assert.ok(!/NaN|Infinity/.test(geometry.fillPath));
  }
  for(const type of ['speech','thought']){
    const tails=linkBubbles([{...a,type,tailEnabled:true,tailX:-40,tailY:90},{...b,type,tailEnabled:true,tailX:95,tailY:95}],'a','b');
    assert.equal(bubbleTailIsConnection(tails[0],tails),true);assert.equal(bubbleTailIsConnection(tails[1],tails),false);
    const contour=connectedBubbleGeometry(tails).fillPath;
    assert.equal(connectedBubbleGeometry(tails.map(o=>o.id==='a'?{...o,tailX:-90,tailY:150}:o)).fillPath,contour,'source tail is replaced, not drawn in addition to connector');
    assert.notEqual(connectedBubbleGeometry(tails.map(o=>o.id==='b'?{...o,tailX:98,tailY:130}:o)).fillPath,contour,'destination retains its own tail');
    const detached=unlinkBubble(tails,'a');
    assert.equal(bubbleTailIsConnection(detached[0],detached),false);
    assert.equal(detached[0].tailX,-40,'authored source tail returns unchanged on disconnect');
    assert.ok(connectedBubbleGeometry([detached[0]]).polygons.some(poly=>poly.some(p=>p.x<0)),'detached tail is visible again');
  }
  assert.equal(bubbleGroups(unlinkBubble(linked,'b')).length,0);
  assert.equal(unlinkBubble(linked,'b')[0].text,'First');
  const connectedLayer={...layer,overlays:linked},connectedPage={...page,placements:[connectedLayer]};
  const connectedMarkup=await pageSvg({...project,pages:[connectedPage]},connectedPage,'',3);
  assert.match(connectedMarkup,/connected-bubble-outline/);assert.match(connectedMarkup,/First/);assert.match(connectedMarkup,/Second/);
  assert.match(connectedMarkup,/stroke-width="6"[^>]*vector-effect="non-scaling-stroke"/);
  console.log('PASS: linked speech/thought bubbles, exposed union contours, overlapping/rotated bodies and tails, live geometry, duplicate rejection, disconnect and SVG export.');
  const {formatTextRange,clearTextRange,editedTextStyles,textStyleAt,richTextLayout}=await import(pathToFileURL(path.join(dir,'richText.mjs')));
  const mixed={...a,text:'One BIG word\n\nÅ🙂Z',fontSize:8,width:100,height:100,textPadding:5};
  mixed.textStyles=formatTextRange(mixed,4,7,{fontFamily:'Impact, sans-serif',fontSize:20,fontWeight:900});
  assert.deepEqual(textStyleAt(mixed,5),{fontFamily:'Impact, sans-serif',fontSize:20,fontWeight:900});
  assert.equal(textStyleAt(mixed,3).fontSize,undefined);
  const shifted=editedTextStyles(mixed,'X '+mixed.text);assert.equal(shifted[0].start,6);assert.equal(shifted[0].end,9);
  const extended=editedTextStyles(mixed,mixed.text.replace('BIG','BIG!'));assert.equal(extended[0].end,8);
  const shortened=editedTextStyles(mixed,mixed.text.replace('BIG','B'));assert.equal(shortened[0].end,5);
  const repeated={...mixed,text:'aaa',textStyles:[{start:1,end:2,fontSize:20}]};
  assert.equal(editedTextStyles(repeated,'aa',{start:0,end:1})[0].start,0,'actual edit position disambiguates repeated letters');
  const split=clearTextRange(mixed,5,6);assert.deepEqual(split.map(r=>[r.start,r.end]),[[4,5],[6,7]]);
  const richLayout=richTextLayout(mixed,{width:160,height:250,pageWidthMm:210});
  assert.ok(richLayout.rows.some(r=>r.start===r.end),'authored blank line survives mixed typography');
  assert.ok(richLayout.rows.some(r=>r.size>10));
  for(const row of richLayout.rows)assert.ok(row.lineWidth<=144+1e-7,'mixed font widths respect both margins');
  const mixedPage={...page,placements:[{...layer,overlays:[mixed]}]};
  const mixedMarkup=await pageSvg({...project,pages:[mixedPage]},mixedPage,'',1);
  assert.match(mixedMarkup,/rich-overlay-text/);assert.match(mixedMarkup,/font-family="Impact, sans-serif"/);assert.match(mixedMarkup,/font-weight="900"/);
  assert.ok([...mixedMarkup.matchAll(/font-size="([^"]+)"/g)].some(m=>Math.abs(Number(m[1])-20*25.4/72*700/210)<1e-7));
  console.log('PASS: mixed font families/weights/sizes, variable line heights, blank lines, edits/inheritance, reset, Unicode offsets and SVG export.');
  for(const type of ['speech','thought','caption','sfx']){
    const white={...a,type,text:'White RED white',textColor:'#ffffff',fillOpacity:0,width:100,height:100,fontSize:8};
    const whitePage={...page,placements:[{...layer,overlays:[white]}]};
    const plainWhite=await pageSvg(project,whitePage,'',1);
    assert.match(plainWhite,/<text[^>]+fill="#ffffff"/);
    white.textStyles=formatTextRange(white,6,9,{textColor:'#ff0000'});
    assert.equal(editedTextStyles(white,'White RED! white')[0].textColor,'#ff0000','inserted text inherits local color');
    const colored=await pageSvg(project,whitePage,'',1);
    assert.match(colored,/<tspan[^>]+fill="#ff0000"[^>]*>RED<\/tspan>/);
    assert.match(colored,/<tspan[^>]+fill="#ffffff"/);
    assert.equal(clearTextRange(white,6,9).length,0,'reset removes the local color');
    const legacy={...white,textColor:undefined,textStyles:undefined,sfxTextColor:'#123456'};
    assert.match(await pageSvg(project,{...page,placements:[{...layer,overlays:[legacy]}]},'',1),/<text[^>]+fill="#123456"/,'legacy SFX colors remain compatible');
  }
  console.log('PASS: white text with transparent fill, all overlay types, mixed colors, insertion/reset and legacy SFX SVG colors.');
  const typography=await import(pathToFileURL(path.join(dir,'pageTypography.mjs')));
  const sized={...layer.overlays[0],text:'Same size',fontSize:12};
  const background={...layer,id:'background',overlays:[sized]};
  const small={...layer,id:'small',overlays:[sized]};
  const large={...layer,id:'large',x:1,width:2,height:3,overlays:[sized]};
  const typedPage={...page,background,placements:[small,large]};
  const typedProject={...project,typographyVersion:2,pages:[typedPage]};
  const metrics=[background,small,large].map(l=>typography.pageLayerTextMetrics(typedProject,typedPage,l));
  const canonicalSize=12*25.4/72*700/210;
  for(const metric of metrics) assert.ok(Math.abs(typography.overlayTextLayout(sized,metric).fontSize-canonicalSize)<1e-9);
  const typedMarkup=await pageSvg(typedProject,typedPage,'',1);
  assert.equal([...typedMarkup.matchAll(/font-size="([^"]+)"/g)].length,3);
  for(const match of typedMarkup.matchAll(/font-size="([^"]+)"/g)) assert.ok(Math.abs(Number(match[1])-canonicalSize)<1e-9);
  const inverses=[...typedMarkup.matchAll(/scale\(([^ ]+) ([^)]+)\)/g)];
  assert.equal(inverses.length,3);
  inverses.forEach((match,i)=>{
    // The layer viewBox scaling and text's inverse scaling cancel on both axes.
    assert.ok(Math.abs(metrics[i].width/100*Number(match[1])-1)<1e-9);
    assert.ok(Math.abs(metrics[i].height/100*Number(match[2])-1)<1e-9);
  });
  const resized={...typedPage,placements:[{...small,width:3,height:4}]};
  assert.equal(typography.overlayTextLayout(sized,typography.pageLayerTextMetrics(typedProject,resized,resized.placements[0])).fontSize,canonicalSize);
  assert.equal(typography.overlayTextLayout({...sized,width:20,height:10},metrics[1]).fontSize,canonicalSize);
  const legacy={...typedProject,typographyVersion:undefined,overlayDefaults:{speech:{fontSize:8}}};
  const snapshot=structuredClone(legacy),normalized=typography.normalizeProjectTypography(legacy);
  assert.deepEqual(legacy,snapshot);
  assert.equal(normalized.typographyVersion,2);
  assert.strictEqual(typography.normalizeProjectTypography(normalized),normalized);
  [normalized.pages[0].background,...normalized.pages[0].placements].forEach((l,i)=>{
    assert.equal(l.id,[background,small,large][i].id);
    assert.equal(l.overlays[0].id,sized.id);
    const physical=typography.overlayTextLayout(l.overlays[0],metrics[i]).fontSize;
    assert.ok(Math.abs(physical-12*.6*metrics[i].height/100)<.02,'legacy visual height is preserved to 0.01pt rounding');
  });
  const portrait=typography.overlayTextLayout(sized,metrics[1]).fontSize*210/700;
  const landscape=typography.overlayTextLayout(sized,{...metrics[1],pageWidthMm:297}).fontSize*297/700;
  assert.ok(Math.abs(portrait-landscape)<1e-9,'physical point size survives page format changes');
  console.log('PASS: equal point sizes across background, small/large panels, resize, page formats and SVG export; no glyph stretching; one-time legacy migration.');
  const {wrapOverlayTextToWidth}=await import(pathToFileURL(path.join(dir,'overlayTypography.mjs')));
  const proportional=text=>Array.from(text).reduce((sum,c)=>sum+(c==='W'?10:c===' '?3:2),0);
  assert.deepEqual(wrapOverlayTextToWidth('iiii iiii iiii iiii',24,proportional),['iiii iiii','iiii iiii']);
  assert.deepEqual(wrapOverlayTextToWidth('WW WW WW',24,proportional),['WW','WW','WW']);
  assert.deepEqual(wrapOverlayTextToWidth('ÅÄÖ\r\n\r\nTest',24,proportional),['ÅÄÖ','','Test']);
  assert.deepEqual(wrapOverlayTextToWidth('WWWWWW',24,proportional),['WW','WW','WW']);
  const paddingOverlay={...sized,width:100,height:80,text:'iiii iiii iiii iiii',textPadding:10};
  const paddingMetrics={width:40,height:100,pageWidthMm:210};
  const layout=typography.overlayTextLayout(paddingOverlay,paddingMetrics,proportional);
  assert.deepEqual(layout.textLines,['iiii iiii iiii','iiii']);
  for(const padding of [0,10,25]){
    const left=typography.overlayTextLayout({...paddingOverlay,textAlign:'left',textPadding:padding},paddingMetrics,proportional);
    const right=typography.overlayTextLayout({...paddingOverlay,textAlign:'right',textPadding:padding},paddingMetrics,proportional);
    assert.equal(left.textX,40-right.textX,'equal left and right inset');
    for(const line of left.textLines)assert.ok(proportional(line)<=40-2*40*padding/100);
  }
  // Exercise the browser measurer and font loading used by the actual export path.
  const fontsRequested=[],fontDeclarations=[];
  const oldDocument=globalThis.document,oldCanvas=globalThis.CanvasRenderingContext2D;
  let loaded=false;
  globalThis.CanvasRenderingContext2D=class {};
  globalThis.document={fonts:{load:async(font)=>{fontsRequested.push(font);loaded=true;return [];}},createElement:()=>({getContext:()=>({font:'',measureText(text){assert.ok(loaded);fontDeclarations.push(this.font);return {width:proportional(text)};}})})};
  try {
    const measuredPage={...typedPage,background:undefined,placements:[{...small,overlays:[{...paddingOverlay,text:'iiii iiii iiii iiii',textAlign:'left',fontWeight:700,fontFamily:'Patrick Hand, cursive'}]}]};
    const svg=await pageSvg(typedProject,measuredPage,'',1);
    assert.ok(fontsRequested[0].includes('700 16px Patrick Hand'));
    assert.ok(fontDeclarations.every(font=>font.includes('700')&&font.includes('Patrick Hand')));
    assert.match(svg,/iiii iiii iiii iiii/);
  }finally{
    if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
    if(oldCanvas===undefined)delete globalThis.CanvasRenderingContext2D;else globalThis.CanvasRenderingContext2D=oldCanvas;
  }
  console.log('PASS: proportional font widths, equal padding, long words, authored blank lines, selected font/weight and font-loaded SVG export.');
  const shapes=await import(pathToFileURL(path.join(dir,'panelShape.mjs')));
  for(const preset of shapes.PANEL_SHAPE_PRESETS){
    assert.ok(shapes.validPanelShape(preset.points));
    assert.equal(shapes.shapePreset({shapePoints:preset.points}),preset.id);
    const shapedPage={...page,placements:[{...layer,shapePoints:preset.points}]};
    const svg=await pageSvg(project,shapedPage,'',1);
    if(preset.id!=='rectangle'){
      assert.match(svg,/<clipPath[^>]*><polygon/);
      assert.equal((svg.match(/<polygon/g)||[]).length,3);
      assert.match(svg,/stroke-linejoin="round"/);
    }else assert.match(svg,/<clipPath[^>]*><rect/);
    assert.ok(!svg.includes('panel-shape-handle')&&!svg.includes('stroke-dasharray'));
  }
  const rectangle=shapes.panelShapePoints({});
  const snapped=shapes.moveShapeCorner(rectangle,0,.7,.1);
  assert.deepEqual(snapped[0],{x:1,y:0});
  assert.deepEqual(rectangle[0],{x:0,y:0});
  assert.strictEqual(shapes.moveShapeCorner(rectangle,0,4,4),rectangle);
  assert.strictEqual(shapes.moveShapeCorner(rectangle,0,4,0),rectangle);
  assert.equal(shapes.validPanelShape([{x:0,y:0},{x:4,y:4},{x:4,y:0},{x:0,y:4}]),false);
  assert.equal(shapes.validPanelShape([{x:0,y:0},{x:NaN,y:0},{x:4,y:4}]),false);
  assert.equal(shapes.validPanelShape([{x:0,y:0},{x:1.5,y:0},{x:4,y:4}]),true);
  assert.equal(shapes.validPanelShape([{x:0,y:0},{x:5,y:0},{x:4,y:4}]),false);
  assert.equal(shapes.validPanelShape([{x:0,y:0},{x:1,y:1},{x:2,y:2}]),false);
  assert.equal(shapes.shapeClipPath({shapePoints:shapes.PANEL_SHAPE_PRESETS[1].points}),'polygon(50% 0%,100% 50%,50% 100%,0% 50%)');
  assert.deepEqual(shapes.panelShapeGrid({width:1,height:1}),{columns:4,rows:4});
  assert.deepEqual(shapes.panelShapeGrid({width:3,height:5}),{columns:12,rows:20});
  const wideSnapped=shapes.moveShapeCorner(rectangle,0,.7,.1,12,20);
  assert.ok(Math.abs(wideSnapped[0].x-2/3)<1e-12);
  assert.equal(wideSnapped[0].y,.2);
  assert.equal(shapes.validPanelShape(wideSnapped),true);
  const fractionalPage={...page,placements:[{...layer,width:3,height:5,shapePoints:wideSnapped}]};
  assert.match(await pageSvg(project,fractionalPage,'',1),/<clipPath[^>]*><polygon/);
  console.log('PASS: snap spacing scales with panel cell spans and fractional normalized corners remain valid/exportable.');
  console.log('PASS: all panel shapes, 4×4 corner snapping, invalid/crossing rejection and polygon artwork/export contours.');
  const notch=[{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:3,y:4},{x:3,y:1},{x:1,y:1},{x:1,y:4},{x:0,y:4}];
  assert.ok(shapes.validPanelShape(notch),'concave notches are supported');
  const added=shapes.insertShapeNode(rectangle,0,{x:2,y:0},[0,2]);
  assert.deepEqual(added.hidden,[0,1,3]);
  assert.deepEqual(shapes.removeShapeNode(added.points,1,added.hidden),{points:rectangle,hidden:[2,0]});
  assert.equal(shapes.removeShapeNode(shapes.PANEL_SHAPE_PRESETS[4].points,0),null);
  assert.equal(shapes.validPanelShape([...rectangle,{x:2,y:0}]),false,'non-adjacent touching is rejected');
  assert.equal(shapes.moveShapeCorner(rectangle,0,.37,.18,4,4,false)[0].x,.37);
  const notchGeometry=await import(pathToFileURL(path.join(dir,'panelGeometry.mjs')));
  const notched={...layer,width:3,height:5,shapePoints:notch};
  const inNotch={...layer,id:'inside-notch',x:0,y:0,width:3,height:5,shapePoints:[{x:1.5,y:2},{x:2.5,y:2},{x:2.5,y:3},{x:1.5,y:3}]};
  assert.equal(notchGeometry.panelsOverlap(page,notched,inNotch,f.DEFAULT_PAGE_FORMAT),false,'a panel can sit inside a notch');
  assert.equal(notchGeometry.panelsOverlap(page,notched,{...inNotch,shapePoints:undefined},f.DEFAULT_PAGE_FORMAT),true);
  const openLayer={...layer,overlays:[],hiddenShapeEdges:[0,2]},openPage={...page,placements:[openLayer]};
  const openSvg=await pageSvg(project,openPage,'',1);
  assert.equal((openSvg.match(/stroke-linecap="round"/g)||[]).length,2,'only visible edges export');
  const allHidden=await pageSvg(project,{...openPage,placements:[{...openLayer,hiddenShapeEdges:[0,1,2,3]}]},'',1);
  assert.ok(!allHidden.includes('stroke-width='),'all frame edges may be hidden');
  console.log('PASS: concave shapes, node insertion/removal, hidden-edge remapping, free movement, notch overlap and open-frame export.');
  const view=await import(pathToFileURL(path.join(dir,'imageView.mjs')));
  const oldCrop={fit:'cover',zoom:2,offsetX:40,offsetY:60};
  const oldPlaced=view.imagePlacement(oldCrop,100,100,200,100);
  const converted=view.framePosition(oldCrop,100,100,200,100);
  assert.deepEqual(converted,{offsetX:-40,offsetY:0});
  assert.deepEqual(view.imagePlacement({...oldCrop,...converted,positionMode:'frame'},100,100,200,100),oldPlaced);
  const moving={fit:'cover',zoom:2,offsetX:0,offsetY:25,positionMode:'frame'};
  assert.equal(view.imagePlacement(moving,100,100,200,100).y,-25,'move down works when intrinsic cover height matches frame height');
  assert.equal(view.imagePlacement({...moving,offsetY:-25},100,100,200,100).y,-75);
  for(const fit of ['cover','contain'])for(const zoom of [1,2,4]){
    const centered=view.imagePlacement({fit,zoom,positionMode:'frame'},200,100,400,300);
    const moved=view.imagePlacement({fit,zoom,positionMode:'frame',offsetX:15,offsetY:20},200,100,400,300);
    assert.ok(Math.abs(moved.x-centered.x-30)<1e-9);
    assert.ok(Math.abs(moved.y-centered.y-20)<1e-9);
  }
  assert.deepEqual(view.panFramePosition({offsetX:0,offsetY:0},40,-20,400,200),{offsetX:10,offsetY:-10});
  assert.deepEqual(view.panFramePosition({offsetX:90,offsetY:-90},400,-200,400,200),{offsetX:100,offsetY:-100});
  assert.equal(view.imageViewStyle(moving).transform,'translate(0%, 25%) scale(2)');
  const previousImage=globalThis.Image;
  globalThis.Image=class{async decode(){this.naturalWidth=200;this.naturalHeight=100;}};
  try {
    const exportImage={...moving,rotation:30,name:'position.png',dataUrl:'data:image/png;base64,eA=='};
    const positionedPage={...page,placements:[{...layer,image:exportImage}]};
    const svg=await pageSvg(project,positionedPage,'',1);
    const imageTag=svg.match(/<image [^>]+/)[0];
    const layerBox=f.layerRect(positionedPage,layer,project.pageFormat);
    const expected=view.imagePlacement(exportImage,layerBox.width-6,layerBox.height-6,200,100);
    const x=Number(imageTag.match(/ x="([^"]+)"/)[1]),y=Number(imageTag.match(/ y="([^"]+)"/)[1]);
    assert.ok(Math.abs(x-(layerBox.x+3+expected.x))<1e-9);
    assert.ok(Math.abs(y-(layerBox.y+3+expected.y))<1e-9);
    const rotation=imageTag.match(/transform="rotate\(([^)]+)\)"/)[1].split(' ').map(Number);
    assert.equal(rotation[0],30);
    assert.ok(Math.abs(rotation[1]-(x+expected.width/2))<1e-9);
    assert.ok(Math.abs(rotation[2]-(y+expected.height/2))<1e-9);
    const matrix=view.imageAffineTransform(exportImage,expected,200,100);
    const centre={x:matrix.a*100+matrix.c*50+matrix.e,y:matrix.b*100+matrix.d*50+matrix.f};
    assert.ok(Math.abs(centre.x-(expected.x+expected.width/2))<1e-9);
    assert.ok(Math.abs(centre.y-(expected.y+expected.height/2))<1e-9);
    for(const rotation of [0,30,-90])for(const flipX of [false,true])for(const flipY of [false,true]) {
      const reflected={...exportImage,rotation,flipX,flipY};
      const reflectedMatrix=view.imageAffineTransform(reflected,expected,200,100);
      const map=(px,py)=>({x:reflectedMatrix.a*px+reflectedMatrix.c*py+reflectedMatrix.e,y:reflectedMatrix.b*px+reflectedMatrix.d*py+reflectedMatrix.f});
      const center=map(100,50),corner=map(0,0),angle=rotation*Math.PI/180;
      const dx=-expected.width/2*(flipX?-1:1),dy=-expected.height/2*(flipY?-1:1);
      assert.ok(Math.abs(center.x-(expected.x+expected.width/2))<1e-9);
      assert.ok(Math.abs(center.y-(expected.y+expected.height/2))<1e-9);
      assert.ok(Math.abs(corner.x-(center.x+Math.cos(angle)*dx-Math.sin(angle)*dy))<1e-9);
      assert.ok(Math.abs(corner.y-(center.y+Math.sin(angle)*dx+Math.cos(angle)*dy))<1e-9);
      const flippedSvg=await pageSvg(project,{...positionedPage,placements:[{...layer,image:reflected}]},'',1);
      if(flipX||flipY)assert.ok(flippedSvg.includes(`scale(${flipX?-1:1} ${flipY?-1:1})`),'SVG reflects the original about its positioned center');
      else assert.ok(!flippedSvg.match(/<image[^>]+scale\(/));
      assert.deepEqual(view.imagePlacement(reflected,layerBox.width-6,layerBox.height-6,200,100),expected,'flip leaves positioning/zoom unchanged');
    }
    assert.equal(view.normalizedImageRotation(181),-179);
    assert.equal(view.normalizedImageRotation(-181),179);
    console.log('PASS: rotated SVG keeps the same image centre and clipping; affine IDML coordinates agree.');
  }finally{if(previousImage===undefined)delete globalThis.Image;else globalThis.Image=previousImage;}
  console.log('PASS: direct image panning on both axes at every zoom/fit, legacy crop preservation and matching CSS/export placement.');
  const geometry=await import(pathToFileURL(path.join(dir,'panelGeometry.mjs')));
  const rightPanel={...layer,id:'right',x:0,y:0,width:3,height:1,readingOrder:1,shapePoints:[{x:8/3,y:0},{x:4,y:0},{x:4,y:4},{x:2,y:4}]};
  const leftPanel={...layer,id:'left',x:0,y:0,width:1,height:1,readingOrder:5};
  const sharedPage={...page,placements:[rightPanel,leftPanel]};
  const fitted=geometry.fitPanelToNeighbor(sharedPage,leftPanel,rightPanel,'left',2,project.pageFormat);
  assert.ok(fitted);
  assert.equal(fitted.width,3);
  assert.equal(fitted.id,leftPanel.id);
  assert.deepEqual(fitted.overlays,leftPanel.overlays);
  assert.equal(geometry.panelsOverlap(sharedPage,fitted,rightPanel,project.pageFormat),false);
  const neighborOutline=geometry.panelOutline(sharedPage,rightPanel,project.pageFormat);
  const edgeA=neighborOutline.at(-1),edgeB=neighborOutline[0],length=Math.hypot(edgeB.x-edgeA.x,edgeB.y-edgeA.y);
  const nx=(edgeB.y-edgeA.y)/length,ny=(edgeA.x-edgeB.x)/length;
  const expectedGap=2*700/210+3;
  const fittedOutline=geometry.panelOutline(sharedPage,fitted,project.pageFormat);
  for(const point of [fittedOutline[1],fittedOutline[2]])assert.ok(Math.abs((point.x-edgeA.x)*nx+(point.y-edgeA.y)*ny-expectedGap)<1e-7,'exact perpendicular 2mm gap between visible frames');
  assert.equal(geometry.panelsOverlap(sharedPage,{...fitted,shapePoints:undefined},rightPanel,project.pageFormat),true);
  const blocker={...layer,id:'blocker',x:0,y:0,width:1,height:1,overlays:[]};
  assert.equal(geometry.fitPanelToNeighbor({...sharedPage,placements:[rightPanel,leftPanel,blocker]},leftPanel,rightPanel,'left',2,project.pageFormat),null);
  assert.equal(geometry.fitPanelToNeighbor(sharedPage,leftPanel,rightPanel,'left',NaN,project.pageFormat),null);
  for(const side of ['left','right','above','below']){
    const center={...layer,id:'center',x:1,y:2,width:1,height:1,overlays:[]};
    const outside={...layer,id:'outside',x:side==='right'?2:side==='left'?0:1,y:side==='below'?3:side==='above'?1:2,width:1,height:1,overlays:[]};
    const pg={...page,placements:[center,outside]};
    assert.ok(geometry.fitPanelToNeighbor(pg,outside,center,side,1,project.pageFormat));
  }
  const fittedSvg=await pageSvg(project,{...sharedPage,placements:[rightPanel,fitted]},'',1);
  assert.equal((fittedSvg.match(/<clipPath[^>]*><polygon/g)||[]).length,2);
  console.log('PASS: shared-cell polygon placement, parallel neighbor fitting, physical frame gap, all four sides and collision rejection.');
  const borders=await import(pathToFileURL(path.join(dir,'panelBorder.mjs')));
  assert.ok(Math.abs(borders.panelBorderWidth(project,layer)-3)<1e-9,'legacy frame width retained');
  const redDefault={color:'#cc2233',thicknessPt:3,visible:true};
  const blueOverride={color:'#2244cc',thicknessPt:6,visible:true};
  const borderedProject={...project,panelBorderDefaults:redDefault};
  assert.deepEqual(borders.panelBorderStyle(borderedProject,layer),redDefault);
  assert.deepEqual(borders.panelBorderStyle(borderedProject,{...layer,panelBorder:blueOverride}),blueOverride);
  assert.equal(borders.panelBorderWidth(borderedProject,{...layer,panelBorder:{...blueOverride,visible:false}}),0);
  assert.equal(borders.validPanelBorder({...redDefault,color:'red'}),false);
  assert.equal(borders.validPanelBorder({...redDefault,thicknessPt:-1}),false);
  for(const patch of [{style:'unknown'},{roughness:-1},{roughness:101},{roughness:'50'}])assert.equal(borders.validPanelBorder({...redDefault,...patch}),false);
  const {handDrawnBorderPath}=await import(pathToFileURL(path.join(dir,'handDrawnBorder.mjs')));
  const inkPoints=geometry.panelOutline(sharedPage,rightPanel,project.pageFormat);
  const ink=handDrawnBorderPath(inkPoints,3,50,rightPanel.id);
  assert.equal(ink,handDrawnBorderPath(inkPoints,3,50,rightPanel.id),'ink is deterministic across reloads');
  assert.notEqual(ink,handDrawnBorderPath(inkPoints,3,50,'another-panel'),'different panels have different ink');
  assert.notEqual(ink,handDrawnBorderPath(inkPoints,3,100,rightPanel.id));
  assert.ok(!/NaN|Infinity/.test(ink));
  const inkGeometry=(await import(pathToFileURL(path.join(dir,'idmlGeometry.mjs')))).svgGeometry(ink);
  assert.equal(inkGeometry.length,inkPoints.length*2,'each edge and round join is a closed editable vector');
  assert.ok(inkGeometry.every(p=>!p.open));
  for(const path of inkGeometry)for(const {anchor:p} of path.points){
    const distance=Math.min(...inkPoints.map((a,i)=>{const b=inkPoints[(i+1)%inkPoints.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}));
    assert.ok(distance<=1.5+1e-6,'ink stays inside the original stroke envelope, preserving neighbor clearance');
  }
  const handProject={...project,panelBorderDefaults:{...redDefault,style:'hand-drawn',roughness:70}};
  const handPage={...page,placements:[{...layer,id:'ink-panel',overlays:[]}]};
  const handSnapshot=JSON.stringify(handPage);
  const handSvg=await pageSvg(handProject,handPage,'',1);
  const expectedInk=handDrawnBorderPath(geometry.panelOutline(handPage,handPage.placements[0],project.pageFormat),borders.panelBorderWidth(handProject,handPage.placements[0]),70,'ink-panel');
  assert.ok(handSvg.includes(`d="${expectedInk}" fill="#cc2233"`),'export uses the shared ink contour');
  assert.equal(JSON.stringify(handPage),handSnapshot,'ink does not change the image clip, layout or text');
  assert.equal(await pageSvg(handProject,handPage,'',1),handSvg);
  assert.equal(await pageSvg({...handProject,panelBorderDefaults:{...redDefault,style:'hand-drawn',roughness:0}},handPage,'',1),await pageSvg({...project,panelBorderDefaults:redDefault},handPage,'',1),'zero strength is exactly the original straight frame');
  assert.equal(await pageSvg({...handProject,panelBorderDefaults:{...redDefault,style:'straight',roughness:70}},handPage,'',1),await pageSvg({...project,panelBorderDefaults:redDefault},handPage,'',1));
  console.log('PASS: deterministic hand-drawn ink, strength and panel identity, shared export paths, legacy/zero-strength compatibility and unchanged content.');
  const coloredPage={...page,placements:[{...layer,id:'red'},{...layer,id:'blue',x:1,shapePoints:shapes.PANEL_SHAPE_PRESETS[1].points,panelBorder:blueOverride},{...layer,id:'hidden',x:2,panelBorder:{...blueOverride,visible:false}}]};
  const coloredSvg=await pageSvg(borderedProject,coloredPage,'',1);
  assert.match(coloredSvg,/stroke="#cc2233"/);
  assert.match(coloredSvg,/stroke="#2244cc"/);
  assert.equal((coloredSvg.match(/stroke="#2244cc"/g)||[]).length,1,'hidden frame omits its stroke');
  assert.ok(coloredSvg.includes(`stroke-width="${borders.panelBorderWidth(borderedProject,coloredPage.placements[1])}"`));
  const thickRight={...rightPanel,panelBorder:blueOverride},thinLeft={...leftPanel,panelBorder:{...redDefault,thicknessPt:1}};
  const variablePage={...sharedPage,placements:[thickRight,thinLeft]};
  const variableFit=geometry.fitPanelToNeighbor(variablePage,thinLeft,thickRight,'left',2,project.pageFormat,redDefault);
  assert.ok(variableFit);
  const variableOutline=geometry.panelOutline(variablePage,variableFit,project.pageFormat);
  const clearance=(borders.panelBorderWidth(borderedProject,thickRight)+borders.panelBorderWidth(borderedProject,thinLeft))/2;
  for(const point of [variableOutline[1],variableOutline[2]])assert.ok(Math.abs((point.x-edgeA.x)*nx+(point.y-edgeA.y)*ny-(2*700/210+clearance))<1e-7,'gutter uses both actual border widths');
  const borderlessRight={...thickRight,panelBorder:{...blueOverride,visible:false}},borderlessLeft={...thinLeft,panelBorder:{...redDefault,visible:false}};
  const borderlessPage={...sharedPage,placements:[borderlessRight,borderlessLeft]};
  const borderlessFit=geometry.fitPanelToNeighbor(borderlessPage,borderlessLeft,borderlessRight,'left',2,project.pageFormat);
  assert.ok(borderlessFit);
  assert.deepEqual(typography.pageLayerTextMetrics(borderedProject,page,layer),typography.pageLayerTextMetrics(project,page,layer),'border style never rescales text or images');
  console.log('PASS: border defaults/overrides, colors and point thickness in export, hidden strokes, unchanged content metrics and variable-width edge gutters.');
  const controller=new AbortController();controller.abort();
  await assert.rejects(exportAlbum(project,{format:'png',pageIds:['page'],pageFormat:f.DEFAULT_PAGE_FORMAT,dpi:300,fit:'contain',jpegQuality:.95},()=>{},controller.signal),{name:'AbortError'});
  await assert.rejects(exportAlbum(project,{format:'png',pageIds:[],pageFormat:f.DEFAULT_PAGE_FORMAT,dpi:300,fit:'contain',jpegQuality:.95},()=>{}),/no-pages/);
  console.log('SVG artwork, local text, stroke scaling and export cancellation passed.');
  console.log('Export formats, legacy geometry, pixel sizes, PDF cross references, ZIP CRC and JPEG density passed.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}



