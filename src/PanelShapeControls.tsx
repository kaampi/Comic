import { useEffect, useRef } from "react";
import { PANEL_SHAPE_PRESETS, moveShapeCorner, panelShapePoints, shapePreset, type ShapePoint } from "./panelShape";
import type { PageLayer } from "./project";
import type { Locale } from "./settings";

export function PanelShapeControls({layer,locale,editing,onEditing,onChange}:{layer:PageLayer;locale:Locale;editing:boolean;onEditing:(value:boolean)=>void;onChange:(points:ShapePoint[])=>void}) {
  const sv=locale==="sv";
  return <div className="panel-shape-controls"><label>{sv?"Rutans form":"Panel shape"}<select value={shapePreset(layer)} onChange={e=>{const preset=PANEL_SHAPE_PRESETS.find(p=>p.id===e.target.value);if(preset)onChange(preset.points.map(p=>({...p})));}}>
    {PANEL_SHAPE_PRESETS.map(p=><option key={p.id} value={p.id}>{sv?p.sv:p.en}</option>)}<option value="custom" disabled>{sv?"Egen form":"Custom shape"}</option>
  </select></label><button type="button" className="text-button" aria-pressed={editing} onClick={()=>onEditing(!editing)}>{editing?(sv?"Klar med formen":"Finish shape"):(sv?"Redigera form":"Edit shape")}</button>
  <p className="quiet">{editing?(sv?"Dra hörnen till punkterna i 4×4-rutnätet. Piltangenter flyttar ett steg. Escape ångrar pågående drag. Hörnen får inte korsa varandra.":"Snap corners to the 4×4 grid. Arrow keys move one step. Escape cancels the current drag. Corners cannot cross."):(sv?"Välj form eller redigera hörnen. Rutans plats och storlek behålls.":"Choose a shape or edit corners. The panel keeps its position and size.")}</p></div>;
}

export function PanelShapeHandles({layer,locale,onChange}:{layer:PageLayer;locale:Locale;onChange:(points:ShapePoint[])=>void}) {
  const cleanupRef=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>cleanupRef.current?.(),[]);
  const points=panelShapePoints(layer);
  const begin=(event:React.PointerEvent<HTMLButtonElement>,index:number)=>{
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();cleanupRef.current?.();
    const box=event.currentTarget.parentElement!.getBoundingClientRect();
    if(box.width<=0||box.height<=0)return;
    const original=points.map(p=>({...p}));let current=original;
    const move=(e:PointerEvent)=>{const next=moveShapeCorner(current,index,(e.clientX-box.left)/box.width*4,(e.clientY-box.top)/box.height*4);if(next!==current){current=next;onChange(next);}};
    const cleanup=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",cleanup);window.removeEventListener("pointercancel",cancel);window.removeEventListener("keydown",key);cleanupRef.current=null;};
    const cancel=()=>{cleanup();onChange(original);};
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();cancel();}};
    cleanupRef.current=cleanup;window.addEventListener("pointermove",move);window.addEventListener("pointerup",cleanup);window.addEventListener("pointercancel",cancel);window.addEventListener("keydown",key);
  };
  return <div className="panel-shape-surface" onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{[0,1,2,3,4].map(n=><g key={n}><path d={`M ${n*25} 0 V 100 M 0 ${n*25} H 100`}/>{[0,1,2,3,4].map(m=><circle key={m} cx={n*25} cy={m*25} r="1"/>)}</g>)}</svg>
    {points.map((p,index)=><button type="button" key={index} className="panel-shape-handle" style={{left:`${p.x*25}%`,top:`${p.y*25}%`}} aria-label={`${locale==="sv"?"Formhörn":"Shape corner"} ${index+1}`} onPointerDown={e=>begin(e,index)} onKeyDown={e=>{const dx=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0,dy=e.key==="ArrowDown"?1:e.key==="ArrowUp"?-1:0;if(dx||dy){e.preventDefault();e.stopPropagation();onChange(moveShapeCorner(points,index,p.x+dx,p.y+dy));}}}/>)}
  </div>;
}
