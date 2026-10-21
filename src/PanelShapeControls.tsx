import { useEffect, useRef } from "react";
import { MAX_SHAPE_NODES, insertShapeNode, removeShapeNode, PANEL_SHAPE_PRESETS, moveShapeCorner, panelShapeGrid, panelShapePoints, shapePreset, type ShapePoint } from "./panelShape";
import type { PageLayer } from "./project";
import type { Locale } from "./settings";

type Selection = {kind:"node"|"edge";index:number}|null;
type ShapeTools = { selection:Selection; onSelection:(value:Selection)=>void; snapping:boolean; onSnapping:(value:boolean)=>void; onHidden:(value:number[])=>void };
export function PanelShapeControls({layer,locale,editing,onEditing,onChange,selection,onSelection,snapping,onSnapping,onHidden}:{layer:PageLayer;locale:Locale;editing:boolean;onEditing:(value:boolean)=>void;onChange:(points:ShapePoint[],hidden?:number[])=>void}&ShapeTools) {
  const sv=locale==="sv",points=panelShapePoints(layer),hidden=layer.hiddenShapeEdges??[];
  return <details open={editing||undefined} className="panel-free-form" onToggle={e=>{if(!e.currentTarget.open)onEditing(false);}}><summary>{sv?"Fri form":"Free form"}</summary><div className="panel-shape-controls">
    <button type="button" className="text-button" aria-pressed={editing} onClick={()=>onEditing(!editing)}>{editing?(sv?"Avsluta redigering":"Finish editing"):(sv?"Redigera form":"Edit shape")}</button>
    <label>{sv?"Rutans form":"Panel shape"}<select value={shapePreset(layer)} onChange={e=>{const preset=PANEL_SHAPE_PRESETS.find(p=>p.id===e.target.value);if(preset){onSelection(null);onChange(preset.points.map(p=>({...p})),[]);}}}>
    {PANEL_SHAPE_PRESETS.map(p=><option key={p.id} value={p.id}>{sv?p.sv:p.en}</option>)}<option value="custom" disabled>{sv?"Egen form":"Custom shape"}</option></select></label>
    <label><input type="checkbox" checked={snapping} onChange={e=>onSnapping(e.target.checked)}/>{sv?"Fäst mot rutnät":"Snap to grid"}</label>
    <button type="button" className="text-button" disabled={!editing||selection?.kind!=="node"||points.length<=3} onClick={()=>{if(selection?.kind!=="node")return;const next=removeShapeNode(points,selection.index,hidden);if(next){onChange(next.points,next.hidden);onSelection(null);}}}>{sv?"Ta bort nod":"Delete node"}</button>
    <button type="button" className="text-button" disabled={!editing||selection?.kind!=="edge"} onClick={()=>{if(selection?.kind!=="edge")return;onHidden(hidden.includes(selection.index)?hidden.filter(i=>i!==selection.index):[...hidden,selection.index]);}}>{selection?.kind==="edge"&&hidden.includes(selection.index)?(sv?"Visa kantsegment":"Show edge"):(sv?"Dölj kantsegment":"Hide edge")}</button>
    <button type="button" className="text-button" onClick={()=>{onSelection(null);onChange(PANEL_SHAPE_PRESETS[0].points.map(p=>({...p})),[]);}}>{sv?"Återställ till rektangel":"Reset to rectangle"}</button>
    <p className="quiet">{sv?"Dubbelklicka på en kant för att lägga till en nod. Dra noder för att forma rutan, även inåt för urtag. Markera en nod eller kant för fler val. Piltangenter flyttar noder; Escape ångrar pågående drag. Dolda kanter ändrar inte bildens beskärning.":"Double-click an edge to add a node. Drag nodes, including inward for notches. Select a node or edge for more options. Arrow keys move nodes; Escape cancels a drag. Hidden edges do not change image clipping."}</p>
  </div></details>;
}

