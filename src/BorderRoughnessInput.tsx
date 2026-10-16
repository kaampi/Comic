import { useEffect, useRef, useState } from "react";

// Keep a slider drag local, as with ColorInput, rather than serializing all
// album images at every pointer position. Commit on pause, release or blur.
export function BorderRoughnessInput({value,onChange}:{value:number;onChange:(value:number)=>void}) {
  const [draft,setDraft]=useState(value);
  const pending=useRef(value),dirty=useRef(false),timer=useRef<ReturnType<typeof setTimeout>>();
  const callback=useRef(onChange);callback.current=onChange;
  const cancel=()=>{clearTimeout(timer.current);timer.current=undefined;};
  const flush=()=>{cancel();if(dirty.current){dirty.current=false;callback.current(pending.current);}};
  useEffect(()=>{cancel();dirty.current=false;pending.current=value;setDraft(value);},[value]);
  useEffect(()=>()=>cancel(),[]);
  return <><input type="range" min="0" max="100" step="5" value={draft} onChange={e=>{
    pending.current=Number(e.target.value);dirty.current=pending.current!==value;
    setDraft(pending.current);cancel();if(dirty.current)timer.current=setTimeout(flush,150);
  }} onPointerUp={flush} onPointerCancel={flush} onBlur={flush} onKeyUp={flush} onKeyDown={e=>{if(e.key==="Escape")flush();}}/><output aria-hidden="true">{draft}%</output></>;
}
