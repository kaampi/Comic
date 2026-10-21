import type { TextOverlay } from "./project";
import { validPanelShape, segmentsMeet, type ShapePoint } from "./panelShape";
import { thoughtCloudGeometry } from "./thoughtBubble";
export type BubblePoint = ShapePoint & {smooth?:boolean;handleIn?:ShapePoint;handleOut?:ShapePoint};
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
// Handle vectors are relative to the anchor, in the same normalized coordinates.
// Missing vectors retain the legacy automatic tangent and segment-specific length.
export function bubbleNodeHandles(points:BubblePoint[],index:number) {
  const p=points[index],prev=points[(index+points.length-1)%points.length],next=points[(index+1)%points.length];
  const dx=next.x-prev.x,dy=next.y-prev.y,length=Math.hypot(dx,dy);
  const automatic=(neighbor:BubblePoint,sign:number)=>{const size=Math.min(Math.hypot(neighbor.x-p.x,neighbor.y-p.y)/4,length/6)/Math.max(1e-10,length);return {x:dx*size*sign,y:dy*size*sign};};
  return {handleIn:p.handleIn??automatic(prev,-1),handleOut:p.handleOut??automatic(next,1)};
}
export function bubbleSegments(points:BubblePoint[],smooth:boolean) {
  return points.map((a,i)=>{
    const j=(i+1)%points.length,b=points[j],aSmooth=a.smooth??smooth,bSmooth=b.smooth??smooth;
    const out=bubbleNodeHandles(points,i).handleOut,inside=bubbleNodeHandles(points,j).handleIn;
    return {a,b,curved:aSmooth||bSmooth,c1:aSmooth?{x:a.x+out.x,y:a.y+out.y}:a,c2:bSmooth?{x:b.x+inside.x,y:b.y+inside.y}:b};
  });
}
export function bubbleShapeOutline(points:BubblePoint[],smooth=true):BubblePoint[] {
  return bubbleSegments(points,smooth).flatMap(({a,b,c1,c2,curved},i)=>{
    const count=points[i].handleOut||points[(i+1)%points.length].handleIn?32:8;
    return Array.from({length:curved?count:1},(_,i)=>{const t=i/count,u=1-t;return curved?{x:u**3*a.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t**3*b.x,y:u**3*a.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t**3*b.y}:a;});
  });
}
export function moveBubbleHandle(o:TextOverlay,index:number,side:'handleIn'|'handleOut',point:ShapePoint) {
  const points=bubbleNodes(o),p=points[index];if(!p||!(p.smooth??o.bubbleShapeSmooth!==false)||!Number.isFinite(point.x)||!Number.isFinite(point.y))return null;
  let dx=point.x-p.x,dy=point.y-p.y,length=Math.hypot(dx,dy);
  if(length>4){dx*=4/length;dy*=4/length;length=4;}
  const handles=bubbleNodeHandles(points,index),other=side==='handleIn'?'handleOut':'handleIn',old=handles[other];
  const oppositeLength=Math.hypot(old.x,old.y);
  // Keep the opposite length independent while rotating both handles together.
  const opposite=length>1e-8?{x:-dx/length*oppositeLength,y:-dy/length*oppositeLength}:old;
  const next=points.map((node,i)=>i===index?{...node,[side]:{x:dx,y:dy},[other]:opposite}:node);
  return validBubbleShape(next,o.bubbleShapeSmooth!==false)?next:null;
}
export function validBubbleShape(points:unknown,smooth=true):points is BubblePoint[] {
  if(!validPanelShape(points))return false;
  const nodes=points as BubblePoint[];
  if(!nodes.every(p=>(p.smooth===undefined||typeof p.smooth==="boolean")&&[p.handleIn,p.handleOut].every(h=>h===undefined||!!h&&typeof h==='object'&&Number.isFinite(h.x)&&Number.isFinite(h.y)&&Math.abs(h.x)<=8&&Math.abs(h.y)<=8)))return false;
  if(!nodes.some(p=>p.smooth??smooth))return true;
  const outline=bubbleShapeOutline(points,smooth),n=outline.length;
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
  return `M ${physical(points[0])} `+bubbleSegments(points,o.bubbleShapeSmooth!==false).map(({b,c1,c2,curved})=>!curved?`L ${physical(b)}`:`C ${physical(c1)} ${physical(c2)} ${physical(b)}`).join(" ")+" Z";
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
  // Keep the original rim vertices outside the tail opening. Uniformly
  // resampling the perimeter can skip a sharp anchor and bevel its corner.
  const start=centre+half,remaining=total-2*half;
  const rim=outline.map((point,index)=>({point,distance:((lengths[index]-start)%total+total)%total}))
    .filter(item=>item.distance>1e-8&&item.distance<remaining-1e-8).sort((a,b)=>a.distance-b.distance);
  for(const {point} of rim)d+=` L ${xy(point)}`;
  return d+` L ${xy(r1)} Z`;
}

export function bubbleLocalPoint(o:TextOverlay,point:BubblePoint):BubblePoint {
  const dx=point.x-o.x-o.width/2,dy=point.y-o.y-o.height/2,a=-o.rotation*Math.PI/180;
  return {x:Math.max(0,Math.min(4,(dx*Math.cos(a)-dy*Math.sin(a)+o.width/2)/o.width*4)),y:Math.max(0,Math.min(4,(dx*Math.sin(a)+dy*Math.cos(a)+o.height/2)/o.height*4))};
}
export function insertBubbleNode(o:TextOverlay,point:BubblePoint) {
  const points=bubbleNodes(o);if(points.length>=64)return null;
  let edge=0,best=Infinity;
  points.forEach((a,i)=>{const b=points[(i+1)%points.length],dx=(b.x-a.x)*o.width,dy=(b.y-a.y)*o.height,t=Math.max(0,Math.min(1,((point.x-a.x)*o.width*dx+(point.y-a.y)*o.height*dy)/Math.max(1e-8,dx*dx+dy*dy))),distance=Math.hypot((point.x-a.x-t*(b.x-a.x))*o.width,(point.y-a.y-t*(b.y-a.y))*o.height);if(distance<best){best=distance;edge=i;}});
  const next=[...points.slice(0,edge+1),point,...points.slice(edge+1)];return validBubbleShape(next,o.bubbleShapeSmooth!==false)?{points:next,index:edge+1}:null;
}
export function deleteBubbleNode(o:TextOverlay,index:number){const points=bubbleNodes(o);if(points.length<=3||index<0||index>=points.length)return null;const next=points.filter((_,i)=>i!==index);return validBubbleShape(next,o.bubbleShapeSmooth!==false)?next:null;}
export function setBubbleNodeSmooth(o:TextOverlay,index:number,smooth:boolean){const points=bubbleNodes(o);if(index<0||index>=points.length)return null;const next=points.map((p,i)=>i===index?{...p,smooth}:p);return validBubbleShape(next,o.bubbleShapeSmooth!==false)?next:null;}
