import type { CSSProperties } from "react";
import type { ComicProject, PageLayer } from "./project";
import { albumPageFormat, layerRect, pageAspect, PANEL_BORDER } from "./pageFormat";
import { isPageWideLayer } from "./pageBackground";
import { PositionedImage } from "./PositionedImage";
import { PanelFrameOutline } from "./PanelFrameOutline";
import { shapeClipPath, shapedPanel } from "./panelShape";
import { SvgOverlay } from "./SvgOverlay";
import { StackedOverlays } from "./ConnectedBubbles";
import { bubbleGroups } from "./bubbleConnections";
import { pageLayerTextMetrics } from "./pageTypography";
type Page=ComicProject['pages'][number];
function PageImage({layer}:{layer:PageLayer}) {return layer.image?<div className="composition-image"><PositionedImage image={layer.image}/></div>:null;}
function PanelArt({project,page,layer}:{project:ComicProject;page:Page;layer:PageLayer}){
 const format=albumPageFormat(project),h=700/pageAspect(format),r=layerRect(page,layer,format),shaped=shapedPanel(layer);
 const style:CSSProperties={left:r.x/7+'%',top:r.y/h*100+'%',width:r.width/7+'%',height:r.height/h*100+'%'};
 const inset:CSSProperties={position:'absolute',left:PANEL_BORDER/r.width*100+'%',top:PANEL_BORDER/r.height*100+'%',width:(r.width-2*PANEL_BORDER)/r.width*100+'%',height:(r.height-2*PANEL_BORDER)/r.height*100+'%'};
 return <div className="composition-panel" style={{...style,background:shaped?undefined:"#fffdf7"}}><div style={{...inset,clipPath:shaped?shapeClipPath(layer):undefined,background:'#fffdf7',overflow:'hidden'}}>{layer.image?<PositionedImage image={layer.image}/>:null}</div><div style={inset}><PanelFrameOutline project={project} page={page} layer={layer}/></div></div>;
}
function TextLayers({project,page,layers,onEdit}:{project:ComicProject;page:Page;layers:PageLayer[];onEdit?:(id:string,overlayId:string)=>void}){
 const format=albumPageFormat(project),h=700/pageAspect(format);
 return <svg className="composition-text" viewBox={`0 0 700 ${h}`} preserveAspectRatio="none">{layers.map(layer=>{
   const full=isPageWideLayer(page,layer.id),r=full?{x:0,y:0,width:700,height:h}:layerRect(page,layer,format),b=full?0:PANEL_BORDER,metrics=pageLayerTextMetrics(project,page,layer);
   const interactive=!!onEdit&&!!page.foregrounds?.some(l=>l.id===layer.id);
   return <svg key={layer.id} data-text-layer={layer.id} x={r.x+b} y={r.y+b} width={r.width-2*b} height={r.height-2*b} viewBox="0 0 100 100" preserveAspectRatio="none" overflow="hidden"><StackedOverlays overlays={layer.overlays} textMetrics={metrics}>{layer.overlays.map(o=><g key={o.id} data-overlay-id={o.id} role={interactive?'button':undefined} tabIndex={interactive?0:undefined} aria-label={interactive?o.text||o.type:undefined} style={{pointerEvents:interactive?'all':'none',cursor:interactive?'pointer':undefined}} onPointerDown={e=>{if(interactive)e.stopPropagation();}} onPointerUp={e=>{if(interactive)e.stopPropagation();}} onClick={e=>{if(interactive){e.stopPropagation();onEdit!(layer.id,o.id);}}} onKeyDown={e=>{if(interactive&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();onEdit!(layer.id,o.id);}}}><SvgOverlay overlay={o} textMetrics={metrics} hideShape={bubbleGroups(layer.overlays).some(g=>g.some(b=>b.id===o.id))}/>{interactive?<rect x={o.x} y={o.y} width={o.width} height={o.height} fill="transparent" transform={`rotate(${o.rotation} ${o.x+o.width/2} ${o.y+o.height/2})`}/>:null}</g>)}</StackedOverlays></svg>;
 })}</svg>;
}
export function PageForegroundSurface({project,page,onEdit}:{project:ComicProject;page:Page;onEdit:(id:string,overlayId:string)=>void}){
 if(!page.foregrounds?.length)return null;
 return <><div className="page-foreground-images">{page.foregrounds.map(layer=><PageImage key={layer.id} layer={layer}/>)}</div><div className="page-foreground-texts"><TextLayers project={project} page={page} layers={[...page.placements,...page.foregrounds]} onEdit={onEdit}/></div></>;
}
// Context around the selected foreground image, preserving its real stack order.
export function ForegroundEditorContext({project,page,id,phase}:{project:ComicProject;page:Page;id:string;phase:'before'|'after'}){
 const layers=page.foregrounds??[],index=layers.findIndex(l=>l.id===id);
 return <div className={`foreground-editor-context context-${phase}`} aria-hidden="true">{phase==='before'?<>{page.background?<PageImage layer={page.background}/>:null}{page.placements.map(layer=><PanelArt key={layer.id} project={project} page={page} layer={layer}/>)}{layers.slice(0,index).map(layer=><PageImage key={layer.id} layer={layer}/>)}</>:<>{layers.slice(index+1).map(layer=><PageImage key={layer.id} layer={layer}/>)}<TextLayers project={project} page={page} layers={[...(page.background?[page.background]:[]),...page.placements,...layers.filter(l=>l.id!==id)]}/></>}</div>;
}
