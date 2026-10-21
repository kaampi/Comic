import type { TextOverlay } from "./project";
import { customBubbleOutline } from "./bubbleShape";
export type TextInterval = {left:number;right:number};
export type ContourRow = {start:number;end:number;x:number;y:number;top:number;size:number;lineWidth:number;lineHeight:number;available:number};
// Transform the rendered body into the unrotated physical text frame. The
// artwork rotates before the panel's unequal x/y scaling; text rotates after.
export function textBodyPolygon(o:TextOverlay,width:number,height:number) {
  const a=o.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),mx=width/o.width,my=height/o.height;
  return customBubbleOutline(o).map(p=>{const x=p.x-o.width/2,y=p.y-o.height/2,px=(x*c-y*s)*mx,py=(x*s+y*c)*my;return {x:width/2+px*c+py*s,y:height/2-px*s+py*c};});
}
export function contourIntervals(polygon:{x:number;y:number}[],top:number,bottom:number,margin:number):TextInterval[] {
  const low=top-margin,high=bottom+margin,ys=[low,high,(low+high)/2];
  for(const p of polygon)if(p.y>low&&p.y<high)ys.push(p.y-1e-7,p.y+1e-7);
  let result:TextInterval[]|undefined;
  for(const y of ys){
    const cuts:number[]=[];
    for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];if((a.y>y)!==(b.y>y))cuts.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y));}
    cuts.sort((a,b)=>a-b);const intervals:TextInterval[]=[];
    for(let i=0;i+1<cuts.length;i+=2)if(cuts[i+1]-cuts[i]>2*margin)intervals.push({left:cuts[i]+margin,right:cuts[i+1]-margin});
    result=result===undefined?intervals:result.flatMap(a=>intervals.flatMap(b=>{const left=Math.max(a.left,b.left),right=Math.min(a.right,b.right);return right>left?[{left,right}]:[];}));
    if(!result.length)return [];
  }
  return result??[];
}
export function layoutInContour(o:TextOverlay,width:number,height:number,base:number,measure:(start:number,end:number)=>{width:number;size:number}) {
  const polygon=textBodyPolygon(o,width,height),margin=width*Math.max(0,Math.min(25,o.textPadding??4))/100+Math.max(0,o.strokeWidth??2)/2;
  const minY=Math.min(...polygon.map(p=>p.y))+margin+1e-5,maxY=Math.max(...polygon.map(p=>p.y))-margin-1e-5;
  const band=(top:number,size:number)=>contourIntervals(polygon,top,top+size*1.15,margin).sort((a,b)=>(b.right-b.left)-(a.right-a.left)||Math.abs((a.left+a.right)/2-width/2)-Math.abs((b.left+b.right)/2-width/2))[0];
  const paragraphs:{start:number;end:number;next:number}[]=[];let offset=0;
  for(const part of o.text.split(/\r\n|\r|\n/)){const end=offset+part.length,newline=o.text.slice(end).match(/^(\r\n|\r|\n)/)?.[0].length??0;paragraphs.push({start:offset,end,next:end+newline});offset=end+newline;}
  const pack=(startY:number)=>{
    const rows:ContourRow[]=[];let top=startY,overflowStart=o.text.length;
    const add=(start:number,end:number,size:number,lineWidth:number,interval:TextInterval)=>{const available=interval.right-interval.left,x=o.textAlign==='left'?interval.left:o.textAlign==='right'?interval.right-lineWidth:(interval.left+interval.right-lineWidth)/2;rows.push({start,end,x,y:top+size*.85,top,size,lineWidth,lineHeight:size*1.15,available});top+=size*1.15;};
    for(const paragraph of paragraphs){
      let cursor=paragraph.start;
      while(cursor<paragraph.end&&/\s/u.test(o.text[cursor]))cursor++;
      if(cursor===paragraph.end){
        if(!o.text.length)continue;
        let interval=band(top,base);
        while(!interval&&top+base*1.15<maxY){top+=Math.max(.25,base*.2);interval=band(top,base);}
        if(!interval){overflowStart=paragraph.start;return {rows,overflowStart};}
        add(paragraph.start,paragraph.start,base,0,interval);continue;
      }
      while(cursor<paragraph.end){
        const start=cursor;let end=start,size=base,lineWidth=0,chosen:TextInterval|undefined;
        // Grow whole words; only split an unbroken word when it cannot fit.
        while(cursor<paragraph.end){
          let ws=cursor;while(ws<paragraph.end&&/\s/u.test(o.text[ws]))ws++;
          if(ws===paragraph.end){cursor=ws;break;}
          let we=ws;while(we<paragraph.end&&!/\s/u.test(o.text[we]))we++;
          const candidate=measure(start,we),interval=band(top,candidate.size);
          if(interval&&candidate.width<=interval.right-interval.left+1e-7){end=we;cursor=we;size=candidate.size;lineWidth=candidate.width;chosen=interval;continue;}
          if(end>start)break;
          for(const char of Array.from(o.text.slice(start,we))){const next=end+char.length,m=measure(start,next),space=band(top,m.size);if(!space||m.width>space.right-space.left+1e-7)break;end=next;size=m.size;lineWidth=m.width;chosen=space;}
          cursor=end;break;
        }
        if(end===start||!chosen){
          const nextSize=measure(start,start+(Array.from(o.text.slice(start))[0]?.length??0)).size;
          top+=Math.max(.25,nextSize*.2);cursor=start;
          if(top+nextSize*1.15>maxY){overflowStart=start;return {rows,overflowStart};}
          continue;
        }
        add(start,end,size,lineWidth,chosen);
        cursor=end;while(cursor<paragraph.end&&/\s/u.test(o.text[cursor]))cursor++;
      }
    }
    return {rows,overflowStart};
  };
  let result=pack(minY);
  // Keep vertical centring when there is room. If a notch makes the centred
  // placement fail, retain the complete top-to-bottom fit instead.
  if(result.overflowStart===o.text.length&&result.rows.length){
    const last=result.rows.at(-1)!,slack=maxY-(last.top+last.lineHeight);
    if(slack>base*.1){const centred=pack(minY+slack/2);if(centred.overflowStart===o.text.length)result=centred;}
  }
  return {...result,overflow:result.overflowStart<o.text.length,polygon,margin};
}
