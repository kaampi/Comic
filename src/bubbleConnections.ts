import type { TextOverlay, BubbleLink } from "./project";
import { speechPath, shoutPath, bubbleTailStartAngle } from "./SvgOverlay";
import { svgGeometry, type Point } from "./idmlGeometry";
import { thoughtCloudGeometry, thoughtTrailGeometry } from "./thoughtBubble";
import type { LayerTextMetrics } from "./pageTypography";

export const isBubble = (o: TextOverlay) => o.type === "speech" || o.type === "thought";
export function bubbleTailIsConnection(o:TextOverlay,overlays:TextOverlay[]):boolean {
  return isBubble(o)&&(o.bubbleLinks??[]).some(link=>Number.isFinite(link.width)&&overlays.some(target=>target.id===link.targetId&&target.id!==o.id&&target.type===o.type));
}
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
// Work in physical panel coordinates when constructing a constant-width ribbon.
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const center = (o: TextOverlay): Point => ({ x: o.x + o.width / 2, y: o.y + o.height / 2 });
function bodyOutline(o: TextOverlay): Point[] {
  const local = o.type === "thought" ? thoughtCloudGeometry(o.width, o.height).outline
    : flatten(o.bubbleStyle === "shout" ? shoutPath(o) : speechPath({ ...o, tailEnabled: false }, o.bubbleStyle ?? "organic"))[0];
  const a = o.rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), mid = center(o);
  return local.map(p => ({ x: mid.x + (p.x - o.width / 2) * c - (p.y - o.height / 2) * s, y: mid.y + (p.x - o.width / 2) * s + (p.y - o.height / 2) * c }));
}
function attachment(o: TextOverlay, angle: number): Point {
  const mid = center(o), a = angle + o.rotation * Math.PI / 180, ray = { x: Math.cos(a), y: Math.sin(a) };
  const outline = bodyOutline(o);
  let distance = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i], edge = sub(outline[(i + 1) % outline.length], p), den = cross(ray, edge);
    if (Math.abs(den) < 1e-10) continue;
    const offset = sub(p, mid), t = cross(offset, edge) / den, u = cross(offset, ray) / den;
    if (t >= 0 && u >= -1e-8 && u <= 1 + 1e-8) distance = Math.min(distance, t);
  }
  return Number.isFinite(distance) ? { x: mid.x + ray.x * distance, y: mid.y + ray.y * distance } : mid;
}
export function bubbleConnectionControls(a: TextOverlay, b: TextOverlay, link: BubbleLink, metrics?: LayerTextMetrics) {
  const mx = (metrics?.width ?? 100) / 100, my = (metrics?.height ?? 100) / 100;
  const am = center(a), bm = center(b);
  const startAngle = link.startAngle ?? bubbleTailStartAngle(a, bm.x, bm.y);
  const endAngle = link.endAngle ?? bubbleTailStartAngle(b, am.x, am.y);
  const start = attachment(a, startAngle), end = attachment(b, endAngle);
  const dx = (end.x - start.x) * mx, dy = (end.y - start.y) * my;
  const length = Math.hypot(dx, dy);
  const control = (p: Point, v: BubbleLink['startControl'], direction: number) => {
    const along = clamp(v?.along ?? 1 / 3, .05, .45), across = clamp(v?.across ?? 0, -.75, .75);
    return { x: p.x + (dx * along * direction - dy * across) / mx, y: p.y + (dy * along * direction + dx * across) / my };
  };
  return { start, end, startAngle, endAngle, control1: control(start, link.startControl, 1), control2: control(end, link.endControl, -1), mx, my, dx, dy, length };
}
export type ConnectionHandle = 'start' | 'end' | 'control1' | 'control2';
export function moveConnectionHandle(a: TextOverlay, b: TextOverlay, link: BubbleLink, handle: ConnectionHandle, point: Point, metrics?: LayerTextMetrics): BubbleLink {
  if (handle === 'start' || handle === 'end') return { ...link, [handle === 'start' ? 'startAngle' : 'endAngle']: bubbleTailStartAngle(handle === 'start' ? a : b, point.x, point.y) };
  const g = bubbleConnectionControls(a, b, link, metrics), origin = handle === 'control1' ? g.start : g.end;
  if (g.length < 1e-6) return link;
  const x = (point.x - origin.x) * g.mx, y = (point.y - origin.y) * g.my, square = g.length ** 2;
  return { ...link, [handle === 'control1' ? 'startControl' : 'endControl']: {
    along: clamp((x * g.dx + y * g.dy) / square * (handle === 'control1' ? 1 : -1), .05, .45),
    across: clamp((-x * g.dy + y * g.dx) / square, -.75, .75),
  } };
}
export function bubbleConnectionRibbon(a: TextOverlay, b: TextOverlay, link: BubbleLink, metrics?: LayerTextMetrics): Point[] {
  const g = bubbleConnectionControls(a, b, link, metrics);
  if (g.length < 1e-6) return [];
  const physical = (p: Point) => ({ x: p.x * g.mx, y: p.y * g.my });
  const p = [g.start, g.control1, g.control2, g.end].map(physical);
  const samples = Array.from({ length: 49 }, (_, i) => {
    const t = i / 48, u = 1 - t;
    const point = { x: u**3*p[0].x + 3*u*u*t*p[1].x + 3*u*t*t*p[2].x + t**3*p[3].x, y: u**3*p[0].y + 3*u*u*t*p[1].y + 3*u*t*t*p[2].y + t**3*p[3].y };
    const d = { x: 3*u*u*(p[1].x-p[0].x)+6*u*t*(p[2].x-p[1].x)+3*t*t*(p[3].x-p[2].x), y: 3*u*u*(p[1].y-p[0].y)+6*u*t*(p[2].y-p[1].y)+3*t*t*(p[3].y-p[2].y) };
    const dd = { x: 6*u*(p[2].x-2*p[1].x+p[0].x)+6*t*(p[3].x-2*p[2].x+p[1].x), y: 6*u*(p[2].y-2*p[1].y+p[0].y)+6*t*(p[3].y-2*p[2].y+p[1].y) };
    const speed = Math.max(1e-8, Math.hypot(d.x, d.y)), bend = Math.abs(cross(d, dd));
    return { point, nx: -d.y / speed, ny: d.x / speed, radius: bend < 1e-10 ? Infinity : speed**3 / bend };
  });
  // Monotone control projections prevent loops. Limit width at tight bends so
  // the inner edge cannot fold back over itself.
  const size = Math.min(a.width*g.mx,a.height*g.my,b.width*g.mx,b.height*g.my);
  const startHalf = size * clamp(link.startWidth ?? link.width,2,80) / 200;
  const endHalf = size * clamp(link.endWidth ?? link.width,2,80) / 200;
  // Scale both ends together at tight bends, retaining the authored taper ratio.
  const maximum = Math.max(startHalf,endHalf);
  const scale = Math.min(1, g.length * .22 / maximum, ...samples.map(s => s.radius * .7 / maximum));
  const lengths = [0];
  for (let i = 1; i < samples.length; i++) lengths.push(lengths[i-1] + Math.hypot(samples[i].point.x-samples[i-1].point.x,samples[i].point.y-samples[i-1].point.y));
  const total = Math.max(1e-8,lengths[lengths.length-1]);
  const side = (sign: number) => samples.map((s,i) => {
    const progress = lengths[i] / total, half = scale * (startHalf*(1-progress)+endHalf*progress);
    return { x: (s.point.x + sign * s.nx * half) / g.mx, y: (s.point.y + sign * s.ny * half) / g.my };
  });
  // Interior caps overlap the bodies, eliminating seams at the attachment.
  return [center(a), ...side(1), center(b), ...side(-1).reverse()];
}
// The central strip ends at the attachment cross-sections. Join those sides
// to actual rim points with the rim tangent, rather than adding an exposed
// straight triangle from each bubble's centre to the strip.
function joinRibbonToBubbles(a: TextOverlay, b: TextOverlay, ribbon: Point[], metrics?: LayerTextMetrics): Point[] {
  if (!ribbon.length) return ribbon;
  const mx = (metrics?.width ?? 100) / 100, my = (metrics?.height ?? 100) / 100;
  const physical = (p: Point) => ({ x: p.x * mx, y: p.y * my });
  const logical = (p: Point) => ({ x: p.x / mx, y: p.y / my });
  const count = (ribbon.length - 2) / 2;
  const left = ribbon.slice(1,count+1).map(physical), right = ribbon.slice(count+2).reverse().map(physical);
  const unit = (p: Point) => { const length = Math.max(1e-8,Math.hypot(p.x,p.y)); return { x:p.x/length,y:p.y/length }; };
  const opening = (o: TextOverlay, l: Point, r: Point) => {
    const outline = bodyOutline(o).map(physical), lengths = [0];
    for (let i=0;i<outline.length;i++) lengths.push(lengths[i]+Math.hypot(outline[(i+1)%outline.length].x-outline[i].x,outline[(i+1)%outline.length].y-outline[i].y));
    const perimeter = lengths[lengths.length-1], anchor = mix(l,r,.5);
    let at = 0, nearest = Infinity;
    for (let i=0;i<outline.length;i++) {
      const edge = sub(outline[(i+1)%outline.length],outline[i]), offset = sub(anchor,outline[i]);
      const square = edge.x**2+edge.y**2;
      const t = square<1e-16?0:clamp((offset.x*edge.x+offset.y*edge.y)/square,0,1), p=mix(outline[i],outline[(i+1)%outline.length],t);
      const distance = Math.hypot(p.x-anchor.x,p.y-anchor.y);
      if(distance<nearest){nearest=distance;at=lengths[i]+t*Math.sqrt(square);}
    }
    const pointAt = (distance: number): Point => {
      const s = ((distance%perimeter)+perimeter)%perimeter;
      let i=0;while(i<outline.length-1&&lengths[i+1]<s)i++;
      return mix(outline[i],outline[(i+1)%outline.length],(s-lengths[i])/Math.max(1e-8,lengths[i+1]-lengths[i]));
    };
    const half = Math.min(Math.hypot(l.x-r.x,l.y-r.y)/2,perimeter*.2);
    const roots = [-1,1].map(direction=>{
      const s=at+direction*half, point=pointAt(s), delta=Math.max(1e-5,Math.min(half*.02,perimeter/1000));
      const tangent=unit(sub(pointAt(s+delta),pointAt(s-delta)));
      return {point,toward:{x:-direction*tangent.x,y:-direction*tangent.y}};
    });
    const normal=sub(l,r);
    if ((roots[0].point.x-roots[1].point.x)*normal.x+(roots[0].point.y-roots[1].point.y)*normal.y<0) roots.reverse();
    return roots;
  };
  const start=opening(a,left[0],right[0]),end=opening(b,left[count-1],right[count-1]);
  const joinSteps=8;
  const cubic=(p0:Point,p1:Point,p2:Point,p3:Point,t:number)=>{
    const u=1-t;return {x:u**3*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t**3*p3.x,y:u**3*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t**3*p3.y};
  };
  const join = (side: Point[], from: typeof start[number], to: typeof end[number]) => {
    const result:Point[]=[],last=count-1;
    const firstTangent=unit(sub(side[joinSteps+1],side[joinSteps-1])),lastTangent=unit(sub(side[last-joinSteps+1],side[last-joinSteps-1]));
    const startCurveSpan=Math.hypot(side[joinSteps].x-from.point.x,side[joinSteps].y-from.point.y)*.35;
    const endCurveSpan=Math.hypot(side[last-joinSteps].x-to.point.x,side[last-joinSteps].y-to.point.y)*.35;
    // Keep the rim handles within the opening, while giving the curve-side
    // handles enough length for a smooth transition into the main strip.
    const startSpan=Math.min(startCurveSpan,Math.hypot(start[0].point.x-start[1].point.x,start[0].point.y-start[1].point.y)*.25);
    const endSpan=Math.min(endCurveSpan,Math.hypot(end[0].point.x-end[1].point.x,end[0].point.y-end[1].point.y)*.25);
    const steps=24;
    for(let i=0;i<=steps;i++)result.push(cubic(from.point,{x:from.point.x+from.toward.x*startSpan,y:from.point.y+from.toward.y*startSpan},{x:side[joinSteps].x-firstTangent.x*startCurveSpan,y:side[joinSteps].y-firstTangent.y*startCurveSpan},side[joinSteps],i/steps));
    result.push(...side.slice(joinSteps+1,last-joinSteps));
    for(let i=0;i<=steps;i++)result.push(cubic(side[last-joinSteps],{x:side[last-joinSteps].x+lastTangent.x*endCurveSpan,y:side[last-joinSteps].y+lastTangent.y*endCurveSpan},{x:to.point.x+to.toward.x*endSpan,y:to.point.y+to.toward.y*endSpan},to.point,i/steps));
    return result.map(logical);
  };
  return [center(a),...join(left,start[0],end[0]),center(b),...join(right,start[1],end[1]).reverse()];
}
const geometryCache = new Map<string, ReturnType<typeof computeConnectedBubbleGeometry>>();
export function connectedBubbleGeometry(group: TextOverlay[], metrics?: LayerTextMetrics) {
  // Paint and text cannot change the contour. Bound the cache so old geometry
  // from dragging/resizing does not accumulate indefinitely.
  const key = JSON.stringify([metrics?.width ?? 100, metrics?.height ?? 100, group.map(o => [o.id,o.type,o.x,o.y,o.width,o.height,o.rotation,o.bubbleStyle,o.roundness,o.tailEnabled,o.tailX,o.tailY,o.tailStartAngle,o.tailCurve,o.tailRootWidth,o.thoughtTailWidth,o.thoughtTailCurve,o.bubbleLinks])]);
  const cached = geometryCache.get(key);
  if (cached) { geometryCache.delete(key); geometryCache.set(key,cached); return cached; }
  const geometry = computeConnectedBubbleGeometry(group,metrics);
  geometryCache.set(key,geometry);
  if (geometryCache.size > 32) geometryCache.delete(geometryCache.keys().next().value!);
  return geometry;
}
function computeConnectedBubbleGeometry(group: TextOverlay[], metrics?: LayerTextMetrics) {
  const polygons: Point[][] = [];
  for (const o of group) {
    const connectedTail=bubbleTailIsConnection(o,group);
    const cloud=o.type==="thought"?thoughtCloudGeometry(o.width,o.height):undefined;
    const paths=cloud?[cloud.path,...(connectedTail?[]:thoughtTrailGeometry(o,cloud.outline)).map(c=>`M ${c.x+c.r} ${c.y} A ${c.r} ${c.r} 0 1 1 ${c.x-c.r} ${c.y} A ${c.r} ${c.r} 0 1 1 ${c.x+c.r} ${c.y} Z`)]:[o.bubbleStyle==="shout"?shoutPath(o):speechPath(connectedTail?{...o,tailEnabled:false}:o,o.bubbleStyle??"organic")];
    const a=o.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    for (const d of paths) for (const poly of flatten(d)) polygons.push(poly.map(p=>({x:o.x+o.width/2+(p.x-o.width/2)*c-(p.y-o.height/2)*s,y:o.y+o.height/2+(p.x-o.width/2)*s+(p.y-o.height/2)*c})));
  }
  const mx=(metrics?.width??100)/100,my=(metrics?.height??100)/100;
  for (const o of group) for (const link of o.bubbleLinks??[]) {
    const b=group.find(b=>b.id===link.targetId);if(!b||b.id===o.id)continue;
    const startWidth = link.startWidth ?? link.width, endWidth = link.endWidth ?? link.width;
    if (link.startAngle !== undefined || link.endAngle !== undefined || link.startControl || link.endControl || startWidth !== endWidth) {
      const rawRibbon = bubbleConnectionRibbon(o,b,link,metrics);
      // Smooth speech rims use tangent joins; scalloped thought clouds retain
      // their existing cloud attachment geometry.
      const ribbon = o.type === "speech" ? joinRibbonToBubbles(o,b,rawRibbon,metrics) : rawRibbon;
      if (ribbon.length) {
        // Union caps separately: an attachment on a bubble's far side may
        // cross the ribbon, so one self-intersecting input polygon is unsafe.
        const count = (ribbon.length - 2) / 2;
        const left = ribbon.slice(1, count + 1), right = ribbon.slice(count + 2);
        if(o.type === "speech") {
          for(let i=0;i<count-1;i++){
            // Convex pieces handle root curves crossing behind a rotated body.
            const near=right[count-1-i],far=right[count-2-i];
            polygons.push([left[i],left[i+1],far],[left[i],far,near]);
          }
        } else polygons.push([...left,...right]);
        polygons.push([ribbon[0],left[0],right[count-1]],[ribbon[count+1],left[count-1],right[0]]);
      }
      continue;
    }
    const a={x:o.x+o.width/2,y:o.y+o.height/2},end={x:b.x+b.width/2,y:b.y+b.height/2};
    const dx=(end.x-a.x)*mx,dy=(end.y-a.y)*my,len=Math.hypot(dx,dy);if(len<1e-7)continue;
    const half=Math.min(o.width*mx,o.height*my,b.width*mx,b.height*my)*Math.max(2,Math.min(80,startWidth))/200;
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
  const unused=new Set(boundary.map((_,i)=>i)),outlines:Point[][]=[],slivers=new Set<number>();
  while(unused.size){
    const first=unused.values().next().value!,loop=[boundary[first][0]];
    let edge=first;
    while(unused.has(edge)){
      unused.delete(edge);const end=boundary[edge][1];
      if(samePoint(end,loop[0]))break;
      loop.push(end);
      const next=[...unused].find(i=>samePoint(boundary[i][0],end));
      if(next===undefined){
        // Overlapping triangulated joins can leave a tiny isolated line with
        // zero fill area. It is not a contour and must not crash the editor.
        if(loop.length===2&&Math.hypot(loop[0].x-end.x,loop[0].y-end.y)<.02){slivers.add(first);loop.length=0;break;}
        throw new Error("Disconnected bubble contour");
      }
      edge=next;
    }
    if(loop.length>=3)outlines.push(loop);
  }
  const fillPath=outlines.map(p=>`M ${p.map(xy).join(' L ')} Z`).join(' ');
  return {polygons:outlines,boundary:boundary.filter((_,i)=>!slivers.has(i)),fillPath,strokePath:fillPath};
}

