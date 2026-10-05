import { panelBorderWidth, type PanelBorderStyle } from "./panelBorder";
import type { ComicProject, PageLayer } from "./project";
import { layerRect, pageDimensions, PAGE_RENDER_WIDTH, PANEL_BORDER, type PageFormat } from "./pageFormat";
import { panelShapePoints, shapedPanel, validPanelShape, type ShapePoint } from "./panelShape";
type Page = ComicProject["pages"][number];
export type PanelSide = "left" | "right" | "above" | "below";
const epsilon=1e-7;
export function panelOutline(page: Page, layer: PageLayer, format: PageFormat): ShapePoint[] {
  const r=layerRect(page,layer,format), inset=shapedPanel(layer)?PANEL_BORDER:PANEL_BORDER/2;
  return panelShapePoints(layer).map(p=>({x:r.x+inset+p.x/4*(r.width-2*inset),y:r.y+inset+p.y/4*(r.height-2*inset)}));
}
export function panelsOverlap(page: Page, a: PageLayer, b: PageLayer, format: PageFormat, defaults?: PanelBorderStyle): boolean {
  const pa=panelOutline(page,a,format),pb=panelOutline(page,b,format);
  const clearance=(panelBorderWidth({pageFormat:format,panelBorderDefaults:defaults},a)+panelBorderWidth({pageFormat:format,panelBorderDefaults:defaults},b))/2;
  // Separating axes for convex polygons, including both half-stroke widths.
  for(const polygon of [pa,pb])for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length],length=Math.hypot(q.x-p.x,q.y-p.y);
    const nx=(q.y-p.y)/length,ny=(p.x-q.x)/length;
    const aa=pa.map(v=>v.x*nx+v.y*ny),bb=pb.map(v=>v.x*nx+v.y*ny);
    if(Math.max(...aa)+clearance<=Math.min(...bb)+epsilon||Math.max(...bb)+clearance<=Math.min(...aa)+epsilon)return false;
  }
  return true;
}
export function fitPanelToNeighbor(page: Page, layer: PageLayer, neighbor: PageLayer, side: PanelSide, marginMm: number, format: PageFormat, defaults?: PanelBorderStyle): PageLayer | null {
  if(layer.id===neighbor.id||!Number.isFinite(marginMm)||marginMm<0||marginMm>20)return null;
  const direction=side==="left"?{x:-1,y:0}:side==="right"?{x:1,y:0}:side==="above"?{x:0,y:-1}:{x:0,y:1};
  const outline=panelOutline(page,neighbor,format);
  const edges=outline.map((a,i)=>{
    const b=outline[(i+1)%outline.length],length=Math.hypot(b.x-a.x,b.y-a.y);
    const normal={x:(b.y-a.y)/length,y:(a.x-b.x)/length};
    return {a,normal,score:normal.x*direction.x+normal.y*direction.y};
  }).sort((a,b)=>b.score-a.score);
  const edge=edges[0];if(edge.score<=0)return null;
  const x=side==="left"||side==="right"?Math.min(layer.x,neighbor.x):layer.x;
  const y=side==="above"||side==="below"?Math.min(layer.y,neighbor.y):layer.y;
  const width=side==="left"||side==="right"?Math.max(layer.x+layer.width,neighbor.x+neighbor.width)-x:layer.width;
  const height=side==="above"||side==="below"?Math.max(layer.y+layer.height,neighbor.y+neighbor.height)-y:layer.height;
  const candidate={...layer,x,y,width,height};
  const r=layerRect(page,candidate,format),left=r.x+PANEL_BORDER,top=r.y+PANEL_BORDER,w=r.width-2*PANEL_BORDER,h=r.height-2*PANEL_BORDER;
  if(w<=0||h<=0)return null;
  const clearance=(panelBorderWidth({pageFormat:format,panelBorderDefaults:defaults},layer)+panelBorderWidth({pageFormat:format,panelBorderDefaults:defaults},neighbor))/2;
  const distance=marginMm*PAGE_RENDER_WIDTH/pageDimensions(format).widthMm+clearance;
  const signed=(p:ShapePoint)=>(p.x-edge.a.x)*edge.normal.x+(p.y-edge.a.y)*edge.normal.y-distance;
  const input=[{x:left,y:top},{x:left+w,y:top},{x:left+w,y:top+h},{x:left,y:top+h}],clipped:ShapePoint[]=[];
  for(let i=0;i<input.length;i++){
    const a=input[i],b=input[(i+1)%input.length],da=signed(a),db=signed(b);
    if(da>=-epsilon)clipped.push(a);
    if((da>=0)!==(db>=0)){
      const t=da/(da-db);clipped.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});
    }
  }
  const unique=clipped.filter((p,i)=>!clipped.some((q,j)=>j<i&&Math.hypot(p.x-q.x,p.y-q.y)<epsilon));
  const shapePoints=unique.map(p=>({x:Math.max(0,Math.min(4,(p.x-left)/w*4)),y:Math.max(0,Math.min(4,(p.y-top)/h*4))}));
  if(!validPanelShape(shapePoints))return null;
  const result={...candidate,shapePoints};
  if(page.placements.some(p=>p.id!==layer.id&&panelsOverlap(page,result,p,format,defaults)))return null;
  return result;
}
