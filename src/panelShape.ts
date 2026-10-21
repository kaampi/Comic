export type ShapePoint = { x: number; y: number };
export const PANEL_SHAPE_PRESETS = [
  { id: "rectangle", sv: "Rektangel", en: "Rectangle", points: [{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}] },
  { id: "diamond", sv: "Romb", en: "Diamond", points: [{x:2,y:0},{x:4,y:2},{x:2,y:4},{x:0,y:2}] },
  { id: "parallelogram", sv: "Parallellogram", en: "Parallelogram", points: [{x:1,y:0},{x:4,y:0},{x:3,y:4},{x:0,y:4}] },
  { id: "trapezoid", sv: "Trapets", en: "Trapezoid", points: [{x:1,y:0},{x:3,y:0},{x:4,y:4},{x:0,y:4}] },
  { id: "triangle", sv: "Triangel", en: "Triangle", points: [{x:2,y:0},{x:4,y:4},{x:0,y:4}] },
] as const;

const EPS = 1e-8;
export const MAX_SHAPE_NODES = 64;
export function cross(a: ShapePoint,b: ShapePoint,c: ShapePoint) { return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x); }
function onSegment(a:ShapePoint,b:ShapePoint,p:ShapePoint) {
  return Math.abs(cross(a,b,p))<EPS && p.x>=Math.min(a.x,b.x)-EPS && p.x<=Math.max(a.x,b.x)+EPS && p.y>=Math.min(a.y,b.y)-EPS && p.y<=Math.max(a.y,b.y)+EPS;
}
export function segmentsMeet(a:ShapePoint,b:ShapePoint,c:ShapePoint,d:ShapePoint) {
  return (cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) || onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
export function validPanelShape(value: unknown): value is ShapePoint[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > MAX_SHAPE_NODES) return false;
  if (!value.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 4 && p.y >= 0 && p.y <= 4)) return false;
  let area=0;
  for(let i=0;i<value.length;i++) {
    const a=value[i],b=value[(i+1)%value.length],c=value[(i+2)%value.length];
    if(Math.hypot(a.x-b.x,a.y-b.y)<EPS)return false;
    if(Math.abs(cross(a,b,c))<EPS && (b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)<0)return false;
    area+=a.x*b.y-b.x*a.y;
    for(let j=i+1;j<value.length;j++) {
      if(j===i+1 || (i===0&&j===value.length-1))continue;
      if(segmentsMeet(a,b,value[j],value[(j+1)%value.length]))return false;
    }
  }
  return area>EPS;
}
// Each hidden index identifies the edge starting at that node.
export function visibleShapeEdges(points:ShapePoint[],hidden:number[] = []) {
  return points.flatMap((a,i)=>hidden.includes(i)?[]:[{a,b:points[(i+1)%points.length],index:i}]);
}
export function insertShapeNode(points:ShapePoint[],edge:number,point:ShapePoint,hidden:number[]=[]) {
  const next=[...points.slice(0,edge+1),point,...points.slice(edge+1)];
  if(!validPanelShape(next))return null;
  return {points:next,hidden:hidden.flatMap(i=>i===edge?[i,i+1]:[i>edge?i+1:i])};
}
export function removeShapeNode(points:ShapePoint[],index:number,hidden:number[]=[]) {
  const next=points.filter((_,i)=>i!==index);
  if(!validPanelShape(next))return null;
  // A merged edge stays hidden only when both former segments were hidden.
  const previous=(index+points.length-1)%points.length;
  const nextHidden=hidden.filter(i=>i!==index&&i!==previous).map(i=>i>index?i-1:i);
  if(hidden.includes(index)&&hidden.includes(previous))nextHidden.push(index===0?next.length-1:index-1);
  return {points:next,hidden:nextHidden};
}
export function panelShapePoints(layer: { shapePoints?: ShapePoint[] }): ShapePoint[] {
  return validPanelShape(layer.shapePoints) ? layer.shapePoints : PANEL_SHAPE_PRESETS[0].points.map(p=>({...p}));
}
// Stored coordinates stay normalized to 0..4, preserving previously saved forms.
// Subdivide every single page-grid cell, rather than the whole bounding panel.
export function panelShapeGrid(layer: { width: number; height: number }) {
  return { columns: Math.max(4, Math.round(layer.width * 4)), rows: Math.max(4, Math.round(layer.height * 4)) };
}
export function moveShapeCorner(points: ShapePoint[], index: number, x: number, y: number, columns=4, rows=4, snapping=true): ShapePoint[] {
  const snap=(value:number,divisions:number)=>Math.max(0,Math.min(4,snapping?Math.round(value*divisions/4)*4/divisions:value));
  const next=points.map((p,i)=>i===index?{x:snap(x,columns),y:snap(y,rows)}:{...p});
  return validPanelShape(next) ? next : points;
}
export function shapePolygon(points: ShapePoint[]) { return points.map(p=>`${p.x*25},${p.y*25}`).join(" "); }
export function shapeClipPath(layer: { shapePoints?: ShapePoint[] }) {
  return `polygon(${panelShapePoints(layer).map(p=>`${p.x*25}% ${p.y*25}%`).join(",")})`;
}
export function shapePreset(layer: { shapePoints?: ShapePoint[] }) {
  const points=JSON.stringify(panelShapePoints(layer));
  return PANEL_SHAPE_PRESETS.find(p=>JSON.stringify(p.points)===points)?.id ?? "custom";
}
export function shapedPanel(layer: { shapePoints?: ShapePoint[] }) { return shapePreset(layer) !== "rectangle"; }
