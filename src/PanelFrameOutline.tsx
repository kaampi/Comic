import type { ComicProject, PageLayer } from "./project";
import { albumPageFormat, layerRect, PANEL_BORDER } from "./pageFormat";
import { panelBorderStyle, panelBorderWidth } from "./panelBorder";
import { panelShapePoints, shapedPanel } from "./panelShape";
export function PanelFrameOutline({project,page,layer}:{project:ComicProject;page:ComicProject["pages"][number];layer:PageLayer}) {
  const width=panelBorderWidth(project,layer);if(width<=0)return null;
  const rect=layerRect(page,layer,albumPageFormat(project)),w=rect.width-2*PANEL_BORDER,h=rect.height-2*PANEL_BORDER;
  const color=panelBorderStyle(project,layer).color;
  return <svg className="panel-frame-outline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
    {shapedPanel(layer)?<polygon points={panelShapePoints(layer).map(p=>`${p.x/4*w},${p.y/4*h}`).join(" ")} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round"/>:<rect x={-PANEL_BORDER/2} y={-PANEL_BORDER/2} width={w+PANEL_BORDER} height={h+PANEL_BORDER} fill="none" stroke={color} strokeWidth={width}/>}
  </svg>;
}
