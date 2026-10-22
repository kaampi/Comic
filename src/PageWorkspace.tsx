import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "./settings";
import "./workspaceLayout.css";

const ReadingTarget=createContext<HTMLElement|null>(null);
export function PageReadingOrder({children}:{children:ReactNode}){const target=useContext(ReadingTarget);return target?createPortal(children,target):null;}
function storedWidth(key:string,fallback:number,min:number,max:number){try{const n=Number(localStorage.getItem(key));return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;}catch{return fallback;}}
function WidthHandle({side,value,onChange,label}:{side:'left'|'right';value:number;onChange:(n:number)=>void;label:string}){
  const start=useRef<{x:number;width:number}|null>(null);
  return <div className={`workspace-width-handle is-${side}`} role="separator" tabIndex={0} aria-label={label} aria-orientation="vertical" aria-valuemin={side==='left'?240:220} aria-valuemax={440} aria-valuenow={value}
    onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onChange(value+(e.key==='ArrowRight'?1:-1)*(side==='left'?1:-1)*20);}}}
    onPointerDown={e=>{if(e.button!==0)return;start.current={x:e.clientX,width:value};e.currentTarget.setPointerCapture(e.pointerId);}}
    onPointerMove={e=>{if(start.current)onChange(start.current.width+(e.clientX-start.current.x)*(side==='left'?1:-1));}}
    onPointerUp={e=>{start.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
    onPointerCancel={()=>{start.current=null;}} onLostPointerCapture={()=>{start.current=null;}}/>;
}
export function PageWorkspace({settings,library,children,locale}:{settings:ReactNode;library:ReactNode;children:ReactNode;locale:Locale}){
  const sv=locale==='sv',t=(a:string,b:string)=>sv?a:b;
  const [left,setLeft]=useState(true),[right,setRight]=useState(true),[focus,setFocus]=useState(false),[tab,setTab]=useState<'library'|'order'>('library');
  const [leftWidth,setLeftWidth]=useState(()=>storedWidth('comicbook-ai.page-settings-width',300,240,440)),[rightWidth,setRightWidth]=useState(()=>storedWidth('comicbook-ai.page-library-width',280,220,440));
  const [target,setTarget]=useState<HTMLDivElement|null>(null);
  const width=(side:'left'|'right',n:number)=>{const value=Math.max(side==='left'?240:220,Math.min(440,n));(side==='left'?setLeftWidth:setRightWidth)(value);try{localStorage.setItem(side==='left'?'comicbook-ai.page-settings-width':'comicbook-ai.page-library-width',String(value));}catch{/* local view remains usable */}};
  useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!e.defaultPrevented&&focus&&!document.querySelector('[role="dialog"]'))setFocus(false);};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[focus]);
  return <ReadingTarget.Provider value={target}><section className={`page-workspace pages-studio${!left||focus?' hide-page-settings':''}${!right||focus?' hide-page-library':''}`} style={{'--page-settings-width':`${leftWidth}px`,'--page-library-width':`${rightWidth}px`} as CSSProperties}>
    <div className="pages-view-toolbar" aria-label={t('Arbetsytans visning','Workspace view')}>
      <button type="button" aria-expanded={left&&!focus} onClick={()=>{setLeft(focus?true:!left);setFocus(false);}}>{t('Sidinställningar','Page settings')}</button>
      <button type="button" aria-expanded={right&&!focus} onClick={()=>{setRight(focus?true:!right);setFocus(false);}}>{t('Bildbibliotek & läsordning','Image library & reading order')}</button>
      <button type="button" className={focus?'primary-button':'text-button'} aria-pressed={focus} onClick={()=>setFocus(!focus)}>{focus?t('Lämna fokusläge','Exit focus mode'):t('Fokusläge','Focus mode')}</button>
    </div>
    <aside className="pages-settings" hidden={!left||focus} aria-label={t('Sidans egenskaper','Page properties')}>{settings}</aside>
    <WidthHandle side="left" value={leftWidth} onChange={n=>width('left',n)} label={t('Ändra bredd på sidinställningar','Resize page settings')}/>
    <div className="pages-center">{children}</div>
    <WidthHandle side="right" value={rightWidth} onChange={n=>width('right',n)} label={t('Ändra bredd på bildbibliotek','Resize image library')}/>
    <aside className="pages-library" hidden={!right||focus} aria-label={t('Sidans resurser','Page resources')}>
      <div className="workspace-tabs" role="group" aria-label={t('Resursvy','Resource view')}><button type="button" aria-pressed={tab==='library'} onClick={()=>setTab('library')}>{t('Bildbibliotek','Image library')}</button><button type="button" aria-pressed={tab==='order'} onClick={()=>setTab('order')}>{t('Läsordning','Reading order')}</button></div>
      <div hidden={tab!=='library'}>{library}</div><div hidden={tab!=='order'} ref={setTarget}/>
    </aside>
  </section></ReadingTarget.Provider>;
}

/** Display-only size: page/panel coordinates and saved images never change. */
export function PageCanvasViewport({children,ratio,locale}:{children:ReactNode;ratio:number;locale:Locale}){
  const host=useRef<HTMLDivElement>(null),scroll=useRef<HTMLDivElement>(null);
  const [mode,setMode]=useState<'page'|'width'|'zoom'>('page'),[zoom,setZoom]=useState(100),[space,setSpace]=useState({width:700,height:700});
  const t=(a:string,b:string)=>locale==='sv'?a:b;
  useLayoutEffect(()=>{const measure=()=>{const node=scroll.current;if(!node)return;const rect=node.getBoundingClientRect();setSpace(prev=>{const next={width:Math.max(180,rect.width-32),height:Math.max(280,window.innerHeight-Math.max(0,rect.top)-24)};return next.width===prev.width&&next.height===prev.height?prev:next;});};measure();const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):null;if(host.current)observer?.observe(host.current);window.addEventListener('resize',measure);return()=>{observer?.disconnect();window.removeEventListener('resize',measure);};},[]);
  const safeRatio=Number.isFinite(ratio)&&ratio>0?ratio:1;
  const fit=Math.min(space.width,(space.height-32)*safeRatio);
  const width=mode==='page'?fit:mode==='width'?space.width:fit*zoom/100;
  const shown=Math.round(width/fit*100);
  const changeZoom=(n:number)=>{setMode('zoom');setZoom(Math.max(25,Math.min(400,n)));};
  return <div className="page-view" ref={host}>
    <div className="page-view-controls" role="group" aria-label={t('Sidans visningszoom','Page view zoom')}>
      <button type="button" aria-pressed={mode==='page'} onClick={()=>{setMode('page');scroll.current?.scrollTo?.(0,0);}}>{t('Anpassa sida','Fit page')}</button>
      <button type="button" aria-pressed={mode==='width'} onClick={()=>setMode('width')}>{t('Anpassa bredd','Fit width')}</button>
      <button type="button" aria-label={t('Zooma ut sidan','Zoom page out')} disabled={shown<=25} onClick={()=>changeZoom(shown-25)}>−</button>
      <output aria-label={t('Sidans förstoring','Page magnification')}>{shown}%</output>
      <button type="button" aria-label={t('Zooma in sidan','Zoom page in')} disabled={shown>=400} onClick={()=>changeZoom(shown+25)}>+</button>
    </div>
    <div className="page-canvas-viewport" ref={scroll} style={{height:`${space.height}px`}}><div className="page-canvas-size" style={{width:`${Math.max(100,width)}px`}}>{children}</div></div>
  </div>;
}
