import { wrapOverlayText } from "./overlayTypography";
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

function speechPath(o:TextOverlay,style:string){
 if(o.tailEnabled===false)return bodyPath(o,style);
 const w=o.width,h=o.height,cx=w/2,cy=h/2;
 const tx=(o.tailX??o.x+w*.58)-o.x,ty=(o.tailY??o.y+h*1.12)-o.y;
 const rx=w*(style==="wide"?.49:style==="tall"?.43:.48),ry=h*(style==="wide"?.37:style==="tall"?.48:.43);
 const angle=Math.atan2((ty-cy)/ry,(tx-cx)/rx),spread=.08+((o.tailRootWidth??50)/100)*.22;
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
// Broad, uneven cloud lobes built from cubic arcs instead of radial ripples.
function thoughtCloudPath(w:number,h:number){
 const segments=[
  [.12,.72],
  [-.02,.69,-.02,.32,.17,.30],
  [.19,.12,.34,.04,.45,.16],
  [.54,-.01,.69,.04,.74,.23],
  [.88,.14,.99,.30,.95,.44],
  [1.08,.50,1.00,.71,.92,.75],
  [.90,.94,.75,1.00,.65,.86],
  [.57,1.03,.41,1.00,.35,.88],
  [.22,1.01,.09,.94,.12,.72],
 ];
 return segments.map((points,index)=>(index?"C":"M")+" "+points.map((value,i)=>(value*(i%2?h:w)).toFixed(3)).join(" ")).join(" ")+" Z";
}
export function thoughtTailEndpoint(o:TextOverlay){return {x:o.tailX??o.x+o.width*.75,y:o.tailY??o.y+o.height*1.55};}
function ThoughtTrail({o}:{o:TextOverlay}){
 const end=thoughtTailEndpoint(o),tx=end.x-o.x,ty=end.y-o.y,cx=o.width/2,cy=o.height/2;
 const angle=Math.atan2((ty-cy)/(o.height*.43),(tx-cx)/(o.width*.48));
 const start=roundedBodyPoint(o,o.bubbleStyle??"organic",angle),common=commonStyle(o),size=Math.min(o.width,o.height);
 return <g className="thought-trail">{[.25,.65,1].map((t,i)=><circle key={i} cx={start.x+(tx-start.x)*t} cy={start.y+(ty-start.y)*t} r={Math.max(.4,size*[.09,.065,.04][i])} {...common}/>)}</g>;
}

export function SvgOverlay({overlay}:{overlay:TextOverlay}){
 const sizeValue=overlay.fontSize??(overlay.type==="sfx"?20:12);
 const fontSize=sizeValue*.6;
 const style=overlay.bubbleStyle??"organic",w=overlay.width,h=overlay.height;
 const padding=w*Math.max(0,Math.min(25,overlay.textPadding??4))/100;
 const textLines=wrapOverlayText(overlay.text,Math.max(1,Math.floor((w-2*padding)/(fontSize*.5))));
 const align=overlay.textAlign??"center",textX=align==="left"?padding:align==="right"?w-padding:w/2;
 const anchor=align==="left"?"start":align==="right"?"end":"middle";
 const common=commonStyle(overlay);
 return <g transform={`translate(${overlay.x} ${overlay.y}) rotate(${overlay.rotation} ${w/2} ${h/2})`}>
  {overlay.type==="speech"?<path d={style==="shout"?shoutPath(overlay):speechPath(overlay,style)} {...common} strokeDasharray={style==="whisper"?"4 3":undefined}/>:null}
  {overlay.type==="thought"?<><path className="thought-cloud" d={thoughtCloudPath(w,h)} {...common}/><ThoughtTrail o={overlay}/></>:null}
  {overlay.type==="caption"?<path d={bodyPath({...overlay,roundness:overlay.roundness??18},"organic")} {...common}/>:null}
  <text x={textX} y={h/2-(textLines.length-1)*fontSize*.575} textAnchor={anchor} dominantBaseline="middle" fontFamily={overlay.fontFamily??(overlay.type==="sfx"?"Impact, sans-serif":"Comic Neue, sans-serif")} fontWeight={overlay.fontWeight??(overlay.type==="sfx"?800:600)} fontSize={fontSize} fill="#171411" stroke={overlay.type==="sfx"?"#fffdf7":"none"} strokeWidth={overlay.type==="sfx"?3:0} paintOrder="stroke">{textLines.map((line,i)=><tspan key={i} x={textX} dy={i===0?0:fontSize*1.15}>{line||"\u00a0"}</tspan>)}</text>
 </g>;
}

