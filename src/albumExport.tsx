import { textPieces } from "./richText";
import { panelBorderStyle, panelBorderWidth } from "./panelBorder";
import { handDrawnBorderPath } from "./handDrawnBorder";
import { panelOutline } from "./panelGeometry";
import { imagePlacement } from "./imageView";
import { pageLayerTextMetrics } from "./pageTypography";
import { overlayFont } from "./overlayTypography";
import { panelShapePoints, shapedPanel } from "./panelShape";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectedBubbles } from "./ConnectedBubbles";
import { bubbleGroups } from "./bubbleConnections";
import { SvgOverlay } from "./SvgOverlay";
import type { ComicProject, PageLayer } from "./project";
import { albumPageFormat, layerRect, pageAspect, pageDimensions, rasterDimensions, PAGE_RENDER_WIDTH, PANEL_BORDER, type PageFormat } from "./pageFormat";
import { imageArchive, imageDensity, rasterPdf, type PdfRasterPage } from "./exportFiles";
export type ExportOptions = { format: "pdf" | "png" | "jpeg" | "idml"; pageIds: string[]; pageFormat: PageFormat; dpi: number; fit: "contain" | "cover"; jpegQuality: number };
const xml = (value: string) => value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));
function check(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException("Cancelled", "AbortError"); }
async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image(); image.src = url; await image.decode(); return image;
}
async function blobData(blob: Blob) { return new Promise<string>((resolve,reject) => { const r = new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=()=>reject(new Error("image-read-failed")); r.readAsDataURL(blob); }); }
async function embeddedFonts(families: Set<string>, signal?: AbortSignal) {
  let result = "";
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList; try { rules=sheet.cssRules; } catch { continue; }
    for (const rule of Array.from(rules)) {
      if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
      const face=rule as CSSFontFaceRule, family=face.style.getPropertyValue("font-family").replace(/["']/g,"").trim();
      if (!families.has(family)) continue;
      const source=face.style.getPropertyValue("src"), match=source.match(/url\(["']?([^"')]+)["']?\)/);
      if (!match) continue;
      const url = new URL(match[1], sheet.href ?? location.href);
      if (url.origin !== location.origin) throw new Error("font-load-failed");
      const response=await fetch(url, {signal}); if(!response.ok) throw new Error("font-load-failed");
      const data=await blobData(await response.blob());
      result += `@font-face{font-family:"${family}";font-style:normal;font-weight:${face.style.getPropertyValue("font-weight") || "400"};src:url("${data}")}\n`;
    }
  }
  return result;
}
// Images and SVG artwork are rendered together, with no editor UI in the output.
export async function pageSvg(project: ComicProject, page: ComicProject["pages"][number], fontCss: string, outputScale: number) {
  // Server-rendered SVG has no effects: load the fonts before measuring its lines.
  if (typeof document !== "undefined" && document.fonts) {
    const overlays = [...(page.background ? [page.background] : []), ...page.placements].flatMap(layer => layer.overlays ?? []);
    await Promise.all(overlays.flatMap(overlay => [overlay,...textPieces(overlay).map(piece=>({...overlay,...Object.fromEntries(Object.entries(piece.style).filter(([,v])=>v!==undefined))}))]).map(overlay => document.fonts.load(overlayFont(overlay,16),overlay.text || "ÅÄÖ abc")));
  }
  const format=albumPageFormat(project), height=PAGE_RENDER_WIDTH/pageAspect(format), defs:string[]=[], body:string[]=[];
  body.push(`<rect width="700" height="${height}" fill="#fffdf7"/>`);
  const layers=[...(page.background?[page.background]:[]),...page.placements];
  for(const [i,layer] of layers.entries()) {
    const background=layer===page.background, r=background?{x:0,y:0,width:700,height}:layerRect(page,layer,format), border=background?0:PANEL_BORDER;
    const shaped=!background&&shapedPanel(layer);
    if(!background&&!shaped) body.push(`<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="#fffdf7"/>`);
    const x=r.x+border, y=r.y+border, w=r.width-2*border, h=r.height-2*border, id=`layer-${i}`;
    if(w<=0||h<=0)throw new Error("invalid-layout");
    const polygon=panelShapePoints(layer).map(p=>`${x+p.x/4*w},${y+p.y/4*h}`).join(" ");
    defs.push(`<clipPath id="${id}">${shaped?`<polygon points="${polygon}"/>`:`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`}</clipPath>`);
    body.push(`<g clip-path="url(#${id})">`);
    if(shaped)body.push(`<polygon points="${polygon}" fill="#fffdf7"/>`);
    if(layer.image) {
      let url=layer.image.dataUrl;
      if(url.startsWith("blob:"))url=await blobData(await (await fetch(url)).blob());
      if(!url.startsWith("data:image/"))throw new Error("image-load-failed");
      const image=await loadImage(url),placed=imagePlacement(layer.image,w,h,image.naturalWidth,image.naturalHeight);
      const cx=x+placed.x+placed.width/2,cy=y+placed.y+placed.height/2;
      const transform=[layer.image.rotation ? `rotate(${layer.image.rotation} ${cx} ${cy})` : "", layer.image.flipX || layer.image.flipY ? `translate(${cx} ${cy}) scale(${layer.image.flipX?-1:1} ${layer.image.flipY?-1:1}) translate(${-cx} ${-cy})` : ""].filter(Boolean).join(" ");
      body.push(`<image href="${xml(url)}" x="${x+placed.x}" y="${y+placed.y}" width="${placed.width}" height="${placed.height}" preserveAspectRatio="none"${transform ? ` transform="${transform}"` : ""}/>`);
    }
    let overlays=renderToStaticMarkup(<svg x={x} y={y} width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none"><ConnectedBubbles overlays={layer.overlays??[]} textMetrics={pageLayerTextMetrics(project,page,layer)}/> {(layer.overlays??[]).map(o=><SvgOverlay key={o.id} overlay={o} textMetrics={pageLayerTextMetrics(project,page,layer)} hideShape={bubbleGroups(layer.overlays??[]).some(g=>g.some(b=>b.id===o.id))}/>)}</svg>);
    // Non-scaling strokes stay proportional to the canonical 700px page at every DPI.
    overlays=overlays.replace(/<[^>]+vector-effect="non-scaling-stroke"[^>]*>/g,tag=>tag.replace(/stroke-width="([^"]+)"/,(_,v)=>`stroke-width="${Number(v)*outputScale}"`));
    body.push(overlays,"</g>");
    const frameWidth=background?0:panelBorderWidth(project,layer),frameColor=panelBorderStyle(project,layer).color;
    const frameStyle=panelBorderStyle(project,layer);
    if(!background&&frameWidth>0&&frameStyle.style==="hand-drawn"&&(frameStyle.roughness??50)>0)body.push(`<path d="${handDrawnBorderPath(panelOutline(page,layer,format),frameWidth,frameStyle.roughness??50,layer.id)}" fill="${frameColor}"/>`);
    else if(shaped&&frameWidth>0)body.push(`<polygon points="${polygon}" fill="none" stroke="${frameColor}" stroke-width="${frameWidth}" stroke-linejoin="round"/>`);
    else if(!background&&frameWidth>0)body.push(`<rect x="${r.x+border/2}" y="${r.y+border/2}" width="${r.width-border}" height="${r.height-border}" fill="none" stroke="${frameColor}" stroke-width="${frameWidth}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${700*outputScale}" height="${height*outputScale}" viewBox="0 0 700 ${height}"><defs>${defs.join("")}<style>${fontCss}</style></defs>${body.join("")}</svg>`;
}
export async function renderExportPage(project: ComicProject, page: ComicProject["pages"][number], options: ExportOptions, fontCss: string) {
  const {width,height}=rasterDimensions(options.pageFormat,options.dpi), sourceHeight=700/pageAspect(albumPageFormat(project));
  const scale=(options.fit==="cover"?Math.max:Math.min)(width/700,height/sourceHeight);
  const svg=await pageSvg(project,page,fontCss,scale), url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));
  const canvas=document.createElement("canvas"); canvas.width=width;canvas.height=height;
  const context=canvas.getContext("2d");if(!context)throw new Error("canvas-unavailable");
  try {
    const image=await loadImage(url); context.fillStyle="#ffffff";context.fillRect(0,0,width,height);
    context.drawImage(image,(width-700*scale)/2,(height-sourceHeight*scale)/2,700*scale,sourceHeight*scale);
    const mime=options.format==="png"?"image/png":"image/jpeg";
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("encode-failed")),mime,options.format==="pdf"?.98:options.jpegQuality));
    return {bytes:imageDensity(new Uint8Array(await blob.arrayBuffer()),mime,options.dpi),width,height};
  } finally { URL.revokeObjectURL(url);canvas.width=canvas.height=0; }
}
export function exportFilename(title:string) { return title.normalize("NFC").replace(/[<>:"/\\|?*\u0000-\u001f]/g,"-").replace(/[. ]+$/g,"").trim().slice(0,100)||"comicbook"; }
export async function exportAlbum(project:ComicProject,options:ExportOptions,onProgress:(done:number,total:number)=>void,signal?:AbortSignal) {
  if(options.format==="idml") { const {exportIdml}=await import("./idmlExport");return exportIdml(project,options,onProgress,signal); }
  const pages=[...project.pages].sort((a,b)=>a.number-b.number).filter(p=>options.pageIds.includes(p.id));
  if(!pages.length)throw new Error("no-pages"); rasterDimensions(options.pageFormat,options.dpi);
  check(signal);
  const families=new Set(pages.flatMap(p=>[...(p.background?[p.background]:[]),...p.placements].flatMap(l=>(l.overlays??[]).flatMap(o=>[o,...(o.textStyles??[]).map(style=>({...o,...Object.fromEntries(Object.entries(style).filter(([,v])=>v!==undefined))}))]).map(o=>(o.fontFamily??(o.type==="sfx"?"Impact":"Comic Neue")).split(",")[0].replace(/["']/g,"").trim()))));
  await document.fonts.ready; const css=await embeddedFonts(families,signal), images:PdfRasterPage[]=[], files:{name:string;bytes:Uint8Array}[]=[], base=exportFilename(project.title),ext=options.format==="jpeg"?"jpg":"png";
  onProgress(0,pages.length);
  for(const [i,page] of pages.entries()) {
    check(signal); const image=await renderExportPage(project,page,options,css);check(signal);
    if(options.format==="pdf")images.push(image);else files.push({name:`${base}-${String(page.number).padStart(3,"0")}.${ext}`,bytes:image.bytes});
    onProgress(i+1,pages.length);await new Promise(resolve=>setTimeout(resolve,0));
  }
  check(signal);
  if(options.format==="pdf") { const d=pageDimensions(options.pageFormat);return {blob:rasterPdf(images,d.widthMm,d.heightMm),name:`${base}.pdf`}; }
  return files.length===1?{blob:new Blob([files[0].bytes as BlobPart],{type:options.format==="png"?"image/png":"image/jpeg"}),name:files[0].name}:{blob:imageArchive(files),name:`${base}-${ext}.zip`};
}



