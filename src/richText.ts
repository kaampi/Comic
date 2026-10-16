import type { TextOverlay, TextStyle, TextStyleRange } from "./project";
import type { LayerTextMetrics } from "./pageTypography";
import { overlayTextMeasure } from "./overlayTypography";
import { PAGE_RENDER_WIDTH } from "./pageFormat";

export function textStyleAt(o: TextOverlay, index: number): TextStyle {
  const r=o.textStyles?.find(r=>index>=r.start&&index<r.end);
  return r?{fontFamily:r.fontFamily,fontSize:r.fontSize,fontWeight:r.fontWeight,...(r.textColor!==undefined?{textColor:r.textColor}:{})}:{};
}
const signature=(s:TextStyle)=>JSON.stringify([s.fontFamily,s.fontSize,s.fontWeight,s.textColor]);
function ranges(styles:TextStyle[]):TextStyleRange[]{
  const result:TextStyleRange[]=[];
  styles.forEach((style,i)=>{if(!Object.values(style).some(v=>v!==undefined))return;const last=result.at(-1);if(last&&last.end===i&&signature(last)===signature(style))last.end++;else result.push({...style,start:i,end:i+1});});
  return result;
}
export function formatTextRange(o:TextOverlay,start:number,end:number,patch:TextStyle):TextStyleRange[]{
  return ranges(Array.from({length:o.text.length},(_,i)=>i>=start&&i<end?{...textStyleAt(o,i),...patch}:textStyleAt(o,i)));
}
export function clearTextRange(o:TextOverlay,start:number,end:number):TextStyleRange[]{
  return ranges(Array.from({length:o.text.length},(_,i)=>i>=start&&i<end?{}:textStyleAt(o,i)));
}
// A single replacement keeps styles before/after the edit and gives inserted
// text the style at the insertion point. Offsets use DOM/JS UTF-16 indices.
export type TextEditRange={start:number;end:number};
export function deletionRange(text:string,start:number,end:number,key:string):TextEditRange {
  if(start===end&&key==="Backspace")start-=Array.from(text.slice(0,start)).at(-1)?.length??0;
  if(start===end&&key==="Delete")end+=Array.from(text.slice(end))[0]?.length??0;
  return {start,end};
}
export function editedTextStyles(o:TextOverlay,text:string,edit?:TextEditRange):TextStyleRange[]|undefined{
  if(!o.textStyles?.length)return undefined;
  let start=0;while(start<o.text.length&&start<text.length&&o.text[start]===text[start])start++;
  let oldEnd=o.text.length,newEnd=text.length;
  while(oldEnd>start&&newEnd>start&&o.text[oldEnd-1]===text[newEnd-1]){oldEnd--;newEnd--;}
  if(edit&&edit.start>=0&&edit.end>=edit.start&&edit.end<=o.text.length){
    const inserted=text.length-o.text.length+edit.end-edit.start;
    const candidateEnd=edit.start+inserted;
    if(inserted>=0&&o.text.slice(0,edit.start)+text.slice(edit.start,candidateEnd)+o.text.slice(edit.end)===text){start=edit.start;oldEnd=edit.end;newEnd=candidateEnd;}
  }
  const inherited=textStyleAt(o,oldEnd===start?Math.max(0,start-1):Math.min(start,Math.max(0,o.text.length-1)));
  return ranges(Array.from({length:text.length},(_,i)=>i<start?textStyleAt(o,i):i<newEnd?inherited:textStyleAt(o,i+oldEnd-newEnd)));
}
export function textPieces(o:TextOverlay,start=0,end=o.text.length){
  const result:{text:string;style:TextStyle;start:number;end:number}[]=[];
  for(let i=start;i<end;i++){
    const style=textStyleAt(o,i),last=result.at(-1);
    if(last&&signature(last.style)===signature(style)){last.text+=o.text[i];last.end++;}
    else result.push({text:o.text[i],style,start:i,end:i+1});
  }
  return result;
}
export function richTextLayout(o:TextOverlay,metrics:LayerTextMetrics){
  const factor=25.4/72*PAGE_RENDER_WIDTH/metrics.pageWidthMm;
  const base=(o.fontSize??(o.type==="sfx"?28:8))*factor;
  const width=o.width*metrics.width/100,height=o.height*metrics.height/100,padding=width*Math.max(0,Math.min(25,o.textPadding??4))/100,available=Math.max(1,width-2*padding);
  const pieces=(start:number,end:number)=>textPieces(o,start,end).map(p=>{const style={...o,...Object.fromEntries(Object.entries(p.style).filter(([,v])=>v!==undefined))},size=(style.fontSize??(o.type==="sfx"?28:8))*factor;return {...p,style,size,width:overlayTextMeasure(style,size)(p.text)};});
  const measure=(start:number,end:number)=>pieces(start,end).reduce((n,p)=>n+p.width,0);
  const lines:{start:number;end:number}[]=[];
  let offset=0;
  for(const paragraph of o.text.split('\n')){
    let start=offset,end=offset;
    const words=[...paragraph.matchAll(/\S+/g)];
    if(!words.length)lines.push({start:offset,end:offset});
    for(const word of words){
      const ws=offset+word.index!,we=ws+word[0].length;
      if(end===start)start=ws;
      if(end>start&&measure(start,we)>available){lines.push({start,end});start=ws;}
      end=start;
      for(const char of Array.from(o.text.slice(start,we))){const next=end+char.length;if(end>start&&measure(start,next)>available){lines.push({start,end});start=end;}end=next;}
    }
    if(words.length)lines.push({start,end});
    offset+=paragraph.length+1;
  }
  const rows=lines.map(line=>{const runs=pieces(line.start,line.end),size=runs.length?Math.max(...runs.map(p=>p.size)):base,lineWidth=runs.reduce((n,p)=>n+p.width,0);return {...line,runs,size,lineWidth,lineHeight:size*1.15};});
  const totalHeight=rows.reduce((n,r)=>n+r.lineHeight,0);let top=(height-totalHeight)/2;
  return {width,height,totalHeight,rows:rows.map(row=>{let x=o.textAlign==="left"?padding:o.textAlign==="right"?width-padding-row.lineWidth:(width-row.lineWidth)/2;const y=top+row.size*.85;top+=row.lineHeight;return {...row,y,runs:row.runs.map(run=>{const out={...run,x};x+=run.width;return out;})};})};
}

