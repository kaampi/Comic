import type { TextOverlay } from "./project";

function lines(text:string,maxChars=24):string[]{const words=text.trim().split(/\s+/).filter(Boolean),out:string[]=[];let line="";for(const word of words){const next=line?line+" "+word:word;if(next.length>maxChars&&line){out.push(line);line=word}else line=next}if(line)out.push(line);return out.slice(0,7);}
const common={fill:"#fffdf7",stroke:"#171411",strokeWidth:2,vectorEffect:"non-scaling-stroke" as const};
type Pt={x:number;y:number};
const point=(cx:number,cy:number,rx:number,ry:number,a:number):Pt=>({x:cx+Math.cos(a)*rx,y:cy+Math.sin(a)*ry});

function speechPath(o:TextOverlay,style:string){
 const w=o.width,h=o.height,cx=w/2,cy=h/2;
 const tx=(o.tailX??o.x+w*.58)-o.x,ty=(o.tailY??o.y+h*1.12)-o.y;
 // Body proportions derived from the user-provided single-path SVG reference.
 const rx=w*(style==="wide"?.49:style==="tall"?.43:.48),ry=h*(style==="wide"?.37:style==="tall"?.48:.43);
 const angle=Math.atan2((ty-cy)/ry,(tx-cx)/rx),spread=.08+((o.tailRootWidth??50)/100)*.22;
 const a1=angle-spread,a2=angle+spread,tau=Math.PI*2;
 // Smooth superellipse-like body: broad top/bottom and softly tightened sides, matching the reference silhouette.
 const p=(a:number)=>{const ca=Math.cos(a),sa=Math.sin(a),round=(o.roundness??45)/100,organic=1+.055*Math.cos(2*a)-.032*Math.cos(4*a),shape=organic*(1-round)+round;return{x:cx+ca*rx*shape,y:cy+sa*ry*(1-.035*(1-round)*Math.cos(2*a))};};
 const r1=p(a1),r2=p(a2),sweep=((a1-a2)%tau+tau)%tau,steps=96;
 let d=`M ${r1.x.toFixed(2)} ${r1.y.toFixed(2)}`;
 // Integrated tapered tail. Quadratic controls keep both joins tangent-looking instead of triangular.
 const curve=(o.tailCurve??0)/100,dx=tx-cx,dy=ty-cy,len=Math.max(1,Math.hypot(dx,dy)),px=-dy/len,py=dx/len,bend=curve*Math.min(w,h)*.42;
 const c1x=r1.x+(tx-r1.x)*.34+px*bend,c1y=r1.y+(ty-r1.y)*.34+py*bend,c2x=r2.x+(tx-r2.x)*.34+px*bend,c2y=r2.y+(ty-r2.y)*.34+py*bend;
 d+=` Q ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)} Q ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${r2.x.toFixed(2)} ${r2.y.toFixed(2)}`;
 for(let i=1;i<=steps;i++){const q=p(a2+sweep*i/steps);d+=` L ${q.x.toFixed(2)} ${q.y.toFixed(2)}`;}
 return d+" Z";
}
function shoutPath(o:TextOverlay){const w=o.width,h=o.height,cx=w/2,cy=h/2,pts=18;return Array.from({length:pts},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/pts,r=i%2?0.72:1,x=cx+Math.cos(a)*w*.48*r,y=cy+Math.sin(a)*h*.48*r;return(i?"L":"M")+" "+x+" "+y}).join(" ")+" Z";}
function thoughtBody(w:number,h:number){return `M ${w*.08} ${h*.48} C ${w*.06} ${h*.18}, ${w*.25} ${h*.04}, ${w*.52} ${h*.06} C ${w*.82} ${h*.02}, ${w*.96} ${h*.20}, ${w*.94} ${h*.49} C ${w*.97} ${h*.78}, ${w*.76} ${h*.94}, ${w*.49} ${h*.92} C ${w*.22} ${h*.96}, ${w*.05} ${h*.78}, ${w*.08} ${h*.48} Z`;}
function ThoughtTrail({o}:{o:TextOverlay}){if(o.tailX===undefined||o.tailY===undefined)return null;const tx=o.tailX-o.x,ty=o.tailY-o.y,cx=o.width*.5,cy=o.height*.72;return <>{[.38,.64,.86].map((t,i)=><circle key={i} cx={cx+(tx-cx)*t} cy={cy+(ty-cy)*t} r={[5,3.6,2.4][i]} {...common}/>)}</>;}

export function SvgOverlay({overlay}:{overlay:TextOverlay}){
 const fontSize=overlay.fontSize??(overlay.type==="sfx"?20:12),textLines=lines(overlay.text,Math.max(6,Math.floor(overlay.width/(fontSize*.58)))),style=overlay.bubbleStyle??"organic",w=overlay.width,h=overlay.height;
 return <g transform={`translate(${overlay.x} ${overlay.y}) rotate(${overlay.rotation} ${w/2} ${h/2})`}>
  {overlay.type==="speech"?<path d={style==="shout"?shoutPath(overlay):speechPath(overlay,style)} {...common} strokeDasharray={style==="whisper"?"4 3":undefined}/>:null}
  {overlay.type==="thought"?<><path d={thoughtBody(w,h)} {...common}/><ThoughtTrail o={overlay}/></>:null}
  {overlay.type==="caption"?<rect width={w} height={h} rx="2" {...common}/>:null}
  <text x={w/2} y={h/2-(textLines.length-1)*fontSize*.575} textAnchor="middle" dominantBaseline="middle" fontFamily={overlay.fontFamily??(overlay.type==="sfx"?"Impact, sans-serif":"Comic Neue, sans-serif")} fontWeight={overlay.fontWeight??(overlay.type==="sfx"?800:600)} fontSize={fontSize} fill="#171411" stroke={overlay.type==="sfx"?"#fffdf7":"none"} strokeWidth={overlay.type==="sfx"?3:0} paintOrder="stroke">{textLines.map((line,i)=><tspan key={i} x={w/2} dy={i===0?0:fontSize*1.15}>{line}</tspan>)}</text>
 </g>;
}
