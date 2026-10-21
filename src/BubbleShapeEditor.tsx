import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TextOverlay } from "./project";
import type { Locale } from "./settings";
import { bubbleNodes, bubbleNodeHandles, moveBubbleHandle, insertBubbleNode, customBubbleBodyPath, validBubbleShape, type BubblePoint } from "./bubbleShape";
import { EditorViewScale } from "./EditorViewport";
import { MAX_SHAPE_NODES } from "./panelShape";
type Tools={overlay:TextOverlay;locale:Locale;editing:boolean;onEditing:(value:boolean)=>void;selected:number|null;onSelected:(value:number|null)=>void;snapping:boolean;onSnapping:(value:boolean)=>void;onChange:(patch:Partial<TextOverlay>)=>void};
export function BubbleShapeControls({overlay:o,locale,editing,onEditing,selected,onSelected,snapping,onSnapping,onChange}:Tools) {
  const sv=locale==="sv",points=bubbleNodes(o),smooth=o.bubbleShapeSmooth!==false;
  return <details className="bubble-free-form" open={editing||undefined} onToggle={e=>{if(!e.currentTarget.open)onEditing(false);}}><summary>{sv?"Fri form":"Free form"}</summary>
    <div className="bubble-shape-tools">
      <button type="button" className="text-button" aria-pressed={editing} onClick={()=>onEditing(!editing)}>{editing?(sv?"Avsluta redigering":"Finish editing"):(sv?"Redigera form":"Edit shape")}</button>
      <label><input type="checkbox" checked={smooth} onChange={e=>{if(validBubbleShape(points,e.target.checked))onChange({bubbleShapePoints:points.map(({smooth,...p})=>p),bubbleShapeSmooth:e.target.checked});}}/>{sv?"Mjuk kontur":"Smooth outline"}</label>
      <label><input type="checkbox" checked={snapping} onChange={e=>onSnapping(e.target.checked)}/>{sv?"Fäst mot rutnät":"Snap to grid"}</label>
      <button type="button" className="text-button" disabled={!editing||selected===null||points.length<=3} onClick={()=>{const next=points.filter((_,i)=>i!==selected);if(validBubbleShape(next,smooth)){onChange({bubbleShapePoints:next});onSelected(null);}}}>{sv?"Ta bort nod":"Delete node"}</button>
      <button type="button" className="text-button" disabled={!o.bubbleShapePoints} onClick={()=>{onChange({bubbleShapePoints:undefined,bubbleShapeSmooth:undefined});onSelected(null);onEditing(false);}}>{sv?"Återställ grundform":"Reset shape"}</button>
      <p className="quiet">{sv?"Dubbelklicka på bubblans kontur för att lägga till en nod. Dra noder eller använd piltangenterna. Escape ångrar ett pågående drag. Återställ grundform återgår till bubblans vanliga utseende.":"Double-click the bubble outline to add a node. Drag nodes or use arrow keys. Escape cancels a drag. Reset shape restores the regular bubble appearance."}</p>
    </div>
  </details>;
}
export function BubbleShapeHandles({overlay:o,locale,selected,onSelected,snapping,onChange}:Pick<Tools,"overlay"|"locale"|"selected"|"onSelected"|"snapping"|"onChange">) {
  const groupRef=useRef<SVGGElement>(null),viewScale=useContext(EditorViewScale);
  const [screen,setScreen]=useState({inverse:'matrix(.16 0 0 .16 0 0)',a:6.25,b:0,c:0,d:6.25});
  const pixelMatrix=screen.inverse;
  useLayoutEffect(()=>{
    const measure=()=>{const m=groupRef.current?.getScreenCTM?.();if(!m)return;const det=m.a*m.d-m.b*m.c;if(Math.abs(det)<1e-10)return;setScreen({inverse:`matrix(${m.d/det} ${-m.b/det} ${-m.c/det} ${m.a/det} 0 0)`,a:m.a,b:m.b,c:m.c,d:m.d});};
    measure();const svg=groupRef.current?.ownerSVGElement,observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):undefined;
    if(svg)observer?.observe(svg);window.addEventListener('resize',measure);
    return ()=>{observer?.disconnect();window.removeEventListener('resize',measure);};
  },[viewScale,o.rotation,o.width,o.height]);
  const stop=useRef<(()=>void)|null>(null),callback=useRef(onChange);callback.current=onChange;
  useEffect(()=>()=>stop.current?.(),[o.id]);
  const points=bubbleNodes(o),smooth=o.bubbleShapeSmooth!==false;
  const local=(x:number,y:number,box:DOMRect)=>{const dx=(x-box.left)/box.width*100-o.x-o.width/2,dy=(y-box.top)/box.height*100-o.y-o.height/2,a=-o.rotation*Math.PI/180;return {x:(dx*Math.cos(a)-dy*Math.sin(a)+o.width/2)/o.width*4,y:(dx*Math.sin(a)+dy*Math.cos(a)+o.height/2)/o.height*4};};
  const constrained=(p:BubblePoint)=>{const clamp=(v:number)=>Math.max(0,Math.min(4,snapping?Math.round(v*20)/20:v));return {x:clamp(p.x),y:clamp(p.y)};};
  const begin=(e:React.PointerEvent<SVGElement>,index:number)=>{
    if(e.button!==0)return;e.preventDefault();e.stopPropagation();stop.current?.();onSelected(index);groupRef.current?.querySelector<HTMLButtonElement>(`[data-bubble-node="${index}"].bubble-shape-node`)?.focus();
    const svg=e.currentTarget.ownerSVGElement,box=svg?.getBoundingClientRect();if(!box?.width||!box.height)return;
    const pointer=e.pointerId,original=o.bubbleShapePoints;let changed=false;
    const move=(ev:PointerEvent)=>{if(ev.pointerId!==pointer)return;const p=constrained(local(ev.clientX,ev.clientY,box)),next=points.map((v,i)=>i===index?{...v,...p}:v);if(validBubbleShape(next,smooth)){changed=true;callback.current({bubbleShapePoints:next});}};
    const clean=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true);stop.current=null;};
    const up=(ev:PointerEvent)=>{if(ev.pointerId===pointer)clean();};
    const cancel=()=>{clean();if(changed)callback.current({bubbleShapePoints:original});};
    const key=(ev:KeyboardEvent)=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();cancel();}};
    stop.current=cancel;window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true);
  };
  const beginHandle=(e:React.PointerEvent<SVGElement|HTMLButtonElement>,index:number,side:'handleIn'|'handleOut')=>{
    if(e.button!==0)return;e.preventDefault();e.stopPropagation();stop.current?.();groupRef.current?.querySelector<HTMLButtonElement>(`[data-bubble-handle="${side}"]`)?.focus();
    const svg=e.currentTarget.closest('svg'),box=svg?.getBoundingClientRect();if(!box?.width||!box.height)return;
    const pointer=e.pointerId,original=o.bubbleShapePoints;let changed=false;
    const move=(ev:PointerEvent)=>{if(ev.pointerId!==pointer)return;const next=moveBubbleHandle(o,index,side,local(ev.clientX,ev.clientY,box));if(next){changed=true;callback.current({bubbleShapePoints:next});}};
    const clean=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true);stop.current=null;};
    const up=(ev:PointerEvent)=>{if(ev.pointerId===pointer)clean();};
    const cancel=()=>{clean();if(changed)callback.current({bubbleShapePoints:original});};
    const key=(ev:KeyboardEvent)=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();cancel();}};
    stop.current=cancel;window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true);
  };
  const active=selected===null?undefined:points[selected],handles=active&&(active.smooth??smooth)?bubbleNodeHandles(points,selected!):undefined;
  return <g ref={groupRef} className="bubble-shape-handles" transform={`translate(${o.x} ${o.y}) rotate(${o.rotation} ${o.width/2} ${o.height/2})`} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}>
    <path className="bubble-shape-edge" d={customBubbleBodyPath(o)} fill="none" stroke="transparent" strokeWidth="12" vectorEffect="non-scaling-stroke" style={{pointerEvents:'stroke',cursor:'crosshair'}} onPointerDown={e=>{e.preventDefault();e.stopPropagation();}} onDoubleClick={e=>{
      e.preventDefault();e.stopPropagation();if(points.length>=MAX_SHAPE_NODES)return;
      const box=e.currentTarget.ownerSVGElement!.getBoundingClientRect();if(!box.width||!box.height)return;const p=constrained(local(e.clientX,e.clientY,box));
      const added=insertBubbleNode(o,p);if(added){onChange({bubbleShapePoints:added.points});onSelected(added.index);}
    }}/>
    {points.map((p,i)=><g key={`hit-${i}`} data-bubble-node={i} transform={`translate(${p.x*o.width/4} ${p.y*o.height/4}) ${pixelMatrix}`} onPointerDown={e=>begin(e,i)}><circle r="10" fill="transparent" style={{pointerEvents:'all',cursor:'grab'}}/></g>)}
    {active&&handles?<g className="bubble-curve-handles">{(['handleIn','handleOut'] as const).map(side=>{
      const h=handles[side],x=(active.x+h.x)*o.width/4,y=(active.y+h.y)*o.height/4;
      const dx=h.x*o.width/4,dy=h.y*o.height/4;
      return <g key={side}>
        <g transform={`translate(${active.x*o.width/4} ${active.y*o.height/4}) ${pixelMatrix}`}><line x1="0" y1="0" x2={screen.a*dx+screen.c*dy} y2={screen.b*dx+screen.d*dy} stroke="#2473a6" strokeWidth="1" style={{pointerEvents:'none'}}/></g>
        <g transform={`translate(${x} ${y}) ${pixelMatrix}`}>
          <foreignObject x="-10" y="-10" width="20" height="20" style={{overflow:'visible',pointerEvents:'none'}}>
          <button type="button" className="bubble-curve-handle" data-bubble-handle={side} aria-label={`${locale==='sv'?'Kurvhandtag':'Curve handle'} ${side==='handleIn'?1:2}`} onPointerDown={e=>beginHandle(e,selected!,side)} onKeyDown={e=>{
            const dx=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0,dy=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;if(!dx&&!dy)return;e.preventDefault();e.stopPropagation();
            const step=e.shiftKey?.1:.02,next=moveBubbleHandle(o,selected!,side,{x:active.x+h.x+dx*step,y:active.y+h.y+dy*step});if(next)onChange({bubbleShapePoints:next});
          }}><span aria-hidden="true"/></button>
          </foreignObject>
        </g>
      </g>;
    })}</g>:null}
    {points.map((p,i)=>{
      const isSmooth=p.smooth??smooth;
      return <g key={i} data-bubble-node={i} transform={`translate(${p.x*o.width/4} ${p.y*o.height/4}) ${pixelMatrix}`} onPointerDown={e=>begin(e,i)}>
        <foreignObject x="-10" y="-10" width="20" height="20" style={{overflow:'visible',pointerEvents:'none'}}>
        <button type="button" data-bubble-node={i} data-node-kind={isSmooth?'smooth':'sharp'} className={`bubble-shape-node${selected===i?' is-selected':''}`} aria-label={`${locale==='sv'?'Bubbelnod':'Bubble node'} ${i+1}`} onFocus={()=>onSelected(i)} onKeyDown={e=>{
          const dx=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0,dy=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;if(!dx&&!dy)return;e.preventDefault();e.stopPropagation();const step=snapping?.05:.02,next=points.map((v,j)=>j===i?{...v,...constrained({x:v.x+dx*step,y:v.y+dy*step})}:v);if(validBubbleShape(next,smooth))onChange({bubbleShapePoints:next});
        }}><span aria-hidden="true"/></button>
        </foreignObject>
      </g>;
    })}
  </g>;
}
