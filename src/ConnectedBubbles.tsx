import { bubbleGroups, connectedBubbleGeometry } from "./bubbleConnections";
import type { TextOverlay } from "./project";
import type { LayerTextMetrics } from "./pageTypography";
export function ConnectedBubbles({overlays,textMetrics}:{overlays:TextOverlay[];textMetrics?:LayerTextMetrics}) {
  return <g className="connected-bubbles" style={{pointerEvents:"none"}}>{bubbleGroups(overlays).map(group=>{
    const o=group[0],geometry=connectedBubbleGeometry(group,textMetrics);
    return <g key={o.id} data-bubble-ids={group.map(o=>o.id).join(' ')}>
      <path className="connected-bubble-fill" d={geometry.fillPath} fillRule="nonzero" fill={o.fillColor??"#fffdf7"} fillOpacity={o.fillOpacity??1}/>
      <path className="connected-bubble-outline" d={geometry.strokePath} fill="none" stroke={o.strokeColor??"#171411"} strokeWidth={o.strokeWidth??2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={o.bubbleStyle==="whisper"?"4 3":undefined}/>
    </g>;
  })}</g>;
}
