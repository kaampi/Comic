import { useEffect, useReducer } from "react";
import { overlayTextLayout, type LayerTextMetrics } from "./pageTypography";
import { SfxArtwork } from "./SfxArtwork";
import { thoughtCloudGeometry, thoughtTrailGeometry, thoughtTrailStart } from "./thoughtBubble";
export { thoughtTailEndpoint } from "./thoughtBubble";
import { overlayFont, wrapOverlayText } from "./overlayTypography";
import type { TextOverlay } from "./project";

function commonStyle(o:TextOverlay){
  return {
    fill:o.fillColor??"#fffdf7",
    fillOpacity:o.fillOpacity??1,
    stroke:o.strokeColor??"#171411",
    strokeWidth:o.strokeWidth??2,
    vectorEffect:"non-scaling-stroke" as const
  };
}

function roundedBodyPoint(o:TextOverlay,style:string,a:number){
 const w=o.width,h=o.height,cx=w/2,cy=h/2;
 const rx=w*(style==="wide"?.49:style==="tall"?.43:.48),ry=h*(style==="wide"?.37:style==="tall"?.48:.43);
 const round=Math.max(0,Math.min(100,o.roundness??60))/100;
 const exponent=2+(1-round)*18;
 const ca=Math.cos(a),sa=Math.sin(a);
 const sx=Math.sign(ca)*Math.pow(Math.abs(ca),2/exponent);
 const sy=Math.sign(sa)*Math.pow(Math.abs(sa),2/exponent);
 return{x:cx+sx*rx,y:cy+sy*ry};
}

