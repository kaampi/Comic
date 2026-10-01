import type { TextOverlay } from "./project";

function lines(text: string): string[] {
  const words=text.trim().split(/\s+/).filter(Boolean); const out:string[]=[]; let line="";
  for(const word of words){const next=line?line+" "+word:word;if(next.length>24&&line){out.push(line);line=word}else line=next} if(line)out.push(line); return out.slice(0,6);
}

export function SvgOverlay({overlay}:{overlay:TextOverlay}) {
  const textLines=lines(overlay.text);
  const common={fill:"#fffdf7",stroke:"#171411",strokeWidth:2,vectorEffect:"non-scaling-stroke" as const};
  return <g transform={`translate(${overlay.x} ${overlay.y}) rotate(${overlay.rotation} ${overlay.width/2} ${overlay.height/2})`}>
    {overlay.type==="speech" ? <><ellipse cx={overlay.width/2} cy={overlay.height/2} rx={overlay.width/2} ry={overlay.height/2} {...common}/>{overlay.tailX!==undefined&&overlay.tailY!==undefined?<path d={`M ${overlay.width*.45} ${overlay.height*.85} L ${overlay.tailX-overlay.x} ${overlay.tailY-overlay.y} L ${overlay.width*.62} ${overlay.height*.82} Z`} {...common}/>:null}</> : null}
    {overlay.type==="thought" ? <ellipse cx={overlay.width/2} cy={overlay.height/2} rx={overlay.width/2} ry={overlay.height/2} {...common} strokeDasharray="3 3"/> : null}
    {overlay.type==="caption" ? <rect width={overlay.width} height={overlay.height} rx="2" {...common}/> : null}
    {overlay.type==="sfx" ? null : null}
    <text x={overlay.width/2} y={overlay.height/2-(textLines.length-1)*7} textAnchor="middle" dominantBaseline="middle" fontFamily={overlay.type==="sfx"?"Impact, sans-serif":"Comic Neue, sans-serif"} fontWeight={overlay.type==="sfx"?800:600} fontSize={overlay.type==="sfx"?20:12} fill="#171411" stroke={overlay.type==="sfx"?"#fffdf7":"none"} strokeWidth={overlay.type==="sfx"?3:0} paintOrder="stroke">{textLines.map((line,i)=><tspan key={i} x={overlay.width/2} dy={i===0?0:14}>{line}</tspan>)}</text>
  </g>;
}
