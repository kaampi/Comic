import { SvgOverlay } from "./SvgOverlay";
import { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { bubbleGroups, overlayStack, connectedBubbleGeometry } from "./bubbleConnections";
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

// Paint each unit's contour and text together, so foreground fills cover lower text.
// Unknown children (such as the active text editor) stay on top.
export function StackedOverlays({ overlays, textMetrics, children }: { overlays: TextOverlay[]; textMetrics?: LayerTextMetrics; children: ReactNode }) {
  const all = Children.toArray(children);
  const key = (child: ReactNode) => isValidElement(child) ? child.type === SvgOverlay ? (child as ReactElement<{ overlay: TextOverlay }>).props.overlay.id : (child as ReactElement<{ 'data-overlay-id'?: string }>).props['data-overlay-id'] : undefined;
  return <>{overlayStack(overlays).map(group => <g key={group[0].id} data-overlay-stack={group.map(o => o.id).join(' ')}>
    {group.length > 1 ? <ConnectedBubbles overlays={group} textMetrics={textMetrics}/> : null}
    {group.map(o => all.find(child => key(child) === o.id))}
  </g>)}{all.filter(child => !key(child))}</>;
}
