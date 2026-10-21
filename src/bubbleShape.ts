import type { TextOverlay } from "./project";
import { validPanelShape, segmentsMeet, type ShapePoint } from "./panelShape";
import { thoughtCloudGeometry } from "./thoughtBubble";
export type BubblePoint = ShapePoint;
const xy=(p:BubblePoint)=>`${p.x} ${p.y}`;
export function bubbleNodes(o:TextOverlay):BubblePoint[] {
  if(validPanelShape(o.bubbleShapePoints))return o.bubbleShapePoints!;
  if(o.type==="thought") {
    const outline=thoughtCloudGeometry(o.width,o.height).outline;
    const count=Math.min(48,outline.length);
    const points=Array.from({length:count},(_,i)=>{const p=outline[Math.floor(i*outline.length/count)];return {x:p.x/o.width*4,y:p.y/o.height*4};});
    if(validPanelShape(points))return points;
  }
  const style=o.bubbleStyle??"organic",rx=style==="wide"?1.96:style==="tall"?1.72:1.92,ry=style==="wide"?1.48:style==="tall"?1.92:1.72;
  if(o.type==="caption"&&(o.roundness??18)<=0)return [{x:.08,y:.28},{x:3.92,y:.28},{x:3.92,y:3.72},{x:.08,y:3.72}];
  const shout=o.type==="speech"&&style==="shout",count=shout?18:16;
  const exponent=2+(1-Math.max(0,Math.min(100,o.roundness??60))/100)*18;
  return Array.from({length:count},(_,i)=>{const a=i*Math.PI*2/count,ca=Math.cos(a),sa=Math.sin(a),r=shout?(i%2?.72:1):1;return {x:2+rx*(shout?ca:Math.sign(ca)*Math.abs(ca)**(2/exponent))*r,y:2+ry*(shout?sa:Math.sign(sa)*Math.abs(sa)**(2/exponent))*r};});
}
function segments(points:BubblePoint[],smooth:boolean) {
  return points.map((a,i)=>{
    const b=points[(i+1)%points.length],prev=points[(i+points.length-1)%points.length],after=points[(i+2)%points.length];
    const handle=(p:BubblePoint,dx:number,dy:number,length:number)=>{const scale=Math.min(length/4,Math.hypot(dx,dy)/6)/Math.max(1e-10,Math.hypot(dx,dy));return {x:p.x+dx*scale,y:p.y+dy*scale};};
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    return {a,b,c1:smooth?handle(a,b.x-prev.x,b.y-prev.y,length):a,c2:smooth?handle(b,a.x-after.x,a.y-after.y,length):b};
  });
}
export function bubbleShapeOutline(points:BubblePoint[],smooth=true):BubblePoint[] {
  return segments(points,smooth).flatMap(({a,b,c1,c2})=>Array.from({length:smooth?8:1},(_,i)=>{const t=i/8,u=1-t;return smooth?{x:u**3*a.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t**3*b.x,y:u**3*a.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t**3*b.y}:a;}));
}
export function validBubbleShape(points:unknown,smooth=true):points is BubblePoint[] {
  if(!validPanelShape(points))return false;
  if(!smooth)return true;
  const outline=bubbleShapeOutline(points,true),n=outline.length;
  for(let i=0;i<n;i++)for(let j=i+2;j<n;j++) {
    if(i===0&&j===n-1)continue;
    if(segmentsMeet(outline[i],outline[(i+1)%n],outline[j],outline[(j+1)%n]))return false;
  }
  return true;
}
export function customBubbleOutline(o:TextOverlay) {
  return bubbleShapeOutline(bubbleNodes(o),o.bubbleShapeSmooth!==false).map(p=>({x:p.x*o.width/4,y:p.y*o.height/4}));
}
export function customBubbleBodyPath(o:TextOverlay) {
  const points=bubbleNodes(o),physical=(p:BubblePoint)=>xy({x:p.x*o.width/4,y:p.y*o.height/4});
  return `M ${physical(points[0])} `+segments(points,o.bubbleShapeSmooth!==false).map(({b,c1,c2})=>o.bubbleShapeSmooth===false?`L ${physical(b)}`:`C ${physical(c1)} ${physical(c2)} ${physical(b)}`).join(" ")+" Z";
}
// The attachment is the closest rim point in the requested direction. It
// remains usable even when an inward notch encloses the nominal centre.
export function customBubbleAttachment(o:TextOverlay) {
  const outline=customBubbleOutline(o),cx=o.width/2,cy=o.height/2;
  const angle=o.tailStartAngle??Math.atan2((o.tailY??o.y+o.height*1.12)-o.y-cy,(o.tailX??o.x+o.width*.58)-o.x-cx);
  const ray={x:Math.cos(angle),y:Math.sin(angle)};
  let best=0,score=Infinity;
  outline.forEach((p,i)=>{const a=Math.atan2(p.y-cy,p.x-cx),d=Math.abs(Math.atan2(Math.sin(a-angle),Math.cos(a-angle)));if(d<score){score=d;best=i;}});
  // Intersect actual rim segments so the root moves continuously between nodes.
  let closest=Infinity,point=outline[best],at=best;
  outline.forEach((a,i)=>{const b=outline[(i+1)%outline.length],dx=b.x-a.x,dy=b.y-a.y,den=ray.x*dy-ray.y*dx;if(Math.abs(den)<1e-9)return;const ax=a.x-cx,ay=a.y-cy,t=(ax*dy-ay*dx)/den,u=(ax*ray.y-ay*ray.x)/den;if(t>=0&&u>=0&&u<=1&&t<closest){closest=t;point={x:cx+ray.x*t,y:cy+ray.y*t};at=i+u;}});
  return {point,at:at%outline.length,outline};
}
export function customBubblePath(o:TextOverlay) {
  if(o.type!=="speech"||o.tailEnabled===false)return customBubbleBodyPath(o);
  const {at,outline}=customBubbleAttachment(o),lengths=[0];
  for(let i=0;i<outline.length;i++)lengths.push(lengths[i]+Math.hypot(outline[(i+1)%outline.length].x-outline[i].x,outline[(i+1)%outline.length].y-outline[i].y));
  const total=lengths[lengths.length-1],i=Math.floor(at),centre=lengths[i]+(at-i)*(lengths[i+1]-lengths[i]);
  const half=Math.min(total*.12,Math.min(o.width,o.height)*(.04+(o.tailRootWidth??50)/100*.11));
  const sample=(s:number)=>{s=(s%total+total)%total;let j=0;while(j<outline.length-1&&lengths[j+1]<s)j++;const t=(s-lengths[j])/Math.max(1e-8,lengths[j+1]-lengths[j]),a=outline[j],b=outline[(j+1)%outline.length];return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};};
  const r1=sample(centre-half),r2=sample(centre+half),tip={x:(o.tailX??o.x+o.width*.58)-o.x,y:(o.tailY??o.y+o.height*1.12)-o.y};
  const dx=tip.x-o.width/2,dy=tip.y-o.height/2,len=Math.max(1,Math.hypot(dx,dy)),bend=(o.tailCurve??0)/100*Math.min(o.width,o.height)*.42;
  const control=(p:BubblePoint)=>({x:p.x+(tip.x-p.x)*.34-dy/len*bend,y:p.y+(tip.y-p.y)*.34+dx/len*bend});
  let d=`M ${xy(r1)} Q ${xy(control(r1))} ${xy(tip)} Q ${xy(control(r2))} ${xy(r2)}`;
  for(let k=1;k<=outline.length;k++)d+=` L ${xy(sample(centre+half+(total-2*half)*k/outline.length))}`;
  return d+" Z";
}
