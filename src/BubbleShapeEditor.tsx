import { useEffect, useRef } from "react";
import type { TextOverlay } from "./project";
import type { Locale } from "./settings";
import { bubbleNodes, customBubbleBodyPath, validBubbleShape, type BubblePoint } from "./bubbleShape";
import { MAX_SHAPE_NODES } from "./panelShape";
type Tools={overlay:TextOverlay;locale:Locale;editing:boolean;onEditing:(value:boolean)=>void;selected:number|null;onSelected:(value:number|null)=>void;snapping:boolean;onSnapping:(value:boolean)=>void;onChange:(patch:Partial<TextOverlay>)=>void};
export function BubbleShapeControls({overlay:o,locale,editing,onEditing,selected,onSelected,snapping,onSnapping,onChange}:Tools) {
  const sv=locale==="sv",points=bubbleNodes(o),smooth=o.bubbleShapeSmooth!==false;
  return <details className="bubble-free-form" open={editing||undefined} onToggle={e=>{if(!e.currentTarget.open)onEditing(false);}}><summary>{sv?"Fri form":"Free form"}</summary>
    <div className="bubble-shape-tools">
      <button type="button" className="text-button" aria-pressed={editing} onClick={()=>onEditing(!editing)}>{editing?(sv?"Avsluta redigering":"Finish editing"):(sv?"Redigera form":"Edit shape")}</button>
      <label><input type="checkbox" checked={smooth} onChange={e=>{if(validBubbleShape(points,e.target.checked))onChange({bubbleShapePoints:points,bubbleShapeSmooth:e.target.checked});}}/>{sv?"Mjuk kontur":"Smooth outline"}</label>
      <label><input type="checkbox" checked={snapping} onChange={e=>onSnapping(e.target.checked)}/>{sv?"Fäst mot rutnät":"Snap to grid"}</label>
      <button type="button" className="text-button" disabled={!editing||selected===null||points.length<=3} onClick={()=>{const next=points.filter((_,i)=>i!==selected);if(validBubbleShape(next,smooth)){onChange({bubbleShapePoints:next});onSelected(null);}}}>{sv?"Ta bort nod":"Delete node"}</button>
      <button type="button" className="text-button" disabled={!o.bubbleShapePoints} onClick={()=>{onChange({bubbleShapePoints:undefined,bubbleShapeSmooth:undefined});onSelected(null);onEditing(false);}}>{sv?"Återställ grundform":"Reset shape"}</button>
      <p className="quiet">{sv?"Dubbelklicka på bubblans kontur för att lägga till en nod. Dra noder eller använd piltangenterna. Escape ångrar ett pågående drag. Återställ grundform återgår till bubblans vanliga utseende.":"Double-click the bubble outline to add a node. Drag nodes or use arrow keys. Escape cancels a drag. Reset shape restores the regular bubble appearance."}</p>
    </div>
  </details>;
}
export function BubbleShapeHandles({overlay:o,locale,selected,onSelected,snapping,onChange}:Pick<Tools,"overlay"|"locale"|"selected"|"onSelected"|"snapping"|"onChange">) {
  const stop=useRef<(()=>void)|null>(null),callback=useRef(onChange);callback.current=onChange;
  useEffect(()=>()=>stop.current?.(),[o.id]);
  const points=bubbleNodes(o),smooth=o.bubbleShapeSmooth!==false;
  const local=(x:number,y:number,box:DOMRect)=>{const dx=(x-box.left)/box.width*100-o.x-o.width/2,dy=(y-box.top)/box.height*100-o.y-o.height/2,a=-o.rotation*Math.PI/180;return {x:(dx*Math.cos(a)-dy*Math.sin(a)+o.width/2)/o.width*4,y:(dx*Math.sin(a)+dy*Math.cos(a)+o.height/2)/o.height*4};};
  const constrained=(p:BubblePoint)=>{const clamp=(v:number)=>Math.max(0,Math.min(4,snapping?Math.round(v*20)/20:v));return {x:clamp(p.x),y:clamp(p.y)};};
  const begin=(e:React.PointerEvent<SVGCircleElement>,index:number)=>{
    if(e.button!==0)return;e.preventDefault();e.stopPropagation();stop.current?.();onSelected(index);
    const svg=e.currentTarget.ownerSVGElement,box=svg?.getBoundingClientRect();if(!box?.width||!box.height)return;
    const pointer=e.pointerId,original=o.bubbleShapePoints;let changed=false;
    const move=(ev:PointerEvent)=>{if(ev.pointerId!==pointer)return;const p=constrained(local(ev.clientX,ev.clientY,box)),next=points.map((v,i)=>i===index?p:v);if(validBubbleShape(next,smooth)){changed=true;callback.current({bubbleShapePoints:next});}};
    const clean=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true);stop.current=null;};
    const up=(ev:PointerEvent)=>{if(ev.pointerId===pointer)clean();};
    const cancel=()=>{clean();if(changed)callback.current({bubbleShapePoints:original});};
    const key=(ev:KeyboardEvent)=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();cancel();}};
    stop.current=cancel;window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true);
  };
  return <g className="bubble-shape-handles" transform={`translate(${o.x} ${o.y}) rotate(${o.rotation} ${o.width/2} ${o.height/2})`} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}>
    <path className="bubble-shape-edge" d={customBubbleBodyPath(o)} fill="none" stroke="transparent" strokeWidth="12" vectorEffect="non-scaling-stroke" style={{pointerEvents:'stroke',cursor:'crosshair'}} onPointerDown={e=>{e.preventDefault();e.stopPropagation();}} onDoubleClick={e=>{
      e.preventDefault();e.stopPropagation();if(points.length>=MAX_SHAPE_NODES)return;
      const box=e.currentTarget.ownerSVGElement!.getBoundingClientRect();if(!box.width||!box.height)return;const p=constrained(local(e.clientX,e.clientY,box));
      let index=0,best=Infinity;
      // Compare in displayed coordinates, including the bubble aspect ratio.
      points.forEach((a,i)=>{const b=points[(i+1)%points.length],dx=(b.x-a.x)*o.width*box.width,dy=(b.y-a.y)*o.height*box.height,t=Math.max(0,Math.min(1,((p.x-a.x)*o.width*box.width*dx+(p.y-a.y)*o.height*box.height*dy)/Math.max(1e-8,dx*dx+dy*dy))),distance=Math.hypot((p.x-a.x-t*(b.x-a.x))*o.width*box.width,(p.y-a.y-t*(b.y-a.y))*o.height*box.height);if(distance<best){best=distance;index=i;}});
      const next=[...points.slice(0,index+1),p,...points.slice(index+1)];if(validBubbleShape(next,smooth)){onChange({bubbleShapePoints:next});onSelected(index+1);}
    }}/>
    {points.map((p,i)=><circle key={i} className={`bubble-shape-node${selected===i?' is-selected':''}`} cx={p.x*o.width/4} cy={p.y*o.height/4} r=".8" fill={selected===i?'#2473a6':'#fffdf7'} stroke="#2473a6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" style={{pointerEvents:'all',cursor:'grab',touchAction:'none'}} role="button" tabIndex={0} aria-label={`${locale==='sv'?'Bubbelnod':'Bubble node'} ${i+1}`} onFocus={()=>onSelected(i)} onPointerDown={e=>begin(e,i)} onKeyDown={e=>{const dx=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0,dy=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;if(!dx&&!dy)return;e.preventDefault();e.stopPropagation();const step=snapping?.05:.02,next=points.map((v,j)=>j===i?constrained({x:v.x+dx*step,y:v.y+dy*step}):v);if(validBubbleShape(next,smooth))onChange({bubbleShapePoints:next});}}/>)}
  </g>;
}
