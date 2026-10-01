import type { TextOverlay } from "./project";

function lines(text:string,maxChars=24):string[]{const words=text.trim().split(/\s+/).filter(Boolean),out:string[]=[];let line="";for(const word of words){const next=line?line+" "+word:word;if(next.length>maxChars&&line){out.push(line);line=word}else line=next}if(line)out.push(line);return out.slice(0,7);}
const common={fill:"#fffdf7",stroke:"#171411",strokeWidth:2,vectorEffect:"non-scaling-stroke" as const};

function bodyPath(w:number,h:number,style:string){
 if(style==="organic") return `M ${w*.08} ${h*.48} C ${w*.06} ${h*.18}, ${w*.25} ${h*.04}, ${w*.52} ${h*.06} C ${w*.82} ${h*.02}, ${w*.96} ${h*.20}, ${w*.94} ${h*.49} C ${w*.97} ${h*.78}, ${w*.76} ${h*.94}, ${w*.49} ${h*.92} C ${w*.22} ${h*.96}, ${w*.05} ${h*.78}, ${w*.08} ${h*.48} Z`;
 if(style==="shout"){const cx=w/2,cy=h/2,pts=18;return Array.from({length:pts},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/pts,r=i%2?0.72:1,x=cx+Math.cos(a)*w*.48*r,y=cy+Math.sin(a)*h*.48*r;return (i?"L":"M")+" "+x+" "+y}).join(" ")+" Z";}
 return "";
}
function Tail({o}:{o:TextOverlay}){if(o.tailX===undefined||o.tailY===undefined)return null;const tx=o.tailX-o.x,ty=o.tailY-o.y,w=o.width,h=o.height;return <path d={`M ${w*.43} ${h*.82} Q ${w*.49} ${h*.98} ${tx} ${ty} Q ${w*.58} ${h*.92} ${w*.64} ${h*.78} Z`} {...common}/>;}
function ThoughtTrail({o}:{o:TextOverlay}){if(o.tailX===undefined||o.tailY===undefined)return null;const tx=o.tailX-o.x,ty=o.tailY-o.y,cx=o.width*.5,cy=o.height*.72;return <>{[.38,.64,.86].map((t,i)=><circle key={i} cx={cx+(tx-cx)*t} cy={cy+(ty-cy)*t} r={[5,3.6,2.4][i]} {...common}/>)}</>;}

export function SvgOverlay({overlay}:{overlay:TextOverlay}){
 const fontSize=overlay.fontSize??(overlay.type==="sfx"?20:12),textLines=lines(overlay.text,Math.max(6,Math.floor(overlay.width/(fontSize*.58)))),style=overlay.bubbleStyle??"organic",w=overlay.width,h=overlay.height;
 return <g transform={`translate(${overlay.x} ${overlay.y}) rotate(${overlay.rotation} ${w/2} ${h/2})`}>
  {overlay.type==="speech"?<>{style==="oval"?<ellipse cx={w/2} cy={h/2} rx={w*.48} ry={h*.46} {...common}/>:style==="rounded"?<rect x={w*.03} y={h*.05} width={w*.94} height={h*.88} rx={Math.min(w,h)*.18} {...common}/>:<path d={bodyPath(w,h,style)} {...common} strokeDasharray={style==="whisper"?"4 3":undefined}/>}<Tail o={overlay}/></>:null}
  {overlay.type==="thought"?<><path d={bodyPath(w,h,"organic")} {...common}/><ThoughtTrail o={overlay}/></>:null}
  {overlay.type==="caption"?<rect width={w} height={h} rx="2" {...common}/>:null}
  <text x={w/2} y={h/2-(textLines.length-1)*fontSize*.575} textAnchor="middle" dominantBaseline="middle" fontFamily={overlay.type==="sfx"?"Impact, sans-serif":"Comic Neue, sans-serif"} fontWeight={overlay.type==="sfx"?800:600} fontSize={fontSize} fill="#171411" stroke={overlay.type==="sfx"?"#fffdf7":"none"} strokeWidth={overlay.type==="sfx"?3:0} paintOrder="stroke">{textLines.map((line,i)=><tspan key={i} x={w/2} dy={i===0?0:fontSize*1.15}>{line}</tspan>)}</text>
 </g>;
}
