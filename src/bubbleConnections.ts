import type { TextOverlay } from "./project";
import { speechPath, shoutPath } from "./SvgOverlay";
import { svgGeometry, type Point } from "./idmlGeometry";
import { thoughtCloudGeometry, thoughtTrailGeometry } from "./thoughtBubble";
import type { LayerTextMetrics } from "./pageTypography";

export const isBubble = (o: TextOverlay) => o.type === "speech" || o.type === "thought";
export function bubbleGroups(overlays: TextOverlay[]): TextOverlay[][] {
  const remaining = new Set(overlays.filter(isBubble).map(o => o.id)), groups: TextOverlay[][] = [];
  while (remaining.size) {
    const ids = new Set([remaining.values().next().value!]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const o of overlays) for (const link of o.bubbleLinks ?? []) {
        const target = overlays.find(t => t.id === link.targetId);
        if (!isBubble(o) || !target || target.type !== o.type || !Number.isFinite(link.width)) continue;
        if (ids.has(o.id) || ids.has(target.id)) for (const id of [o.id, target.id]) if (!ids.has(id)) { ids.add(id); changed = true; }
      }
    }
    ids.forEach(id => remaining.delete(id));
    if (ids.size > 1) groups.push(overlays.filter(o => ids.has(o.id)));
  }
  return groups;
}
export function unlinkBubble(overlays: TextOverlay[], id: string): TextOverlay[] {
  return overlays.map(o => ({ ...o, bubbleLinks: o.id === id ? undefined : o.bubbleLinks?.filter(l => l.targetId !== id) }));
}
export function linkBubbles(overlays: TextOverlay[], from: string, to: string): TextOverlay[] {
  const a = overlays.find(o => o.id === from), b = overlays.find(o => o.id === to);
  if (!a || !b || a.id === b.id || !isBubble(a) || a.type !== b.type || bubbleGroups(overlays).some(g => g.includes(a) && g.includes(b))) return overlays;
  const linked = overlays.map(o => o.id === from ? { ...o, bubbleLinks: [...(o.bubbleLinks ?? []), { targetId: to, width: 20 }] } : o);
  const group = bubbleGroups(linked).find(g => g.some(o => o.id === from))!;
  // A shared contour has one appearance; text, shape and tails stay individual.
  return linked.map(o => group.some(b => b.id === o.id) ? { ...o, fillColor: a.fillColor, fillOpacity: a.fillOpacity, strokeColor: a.strokeColor, strokeWidth: a.strokeWidth, swatchId: a.swatchId } : o);
}
function flatten(d: string): Point[][] {
  return svgGeometry(d).map(path => {
    const out: Point[] = [];
    for (let i = 0; i < path.points.length; i++) {
      const a = path.points[i], b = path.points[(i + 1) % path.points.length];
      out.push(a.anchor);
      if (a.right.x === a.anchor.x && a.right.y === a.anchor.y && b.left.x === b.anchor.x && b.left.y === b.anchor.y) continue;
      for (let j = 1; j < 12; j++) {
        const t = j / 12, u = 1 - t;
        out.push({ x: u**3*a.anchor.x+3*u*u*t*a.right.x+3*u*t*t*b.left.x+t**3*b.anchor.x, y: u**3*a.anchor.y+3*u*u*t*a.right.y+3*u*t*t*b.left.y+t**3*b.anchor.y });
      }
    }
    return out;
  });
}
const cross = (a: Point, b: Point) => a.x*b.y-a.y*b.x;
const sub = (a: Point, b: Point) => ({x:a.x-b.x,y:a.y-b.y});
const mix = (a: Point, b: Point, t: number) => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
function inside(p: Point, polygon: Point[]) {
  let yes = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if ((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) yes=!yes;
  }
  return yes;
}
export function connectedBubbleGeometry(group: TextOverlay[], metrics?: LayerTextMetrics) {
  const polygons: Point[][] = [];
  for (const o of group) {
    const cloud=o.type==="thought"?thoughtCloudGeometry(o.width,o.height):undefined;
    const paths=cloud?[cloud.path,...thoughtTrailGeometry(o,cloud.outline).map(c=>`M ${c.x+c.r} ${c.y} A ${c.r} ${c.r} 0 1 1 ${c.x-c.r} ${c.y} A ${c.r} ${c.r} 0 1 1 ${c.x+c.r} ${c.y} Z`)]:[o.bubbleStyle==="shout"?shoutPath(o):speechPath(o,o.bubbleStyle??"organic")];
    const a=o.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    for (const d of paths) for (const poly of flatten(d)) polygons.push(poly.map(p=>({x:o.x+o.width/2+(p.x-o.width/2)*c-(p.y-o.height/2)*s,y:o.y+o.height/2+(p.x-o.width/2)*s+(p.y-o.height/2)*c})));
  }
  const mx=(metrics?.width??100)/100,my=(metrics?.height??100)/100;
  for (const o of group) for (const link of o.bubbleLinks??[]) {
    const b=group.find(b=>b.id===link.targetId);if(!b||b.id===o.id)continue;
    const a={x:o.x+o.width/2,y:o.y+o.height/2},end={x:b.x+b.width/2,y:b.y+b.height/2};
    const dx=(end.x-a.x)*mx,dy=(end.y-a.y)*my,len=Math.hypot(dx,dy);if(len<1e-7)continue;
    const half=Math.min(o.width*mx,o.height*my,b.width*mx,b.height*my)*Math.max(2,Math.min(80,link.width))/200;
    const nx=-dy/len*half/mx,ny=dx/len*half/my;
    polygons.push([{x:a.x+nx,y:a.y+ny},{x:end.x+nx,y:end.y+ny},{x:end.x-nx,y:end.y-ny},{x:a.x-nx,y:a.y-ny}]);
  }
  // One nonzero fill avoids doubled opacity in intersections. Only exposed
  // boundary segments receive a stroke, so there are no internal frame lines.
  for (const poly of polygons) if(poly.reduce((sum,p,i)=>sum+cross(p,poly[(i+1)%poly.length]),0)<0)poly.reverse();
  const boundary: [Point,Point][] = [], seen = new Set<string>();
  polygons.forEach((poly,index)=>poly.forEach((a,i)=>{
    const b=poly[(i+1)%poly.length],r=sub(b,a),len=Math.hypot(r.x,r.y);if(len<1e-8)return;
    const cuts=[0,1];
    polygons.forEach((other,j)=>{if(j===index)return;other.forEach((c,k)=>{
      const d=other[(k+1)%other.length],s=sub(d,c),den=cross(r,s),offset=sub(c,a);
      if(Math.abs(den)>1e-10){const t=cross(offset,s)/den,u=cross(offset,r)/den;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);}
      else if(Math.abs(cross(offset,r))<1e-8)for(const p of [c,d]){const t=((p.x-a.x)*r.x+(p.y-a.y)*r.y)/(len*len);if(t>0&&t<1)cuts.push(t);}
    });});
    cuts.sort((a,b)=>a-b);
    for(let k=1;k<cuts.length;k++){
      if(cuts[k]-cuts[k-1]<1e-8)continue;
      const start=mix(a,b,cuts[k-1]),end=mix(a,b,cuts[k]),mid=mix(start,end,.5);
      const outside={x:mid.x+r.y/len*1e-6,y:mid.y-r.x/len*1e-6};
      if(polygons.some((p,j)=>j!==index&&inside(outside,p)))continue;
      const key=[start.x,start.y,end.x,end.y].map(n=>n.toFixed(6)).join(',');
      if(!seen.has(key)){seen.add(key);boundary.push([start,end]);}
    }
  }));
  const xy=(p:Point)=>`${p.x} ${p.y}`;
  const samePoint=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-5;
  const unused=new Set(boundary.map((_,i)=>i)),outlines:Point[][]=[];
  while(unused.size){
    const first=unused.values().next().value!,loop=[boundary[first][0]];
    let edge=first;
    while(unused.has(edge)){
      unused.delete(edge);const end=boundary[edge][1];
      if(samePoint(end,loop[0]))break;
      loop.push(end);
      const next=[...unused].find(i=>samePoint(boundary[i][0],end));
      if(next===undefined)throw new Error("Disconnected bubble contour");
      edge=next;
    }
    outlines.push(loop);
  }
  const fillPath=outlines.map(p=>`M ${p.map(xy).join(' L ')} Z`).join(' ');
  return {polygons:outlines,boundary,fillPath,strokePath:fillPath};
}
