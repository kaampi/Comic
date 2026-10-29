// IDML stores cubic handles. Convert the absolute SVG commands used by our artwork.
export type Point = { x: number; y: number };
export type PathPoint = { anchor: Point; left: Point; right: Point };
export type GeometryPath = { points: PathPoint[]; open: boolean };
const point = (x: number, y: number): Point => ({ x, y });
const node = (p: Point): PathPoint => ({ anchor: p, left: p, right: p });
export function polygonPath(points: Point[], open = false): GeometryPath {
  return { points: points.map(node), open };
}
export function rectanglePath(x: number, y: number, width: number, height: number) {
  return polygonPath([point(x,y),point(x+width,y),point(x+width,y+height),point(x,y+height)]);
}
export function svgGeometry(d: string): GeometryPath[] {
  const tokens = d.match(/[MLQCAZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) ?? [];
  const paths: GeometryPath[] = []; let path: GeometryPath | undefined, i = 0;
  const number = () => { const n=Number(tokens[i++]); if(!Number.isFinite(n))throw new Error('invalid-artwork'); return n; };
  const read = () => point(number(), number());
  const last = () => { if(!path?.points.length)throw new Error('invalid-artwork');return path.points[path.points.length-1]; };
  const cubic = (a: Point,b: Point,end: Point) => {last().right=a;const n=node(end);n.left=b;path!.points.push(n);};
  while(i<tokens.length) {
    const command=tokens[i++];
    if(command==='M') {path={points:[node(read())],open:true};paths.push(path);}
    else if(command==='L') path!.points.push(node(read()));
    else if(command==='C') cubic(read(),read(),read());
    else if(command==='Q') {
      const start=last().anchor, control=read(), end=read();
      cubic(point(start.x+(control.x-start.x)*2/3,start.y+(control.y-start.y)*2/3),point(end.x+(control.x-end.x)*2/3,end.y+(control.y-end.y)*2/3),end);
    } else if(command==='A') {
      let rx=number(),ry=number();const rotation=number(),large=number(),sweep=number(),end=read(),start=last().anchor;
      // All arcs currently authored by kaampi Comic are circles without axis rotation.
      if(Math.abs(rx-ry)>1e-6||rotation!==0||rx<=0)throw new Error('unsupported-artwork-arc');
      const dx=end.x-start.x,dy=end.y-start.y,len=Math.hypot(dx,dy);
      if(len<1e-9)continue;
      rx=ry=Math.max(rx,len/2);const offset=Math.sqrt(Math.max(0,rx*rx-len*len/4))*(large===sweep?-1:1);
      const cx=(start.x+end.x)/2-dy/len*offset,cy=(start.y+end.y)/2+dx/len*offset;
      const angle=Math.atan2(start.y-cy,start.x-cx);let delta=Math.atan2(end.y-cy,end.x-cx)-angle;
      if(sweep&&delta<0)delta+=Math.PI*2;if(!sweep&&delta>0)delta-=Math.PI*2;
      const count=Math.ceil(Math.abs(delta)/(Math.PI/2));
      for(let j=0;j<count;j++) {
        const a=angle+delta*j/count,b=angle+delta*(j+1)/count,k=4/3*Math.tan((b-a)/4);
        cubic(point(cx+rx*(Math.cos(a)-k*Math.sin(a)),cy+ry*(Math.sin(a)+k*Math.cos(a))),point(cx+rx*(Math.cos(b)+k*Math.sin(b)),cy+ry*(Math.sin(b)-k*Math.cos(b))),j===count-1?end:point(cx+rx*Math.cos(b),cy+ry*Math.sin(b)));
      }
    } else if(command==='Z') {
      path!.open=false;const first=path!.points[0],end=last();
      if(Math.hypot(first.anchor.x-end.anchor.x,first.anchor.y-end.anchor.y)<1e-6&&path!.points.length>1){first.left=end.left;path!.points.pop();}
    } else throw new Error('unsupported-artwork-command');
  }
  return paths;
}
export function transformPaths(paths: GeometryPath[], transform: (p: Point)=>Point): GeometryPath[] {
  return paths.map(path=>({...path,points:path.points.map(p=>({anchor:transform(p.anchor),left:transform(p.left),right:transform(p.right)}))}));
}
