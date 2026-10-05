export type ShapePoint = { x: number; y: number };
export const PANEL_SHAPE_PRESETS = [
  { id: "rectangle", sv: "Rektangel", en: "Rectangle", points: [{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}] },
  { id: "diamond", sv: "Romb", en: "Diamond", points: [{x:2,y:0},{x:4,y:2},{x:2,y:4},{x:0,y:2}] },
  { id: "parallelogram", sv: "Parallellogram", en: "Parallelogram", points: [{x:1,y:0},{x:4,y:0},{x:3,y:4},{x:0,y:4}] },
  { id: "trapezoid", sv: "Trapets", en: "Trapezoid", points: [{x:1,y:0},{x:3,y:0},{x:4,y:4},{x:0,y:4}] },
  { id: "triangle", sv: "Triangel", en: "Triangle", points: [{x:2,y:0},{x:4,y:4},{x:0,y:4}] },
] as const;

export function validPanelShape(value: unknown): value is ShapePoint[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 4) return false;
  if (!value.every(p => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x <= 4 && p.y >= 0 && p.y <= 4)) return false;
  if (new Set(value.map(p => `${p.x},${p.y}`)).size !== value.length) return false;
  let area = 0;
  for (let i=0;i<value.length;i++) {
    const a=value[i],b=value[(i+1)%value.length],c=value[(i+2)%value.length];
    // Keep clockwise convex outlines; reject crossings and collapsed corners.
    if ((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x) <= 0) return false;
    area += a.x*b.y-b.x*a.y;
  }
  return area > 0;
}
export function panelShapePoints(layer: { shapePoints?: ShapePoint[] }): ShapePoint[] {
  return validPanelShape(layer.shapePoints) ? layer.shapePoints : PANEL_SHAPE_PRESETS[0].points.map(p=>({...p}));
}
export function moveShapeCorner(points: ShapePoint[], index: number, x: number, y: number): ShapePoint[] {
  const next=points.map((p,i)=>i===index?{x:Math.max(0,Math.min(4,Math.round(x))),y:Math.max(0,Math.min(4,Math.round(y)))}:{...p});
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
