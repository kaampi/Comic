import { useEffect, useRef, useState } from "react";
import type { ComicProject, PageLayer } from "./project";
import type { Locale } from "./settings";
import { pageLayerTextMetrics } from "./pageTypography";
import { PositionedImage } from "./PositionedImage";
import { SvgOverlay } from "./SvgOverlay";
import { ConnectedBubbles } from "./ConnectedBubbles";
import { bubbleGroups } from "./bubbleConnections";
import { shapedPanel, shapeClipPath } from "./panelShape";
import { pooledCandidate, POOL_DRAG_TYPE, type PooledPanel, type PanelSelection } from "./panelPool";
import "./panelPool.css";
export function PoolThumbnail({project,item}:{project:ComicProject;item:PooledPanel}){
  const layer=item.layer, page={id:"pool-preview",number:0,...item.sourceGrid,placements:[layer]};
  const metrics=pageLayerTextMetrics(project,page,layer);
  return <div className="pool-art" style={{aspectRatio:String(metrics.width/metrics.height),maxWidth:`${220*metrics.width/metrics.height}px`,margin:"auto",clipPath:shapedPanel(layer)?shapeClipPath(layer):undefined}}>
    {layer.image?<PositionedImage image={layer.image}/>:null}
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><ConnectedBubbles overlays={layer.overlays} textMetrics={metrics}/>{layer.overlays.map(overlay=><SvgOverlay key={overlay.id} overlay={overlay} textMetrics={metrics} hideShape={bubbleGroups(layer.overlays).some(group=>group.some(item=>item.id===overlay.id))}/>)}</svg>
  </div>;
}
function PoolItem({project,item,pageId,locale,onPlace,onTransfer,onRemove,onDragStart,onDragEnd}:{project:ComicProject;item:PooledPanel;pageId?:string;locale:Locale;onPlace:(id:string,pageId:string,x:number,y:number)=>void;onTransfer:(id:string,target?:string)=>void;onRemove:(id:string)=>void;onDragStart:(id:string)=>void;onDragEnd:()=>void}){
  const sv=locale==="sv",[column,setColumn]=useState(1),[row,setRow]=useState(1);
  const page=project.pages.find(page=>page.id===pageId),layer=item.layer;
  const valid=page&&pooledCandidate(project,layer.id,page.id,column-1,row-1);
  return <article className="pool-item" data-pooled-id={layer.id}>
    <div className="pool-drag" draggable onDragStart={event=>{event.dataTransfer.setData(POOL_DRAG_TYPE,JSON.stringify({projectId:project.id,layerId:layer.id}));event.dataTransfer.effectAllowed="move";onDragStart(layer.id);}} onDragEnd={onDragEnd} title={sv?"Dra in panelen på sidan":"Drag the panel onto the page"}><PoolThumbnail project={project} item={item}/><small>{sv?"Panel":"Panel"} {layer.readingOrder} · {layer.width} × {layer.height}</small></div>
    <label>{sv?"Tillhör":"Assigned to"}<select aria-label={`${sv?"Flytta panel":"Move panel"} ${layer.id}`} value={item.targetPageId??""} onChange={event=>onTransfer(layer.id,event.target.value||undefined)}><option value="">{sv?"Albumets panelpool":"Album panel pool"}</option>{project.pages.map(page=><option key={page.id} value={page.id}>{sv?"Sida":"Page"} {page.number}</option>)}<option value="__new__">{sv?"Ny sida…":"New page…"}</option></select></label>
    {page?<><div className="pool-position"><label>{sv?"Kolumn":"Column"}<input type="number" min={1} max={page.gridColumns} value={column} onChange={event=>setColumn(Number(event.target.value))}/></label><label>{sv?"Rad":"Row"}<input type="number" min={1} max={page.gridRows} value={row} onChange={event=>setRow(Number(event.target.value))}/></label></div><button type="button" className="text-button" disabled={!valid} onClick={()=>onPlace(layer.id,page.id,column-1,row-1)}>{sv?"Placera på sidan":"Place on page"}</button>{!valid?<small>{sv?"Får inte plats här. Välj en annan position eller sida.":"Does not fit here. Choose another position or page."}</small>:null}</>:null}
    <button type="button" className="text-button danger-button" onClick={()=>onRemove(layer.id)}>{sv?"Radera panel":"Delete panel"}</button>
  </article>;
}
export function PanelPool({project,pageId,locale,onPlace,onTransfer,onRemove,onOrganize,onDragStart,onDragEnd}:{project:ComicProject;pageId?:string;locale:Locale;onPlace:(id:string,pageId:string,x:number,y:number)=>void;onTransfer:(id:string,target?:string)=>void;onRemove:(id:string)=>void;onOrganize:(items:PanelSelection[])=>void;onDragStart:(id:string)=>void;onDragEnd:()=>void}){
  const sv=locale==="sv",[selected,setSelected]=useState<string[]>([]),page=project.pages.find(page=>page.id===pageId);
  useEffect(()=>setSelected([]),[project.id,pageId]);
  const pool=project.unplacedPanels??[],waiting=pool.filter(item=>item.targetPageId===pageId&&pageId),free=pool.filter(item=>!item.targetPageId);
  const renderItem=(item:PooledPanel)=><PoolItem key={item.layer.id} {...{project,item,pageId,locale,onPlace,onTransfer,onRemove,onDragStart,onDragEnd}}/>;
  return <section className="panel-pool" aria-label={sv?"Panelpool":"Panel pool"}>
    <h3>{sv?"Panelpool":"Panel pool"} <span>{pool.length}</span></h3>
    <p className="quiet">{sv?"Dra en hel panel till en ledig plats, eller ange kolumn och rad. Väntande paneler exporteras inte.":"Drag a whole panel to an empty position, or enter a column and row. Waiting panels are not exported."}</p>
    {page?<details className="pool-organize"><summary>{sv?"Flytta / lyft paneler från sidan":"Move / lift panels from this page"}</summary><div>{page.placements.map(layer=><label key={layer.id}><input type="checkbox" checked={selected.includes(layer.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,layer.id]:current.filter(id=>id!==layer.id))}/>{sv?"Panel":"Panel"} {layer.readingOrder}</label>)}</div><button type="button" className="text-button" disabled={!selected.some(id=>page.placements.some(layer=>layer.id===id))} onClick={()=>onOrganize(selected.filter(id=>page.placements.some(layer=>layer.id===id)).map(layerId=>({pageId:page.id,layerId})))}>{sv?"Flytta valda…":"Move selected…"}</button></details>:null}
    {page?<details open className="pool-group"><summary>{sv?"Väntar på placering":"Waiting for placement"} · {page.number} ({waiting.length})</summary>{waiting.map(renderItem)}{!waiting.length?<p className="quiet">{sv?"Inga väntande paneler på den här sidan.":"No waiting panels on this page."}</p>:null}</details>:null}
    <details open className="pool-group"><summary>{sv?"Albumets panelpool":"Album panel pool"} ({free.length})</summary>{free.map(renderItem)}{!free.length?<p className="quiet">{sv?"Lyft paneler från en sida för att samla dem här.":"Lift panels from a page to collect them here."}</p>:null}</details>
    {pool.some(item=>item.targetPageId&&item.targetPageId!==pageId)?<details className="pool-group"><summary>{sv?"Väntar på andra sidor":"Waiting on other pages"}</summary>{pool.filter(item=>item.targetPageId&&item.targetPageId!==pageId).map(renderItem)}</details>:null}
  </section>;
}
export function PanelTransferDialog({project,selections,locale,onMove,onClose}:{project:ComicProject;selections:PanelSelection[];locale:Locale;onMove:(target?:string)=>void;onClose:()=>void}){
  const sv=locale==="sv",[target,setTarget]=useState(""),ref=useRef<HTMLElement>(null);
  const items=selections.flatMap(selection=>{const page=project.pages.find(page=>page.id===selection.pageId),layer=page?.placements.find(layer=>layer.id===selection.layerId);return page&&layer?[{layer,sourceGrid:{gridColumns:page.gridColumns,gridRows:page.gridRows}}]:[];});
  useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.focus();const overflow=document.body.style.overflow;document.body.style.overflow="hidden";const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onClose();}if(event.key==="Tab"){const controls=Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),select")??[]),first=controls[0],last=controls.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){event.preventDefault();first?.focus();}}};document.addEventListener("keydown",key,true);return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",key,true);if(previous?.isConnected)previous.focus();};},[onClose]);
  return <div className="pool-transfer-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className="pool-transfer-dialog" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="pool-transfer-title"><h2 id="pool-transfer-title">{sv?"Flytta paneler":"Move panels"} ({items.length})</h2><div className="pool-transfer-previews">{items.map(item=><PoolThumbnail key={item.layer.id} project={project} item={item}/>)}</div><label>{sv?"Destination":"Destination"}<select value={target} onChange={event=>setTarget(event.target.value)}><option value="">{sv?"Albumets panelpool":"Album panel pool"}</option>{project.pages.map(page=><option key={page.id} value={page.id}>{sv?"Sida":"Page"} {page.number} · {page.placements.length} {sv?"placerade paneler":"placed panels"}</option>)}<option value="__new__">{sv?"Ny sida":"New page"}</option></select></label><p>{sv?"Panelerna lämnar layouten och väntar på placering på målsidan. Bilder, form och texter följer med. Ingen befintlig panel på målsidan ersätts.":"Panels leave the layout and wait for placement on the destination page. Images, shapes and text travel with them. No existing destination panel is replaced."}</p><footer><button type="button" className="text-button" onClick={onClose}>{sv?"Avbryt":"Cancel"}</button><button type="button" className="primary-button" disabled={!items.length} onClick={()=>onMove(target||undefined)}>{sv?"Flytta panelerna":"Move panels"}</button></footer></section></div>;
}
