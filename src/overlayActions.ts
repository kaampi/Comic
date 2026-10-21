import type { TextOverlay, TextStyle } from "./project";
import { editedTextStyles, formatTextRange, textStyleAt } from "./richText";
export type OverlayMenuState={x:number;y:number;mode:'bubble'|'text'|'shape'|'blank';overlayId?:string;node?:number;point?:{x:number;y:number};range?:{start:number;end:number};source?:'inline'|'properties'};
export function cloneOverlay(source:TextOverlay,point?:{x:number;y:number}):TextOverlay {
  const copied=structuredClone(source),x=Math.max(0,Math.min(100-source.width,Number.isFinite(point?.x)?point!.x:source.x+3)),y=Math.max(0,Math.min(100-source.height,Number.isFinite(point?.y)?point!.y:source.y+3)),dx=x-source.x,dy=y-source.y;
  return {...copied,id:'overlay-'+crypto.randomUUID(),x,y,bubbleLinks:undefined,tailX:source.tailX===undefined?undefined:source.tailX+dx,tailY:source.tailY===undefined?undefined:source.tailY+dy};
}
export function styleIsActive(o:TextOverlay,range:{start:number;end:number}|undefined,field:'bold'|'italic'|'underline') {
  const start=range&&range.end>range.start?range.start:0,end=range&&range.end>range.start?range.end:o.text.length;
  const active=(s:TextStyle)=>field==='bold'?(s.fontWeight??600)>=700:field==='italic'?s.fontStyle==='italic':s.underline===true;
  if(start===end)return active(o);
  for(let i=start;i<end;i++)if(!active({...o,...Object.fromEntries(Object.entries(textStyleAt(o,i)).filter(([,v])=>v!==undefined))}))return false;
  return true;
}
export function toggledTextStyle(o:TextOverlay,range:{start:number;end:number}|undefined,field:'bold'|'italic'|'underline'):Partial<TextOverlay>{
  const on=!styleIsActive(o,range,field),patch:TextStyle=field==='bold'?{fontWeight:on?700:400}:field==='italic'?{fontStyle:on?'italic':'normal'}:{underline:on};
  if(!o.text.length)return patch;
  const start=range&&range.end>range.start?range.start:0,end=range&&range.end>range.start?range.end:o.text.length;
  return {textStyles:formatTextRange(o,start,end,patch)};
}
export function replaceOverlayText(o:TextOverlay,range:{start:number;end:number},replacement:string):Partial<TextOverlay>{
  const start=Math.max(0,Math.min(o.text.length,range.start)),end=Math.max(start,Math.min(o.text.length,range.end)),text=o.text.slice(0,start)+replacement+o.text.slice(end);
  return {text,textStyles:editedTextStyles(o,text,{start,end})};
}
export function copiedStyledText(o:TextOverlay,range:{start:number;end:number}) {
  const text=o.text.slice(range.start,range.end),styles=[] as {start:number;end:number;style:TextStyle}[];
  for(let i=range.start;i<range.end;i++){
    const resolved={...o,...Object.fromEntries(Object.entries(textStyleAt(o,i)).filter(([,v])=>v!==undefined))};
    const style:TextStyle={fontFamily:resolved.fontFamily??(o.type==='sfx'?'Impact, sans-serif':'Comic Neue, sans-serif'),fontSize:resolved.fontSize??(o.type==='sfx'?28:8),fontWeight:resolved.fontWeight??(o.type==='sfx'?800:600),fontStyle:resolved.fontStyle??'normal',underline:resolved.underline??false,textColor:resolved.textColor??o.sfxTextColor??'#171411'};
    const previous=styles.at(-1);if(previous&&JSON.stringify(previous.style)===JSON.stringify(style))previous.end++;else styles.push({start:i-range.start,end:i-range.start+1,style});
  }
  return {text,styles};
}
export function pastedStyledText(o:TextOverlay,range:{start:number;end:number},copied:ReturnType<typeof copiedStyledText>):Partial<TextOverlay>{
  const patch=replaceOverlayText(o,range,copied.text);let target={...o,...patch};
  for(const span of copied.styles)target={...target,textStyles:formatTextRange(target,range.start+span.start,range.start+span.end,span.style)};
  return {text:target.text,textStyles:target.textStyles};
}