export function PanelShapeHandles({layer,locale,onChange,selection,onSelection,snapping}:{layer:PageLayer;locale:Locale;onChange:(points:ShapePoint[],hidden?:number[])=>void;selection:Selection;onSelection:(value:Selection)=>void;snapping:boolean}) {
  const cleanupRef=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>cleanupRef.current?.(),[]);
  const points=panelShapePoints(layer);
  const {columns,rows}=panelShapeGrid(layer);
  const begin=(event:React.PointerEvent<HTMLButtonElement>,index:number)=>{
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();onSelection({kind:"node",index});cleanupRef.current?.();
    const handle=event.currentTarget,pointerId=event.pointerId;
    const box=handle.parentElement!.getBoundingClientRect();
    if(box.width<=0||box.height<=0)return;
    // Keep the release and resulting click on this handle even when it moves
    // away from the pointer or the drag ends outside the panel.
    handle.setPointerCapture?.(pointerId);
    const original=points.map(p=>({...p}));let current=original;
    const move=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;const next=moveShapeCorner(current,index,(e.clientX-box.left)/box.width*4,(e.clientY-box.top)/box.height*4,columns,rows,snapping);if(next!==current){current=next;onChange(next);}};
    const cleanup=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",pointerCancel);window.removeEventListener("keydown",key);if(handle.hasPointerCapture?.(pointerId))handle.releasePointerCapture(pointerId);cleanupRef.current=null;};
    const cancel=()=>{cleanup();onChange(original);};
    const up=(e:PointerEvent)=>{if(e.pointerId===pointerId)cleanup();};
    const pointerCancel=(e:PointerEvent)=>{if(e.pointerId===pointerId)cancel();};
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();cancel();}};
    cleanupRef.current=cleanup;window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);window.addEventListener("pointercancel",pointerCancel);window.addEventListener("keydown",key);
  };
  return <div className="panel-shape-surface" onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      {snapping&&Array.from({length:columns+1},(_,n)=><g key={n}><path d={`M ${n*100/columns} 0 V 100`}/>{Array.from({length:rows+1},(_,m)=><circle key={m} cx={n*100/columns} cy={m*100/rows} r=".6"/>)}</g>)}
      {snapping&&Array.from({length:rows+1},(_,n)=><path key={n} d={`M 0 ${n*100/rows} H 100`}/>)}
      {points.map((a,index)=>{const b=points[(index+1)%points.length];return <line key={`edge-${index}`} className={`panel-shape-edge${selection?.kind==="edge"&&selection.index===index?" is-selected":""}${layer.hiddenShapeEdges?.includes(index)?" is-hidden":""}`} x1={a.x*25} y1={a.y*25} x2={b.x*25} y2={b.y*25} role="button" tabIndex={0} aria-label={`${locale==="sv"?"Kantsegment":"Edge"} ${index+1}`} onPointerDown={e=>{e.preventDefault();e.stopPropagation();onSelection({kind:"edge",index});}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();onSelection({kind:"edge",index});}}} onDoubleClick={e=>{
        e.preventDefault();e.stopPropagation();if(points.length>=MAX_SHAPE_NODES)return;
        const box=e.currentTarget.ownerSVGElement!.getBoundingClientRect(),x=(e.clientX-box.left)/box.width*4,y=(e.clientY-box.top)/box.height*4;
        const dx=(b.x-a.x)*box.width,dy=(b.y-a.y)*box.height,t=Math.max(.001,Math.min(.999,((x-a.x)*box.width*dx+(y-a.y)*box.height*dy)/(dx*dx+dy*dy)));
        const next=insertShapeNode(points,index,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},layer.hiddenShapeEdges);
        if(next){onChange(next.points,next.hidden);onSelection({kind:"node",index:index+1});}
      }}/>;})}
    </svg>
    {points.map((p,index)=><button type="button" key={index} className={`panel-shape-handle${selection?.kind==="node"&&selection.index===index?" is-selected":""}`} onFocus={()=>onSelection({kind:"node",index})} style={{left:`${p.x*25}%`,top:`${p.y*25}%`}} aria-label={`${locale==="sv"?"Formhörn":"Shape corner"} ${index+1}`} onPointerDown={e=>begin(e,index)} onKeyDown={e=>{const dx=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0,dy=e.key==="ArrowDown"?1:e.key==="ArrowUp"?-1:0;if(dx||dy){e.preventDefault();e.stopPropagation();onChange(moveShapeCorner(points,index,p.x+dx*4/columns,p.y+dy*4/rows,columns,rows,snapping));}}}/>)}
  </div>;
}