function bodyPath(o:TextOverlay,style:string){
 const tau=Math.PI*2,steps=96;
 const start=roundedBodyPoint(o,style,0);
 let d=`M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
 for(let i=1;i<=steps;i++){const q=roundedBodyPoint(o,style,tau*i/steps);d+=` L ${q.x.toFixed(2)} ${q.y.toFixed(2)}`;}
 return d+" Z";
}

function speechAttachmentAngle(o:TextOverlay,style:string){
 const rx=o.width*(style==="wide"?.49:style==="tall"?.43:.48),ry=o.height*(style==="wide"?.37:style==="tall"?.48:.43);
 if(o.tailStartAngle===undefined)return Math.atan2(((o.tailY??o.y+o.height*1.12)-o.y-o.height/2)/ry,((o.tailX??o.x+o.width*.58)-o.x-o.width/2)/rx);
 const exponent=2+(1-Math.max(0,Math.min(100,o.roundness??60))/100)*18;
 const u=Math.cos(o.tailStartAngle)/rx,v=Math.sin(o.tailStartAngle)/ry;
 return Math.atan2(Math.sign(v)*Math.abs(v)**(exponent/2),Math.sign(u)*Math.abs(u)**(exponent/2));
}
export function bubbleTailStart(o:TextOverlay){
 const p=o.type==="thought"?thoughtTrailStart(o,thoughtCloudGeometry(o.width,o.height).outline):roundedBodyPoint(o,o.bubbleStyle??"organic",speechAttachmentAngle(o,o.bubbleStyle??"organic"));
 const a=o.rotation*Math.PI/180,dx=p.x-o.width/2,dy=p.y-o.height/2;
 return {x:o.x+o.width/2+dx*Math.cos(a)-dy*Math.sin(a),y:o.y+o.height/2+dx*Math.sin(a)+dy*Math.cos(a)};
}
export function bubbleTailStartAngle(o:TextOverlay,x:number,y:number){
 const a=-o.rotation*Math.PI/180,dx=x-o.x-o.width/2,dy=y-o.y-o.height/2;
 return Math.atan2(dx*Math.sin(a)+dy*Math.cos(a),dx*Math.cos(a)-dy*Math.sin(a));
}
function speechPath(o:TextOverlay,style:string){
 if(o.tailEnabled===false)return bodyPath(o,style);
 const w=o.width,h=o.height,cx=w/2,cy=h/2;
 const tx=(o.tailX??o.x+w*.58)-o.x,ty=(o.tailY??o.y+h*1.12)-o.y;
 const rx=w*(style==="wide"?.49:style==="tall"?.43:.48),ry=h*(style==="wide"?.37:style==="tall"?.48:.43);
 const angle=speechAttachmentAngle(o,style),spread=.08+((o.tailRootWidth??50)/100)*.22;
 const a1=angle-spread,a2=angle+spread,tau=Math.PI*2;
 const p=(a:number)=>roundedBodyPoint(o,style,a);
 const r1=p(a1),r2=p(a2),sweep=((a1-a2)%tau+tau)%tau,steps=96;
 let d=`M ${r1.x.toFixed(2)} ${r1.y.toFixed(2)}`;
 const curve=(o.tailCurve??0)/100,dx=tx-cx,dy=ty-cy,len=Math.max(1,Math.hypot(dx,dy)),px=-dy/len,py=dx/len,bend=curve*Math.min(w,h)*.42;
 const c1x=r1.x+(tx-r1.x)*.34+px*bend,c1y=r1.y+(ty-r1.y)*.34+py*bend,c2x=r2.x+(tx-r2.x)*.34+px*bend,c2y=r2.y+(ty-r2.y)*.34+py*bend;
 d+=` Q ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)} Q ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${r2.x.toFixed(2)} ${r2.y.toFixed(2)}`;
 for(let i=1;i<=steps;i++){const q=p(a2+sweep*i/steps);d+=` L ${q.x.toFixed(2)} ${q.y.toFixed(2)}`;}
 return d+" Z";
}
function shoutPath(o:TextOverlay){const w=o.width,h=o.height,cx=w/2,cy=h/2,pts=18;return Array.from({length:pts},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/pts,r=i%2?0.72:1,x=cx+Math.cos(a)*w*.48*r,y=cy+Math.sin(a)*h*.48*r;return(i?"L":"M")+" "+x+" "+y}).join(" ")+" Z";}

export function SvgOverlay({overlay,textMetrics}:{overlay:TextOverlay;textMetrics?:LayerTextMetrics}){
 const [,refreshFontMetrics]=useReducer((n:number)=>n+1,0);
 useEffect(()=>{
  if(typeof document==="undefined"||!document.fonts)return;
  let active=true;
  const refresh=()=>{if(active)refreshFontMetrics();};
  document.fonts.addEventListener("loadingdone",refresh);
  document.fonts.load(overlayFont(overlay,16),overlay.text||"ÅÄÖ abc").then(refresh,()=>{});
  return ()=>{active=false;document.fonts.removeEventListener("loadingdone",refresh);};
 },[overlay.fontFamily,overlay.fontWeight,overlay.type,overlay.text]);
 const sizeValue=overlay.fontSize??(overlay.type==="sfx"?20:12);
 const pointLayout=textMetrics?overlayTextLayout(overlay,textMetrics):undefined;
 const fontSize=pointLayout?.fontSize??sizeValue*.6;
 const style=overlay.bubbleStyle??"organic",w=overlay.width,h=overlay.height;
 const padding=w*Math.max(0,Math.min(25,overlay.textPadding??4))/100;
 const textLines=pointLayout?.textLines??wrapOverlayText(overlay.text,Math.max(1,Math.floor((w-2*padding)/(fontSize*.5))));
 const align=overlay.textAlign??"center",textX=pointLayout?.textX??(align==="left"?padding:align==="right"?w-padding:w/2);
 const anchor=align==="left"?"start":align==="right"?"end":"middle";
 const common=commonStyle(overlay);
 const cloud=overlay.type==="thought"?thoughtCloudGeometry(w,h):undefined;
 return <><g transform={`translate(${overlay.x} ${overlay.y}) rotate(${overlay.rotation} ${w/2} ${h/2})`}>
  {overlay.type==="speech"?<path d={style==="shout"?shoutPath(overlay):speechPath(overlay,style)} {...common} strokeDasharray={style==="whisper"?"4 3":undefined}/>:null}
  {overlay.type==="thought"?<><g className="thought-trail">{thoughtTrailGeometry(overlay,cloud!.outline).map((circle,i)=><circle key={i} cx={circle.x} cy={circle.y} r={circle.r} {...common}/>)}</g><path className="thought-cloud" d={cloud!.path} {...common} strokeLinejoin="round" strokeLinecap="round"/></>:null}
  {overlay.type==="caption"?<path d={bodyPath({...overlay,roundness:overlay.roundness??18},"organic")} {...common}/>:null}
  {overlay.type==="sfx"?<SfxArtwork shape={overlay.sfxShapeId??"none"} width={w} height={h} fill={overlay.fillColor} stroke={overlay.strokeColor} strokeWidth={overlay.strokeWidth} opacity={overlay.fillOpacity}/>:null}
 </g>
 <g transform={textMetrics&&pointLayout?`translate(${overlay.x} ${overlay.y}) scale(${100/textMetrics.width} ${100/textMetrics.height}) rotate(${overlay.rotation} ${pointLayout.width/2} ${pointLayout.height/2})`:`translate(${overlay.x} ${overlay.y}) rotate(${overlay.rotation} ${w/2} ${h/2})`}>
  {overlay.type!=="sfx"||!overlay.sfxTextHidden?<text x={textX} y={pointLayout?.textY??h/2-(textLines.length-1)*fontSize*.575} textAnchor={anchor} dominantBaseline="middle" fontFamily={overlay.fontFamily??(overlay.type==="sfx"?"Impact, sans-serif":"Comic Neue, sans-serif")} fontWeight={overlay.fontWeight??(overlay.type==="sfx"?800:600)} fontSize={fontSize} fill={overlay.sfxTextColor??"#171411"} stroke={overlay.type==="sfx"?"#fffdf7":"none"} strokeWidth={overlay.type==="sfx"?3:0} paintOrder="stroke">{textLines.map((line,i)=><tspan key={i} x={textX} dy={i===0?0:fontSize*1.15}>{line||"\u00a0"}</tspan>)}</text>:null}
 </g></>;
}
