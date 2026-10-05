import { useEffect, useRef } from "react";
import { PANEL_SHAPE_PRESETS, moveShapeCorner, panelShapeGrid, panelShapePoints, shapePreset, type ShapePoint } from "./panelShape";
import type { PageLayer } from "./project";
import type { Locale } from "./settings";

export function PanelShapeControls({layer,locale,editing,onEditing,onChange}:{layer:PageLayer;locale:Locale;editing:boolean;onEditing:(value:boolean)=>void;onChange:(points:ShapePoint[])=>void}) {
  const sv=locale==="sv";
  return <div className="panel-shape-controls"><label>{sv?"Rutans form":"Panel shape"}<select value={shapePreset(layer)} onChange={e=>{const preset=PANEL_SHAPE_PRESETS.find(p=>p.id===e.target.value);if(preset)onChange(preset.points.map(p=>({...p})));}}>
    {PANEL_SHAPE_PRESETS.map(p=><option key={p.id} value={p.id}>{sv?p.sv:p.en}</option>)}<option value="custom" disabled>{sv?"Egen form":"Custom shape"}</option>
  </select></label><button type="button" className="text-button" aria-pressed={editing} onClick={()=>onEditing(!editing)}>{editing?(sv?"Klar med formen":"Finish shape"):(sv?"Redigera form":"Edit shape")}</button>
  <p className="quiet">{editing?(sv?"Fyra delningar per enkelpanel i sidans rutnät. Dra hörnen till punkterna; piltangenter flyttar ett steg. Escape ångrar pågående drag. Formen får inte korsa sig själv eller överlappa andra rutor.":"Four subdivisions per page-grid cell. Snap corners to the points; arrow keys move one step. Escape cancels the current drag. The shape cannot cross itself or overlap other panels."):(sv?"Välj form eller redigera hörnen. Rutans plats och storlek behålls.":"Choose a shape or edit corners. The panel keeps its position and size.")}</p></div>;
}

export function PanelShapeHandles({layer,locale,onChange}:{layer:PageLayer;locale:Locale;onChange:(points:ShapePoint[])=>void}) {
  const cleanupRef=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>cleanupRef.current?.(),[]);
  const points=panelShapePoints(layer);
  const {columns,rows}=panelShapeGrid(layer);
  const begin=(event:React.PointerEvent<HTMLButtonElement>,index:number)=>{
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();cleanupRef.current?.();
    const box=event.currentTarget.parentElement!.getBoundingClientRect();
    if(box.width<=0||box.height<=0)return;
    const original=points.map(p=>({...p}));let current=original;
    const move=(e:PointerEvent)=>{const next=moveShapeCorner(current,index,(e.clientX-box.left)/box.width*4,(e.clientY-box.top)/box.height*4,columns,rows);if(next!==current){current=next;onChange(next);}};
    const cleanup=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",cleanup);window.removeEventListener("pointercancel",cancel);window.removeEventListener("keydown",key);cleanupRef.current=null;};
    const cancel=()=>{cleanup();onChange(original);};
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();cancel();}};
    cleanupRef.current=cleanup;window.addEventListener("pointermove",move);window.addEventListener("pointerup",cleanup);window.addEventListener("pointercancel",cancel);window.addEventListener("keydown",key);
  };
  return <div className="panel-shape-surface" onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({length:columns+1},(_,n)=><g key={n}><path d={`M ${n*100/columns} 0 V 100`}/>{Array.from({length:rows+1},(_,m)=><circle key={m} cx={n*100/columns} cy={m*100/rows} r=".6"/>)}</g>)}
      {Array.from({length:rows+1},(_,n)=><path key={n} d={`M 0 ${n*100/rows} H 100`}/>)}
    </svg>
    {points.map((p,index)=><button type="button" key={index} className="panel-shape-handle" style={{left:`${p.x*25}%`,top:`${p.y*25}%`}} aria-label={`${locale==="sv"?"Formhörn":"Shape corner"} ${index+1}`} onPointerDown={e=>begin(e,index)} onKeyDown={e=>{const dx=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0,dy=e.key==="ArrowDown"?1:e.key==="ArrowUp"?-1:0;if(dx||dy){e.preventDefault();e.stopPropagation();onChange(moveShapeCorner(points,index,p.x+dx*4/columns,p.y+dy*4/rows,columns,rows));}}}/>)}
  </div>;
}
