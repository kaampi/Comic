import type { ComicProject, TextOverlay } from "./project";
import type { ExportOptions } from "./albumExport";
import { albumPageFormat, pageDimensions, pageAspect, PAGE_RENDER_WIDTH } from "./pageFormat";
import { pageLayers } from "./pageBackground";
import { pageLayerTextMetrics, overlayTextLayout, type LayerTextMetrics } from "./pageTypography";
import { overlayFont, overlayTextMeasure } from "./overlayTypography";
import { richTextLayout, textPieces } from "./richText";
import { imagePlacement } from "./imageView";

export type ExportIssue = {
  kind: "empty-image" | "unreadable-image" | "low-resolution" | "text-overflow" | "unplaced-panel";
  severity: "warning" | "error";
  pageId: string; pageNumber: number; layerId: string;
  layerKind: "panel" | "background" | "foreground" | "pool"; panelNumber: number;
  overlayId?: string; excerpt?: string; dpi?: number;
};
export type ImageSize = { width: number; height: number };
export type ImageSizeReader = (url: string, signal?: AbortSignal) => Promise<ImageSize>;
function check(signal?: AbortSignal) { if(signal?.aborted)throw new DOMException("Cancelled", "AbortError"); }
export const readImageSize: ImageSizeReader = (url, signal) => new Promise((resolve,reject)=>{
  check(signal);
  // Preflight is local; never probe external image URLs.
  if(!/^(data:image\/|blob:)/i.test(url)){reject(new Error("unreadable-image"));return;}
  const image = new Image();
  const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener("abort",cancel);image.onload=null;image.onerror=null;};
  const cancel=()=>{cleanup();image.src="";reject(new DOMException("Cancelled","AbortError"));};
  const fail=()=>{cleanup();reject(new Error("unreadable-image"));};
  const timer=setTimeout(fail,15_000);
  signal?.addEventListener("abort",cancel,{once:true});
  image.onload=()=>{const size={width:image.naturalWidth,height:image.naturalHeight};cleanup();size.width>0&&size.height>0?resolve(size):reject(new Error("unreadable-image"));};
  image.onerror=fail;image.src=url;
});
// Uses the same line breaks, point conversion and mixed-style row heights as SVG export.
// Custom bubbles use the same contour-aware fitting as the editor.
export function textOverflows(overlay: TextOverlay, metrics: LayerTextMetrics) {
  if(!overlay.text.trim() || (overlay.type==="sfx" && overlay.sfxTextHidden))return false;
  if(overlay.bubbleShapePoints&&overlay.type!=="sfx")return richTextLayout(overlay,metrics).overflow;
  if(overlay.textStyles?.length){
    const layout=richTextLayout(overlay,metrics);
    const padding=layout.width*Math.max(0,Math.min(25,overlay.textPadding??4))/100;
    return layout.totalHeight>layout.height+.5 || layout.rows.some(row=>row.lineWidth>layout.width-2*padding+.5);
  }
  const layout=overlayTextLayout(overlay,metrics), measure=overlayTextMeasure(overlay,layout.fontSize);
  const padding=layout.width*Math.max(0,Math.min(25,overlay.textPadding??4))/100;
  return layout.textLines.length*layout.fontSize*1.15>layout.height+.5 || layout.textLines.some(line=>measure(line)>layout.width-2*padding+.5);
}
export async function checkExport(project: ComicProject, options: ExportOptions, signal?: AbortSignal, readSize: ImageSizeReader = readImageSize): Promise<ExportIssue[]> {
  check(signal);
  const pages=[...project.pages].filter(page=>options.pageIds.includes(page.id)).sort((a,b)=>a.number-b.number);
  const overlays=pages.flatMap(page=>pageLayers(page).flatMap(layer=>layer.overlays??[]));
  if(typeof document!=="undefined" && document.fonts){
    await Promise.all(overlays.flatMap(overlay=>[overlay,...textPieces(overlay).map(piece=>({...overlay,...Object.fromEntries(Object.entries(piece.style).filter(([,value])=>value!==undefined))}))]).map(overlay=>document.fonts.load(overlayFont(overlay,16),overlay.text || "ÅÄÖ abc").catch(()=>[])));
    check(signal);
  }
  const format=albumPageFormat(project), target=pageDimensions(options.pageFormat);
  const mmPerUnit=(options.fit==="cover"?Math.max:Math.min)(target.widthMm/PAGE_RENDER_WIDTH,target.heightMm/(PAGE_RENDER_WIDTH/pageAspect(format)));
  const issues: ExportIssue[]=[];
  if(pages.length)for(const item of project.unplacedPanels??[]){
    if(item.targetPageId&&!options.pageIds.includes(item.targetPageId))continue;
    const page=pages.find(page=>page.id===item.targetPageId);
    issues.push({kind:"unplaced-panel",severity:"warning",pageId:page?.id??"",pageNumber:page?.number??0,layerId:item.layer.id,layerKind:"pool",panelNumber:item.layer.readingOrder});
  }
  const images=new Map<string,Promise<ImageSize>>();
  for(const page of pages)for(const layer of pageLayers(page)){
    check(signal);
    const layerKind=page.background?.id===layer.id?"background":page.foregrounds?.some(item=>item.id===layer.id)?"foreground":"panel";
    const location={pageId:page.id,pageNumber:page.number,layerId:layer.id,layerKind,panelNumber:layer.readingOrder} as const;
    const metrics=pageLayerTextMetrics(project,page,layer);
    for(const overlay of layer.overlays??[])if(textOverflows(overlay,metrics))issues.push({...location,kind:"text-overflow",severity:"warning",overlayId:overlay.id,excerpt:overlay.text.slice(0,90)});
    if(!layer.image){if(layerKind==="panel")issues.push({...location,kind:"empty-image",severity:"warning"});continue;}
    const url=layer.image.dataUrl;
    try {
      if(!/^(data:image\/|blob:)/i.test(url))throw new Error("unreadable-image");
      let pending=images.get(url);if(!pending){pending=readSize(url,signal);images.set(url,pending);}
      const size=await pending;check(signal);
      if(!(size.width>0&&size.height>0))throw new Error("unreadable-image");
      if(/^data:image\/svg\+xml/i.test(url))continue;
      const placed=imagePlacement(layer.image,metrics.width,metrics.height,size.width,size.height);
      const dpi=Math.min(size.width/(placed.width*mmPerUnit/25.4),size.height/(placed.height*mmPerUnit/25.4));
      if(dpi<299.5)issues.push({...location,kind:"low-resolution",severity:"warning",dpi:Math.round(dpi)});
    } catch(error) {
      check(signal);issues.push({...location,kind:"unreadable-image",severity:"error"});
    }
  }
  check(signal);return issues;
}
