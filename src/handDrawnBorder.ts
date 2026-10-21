import type { ShapePoint } from "./panelShape";

// A filled ink ribbon, shared by the preview and every export. Noise depends
// only on the stable panel ID, never on render order or the current time.
export function handDrawnBorderPath(points: ShapePoint[], width: number, strength: number, id: string, hidden: number[] = []): string {
  if (width <= 0 || points.length < 3) return "";
  const amount = Math.max(0, Math.min(100, strength)) / 100;
  let seed = 2166136261;
  for (const char of id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const noise = (index: number) => {
    let n = Math.imul(seed ^ index, 0x45d9f3b);
    n = Math.imul(n ^ n >>> 16, 0x45d9f3b);
    return ((n ^ n >>> 16) >>> 0) / 4294967295 * 2 - 1;
  };
  const number = (n: number) => Number(n.toFixed(6));
  const pair = (p: ShapePoint) => `${number(p.x)} ${number(p.y)}`;
  const paths: string[] = [];
  points.forEach((a, edge) => {
    if(hidden.includes(edge))return;
    const b = points[(edge + 1) % points.length], dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    if (length < 1e-7) return;
    const nx = dy / length, ny = -dx / length, count = Math.max(2, Math.ceil((length - 1e-6) / 18));
    const samples = Array.from({length: count + 1}, (_, i) => {
      const end = i === 0 || i === count;
      const center = end ? 0 : width * .14 * amount * noise(edge * 100003 + i * 2);
      const half = width / 2 * (end ? 1 - .3 * amount : 1 - .45 * amount + .15 * amount * noise(edge * 100003 + i * 2 + 1));
      return {t: i / count, outer: center + half, inner: center - half};
    });
    const point = (t: number, offset: number) => ({x: a.x + dx * t + nx * offset, y: a.y + dy * t + ny * offset});
    const rail = (values: typeof samples, side: "outer" | "inner") => values.slice(1).map((s, i) => {
      const previous = values[i], dt = (s.t - previous.t) / 3;
      return `C ${pair(point(previous.t + dt, previous[side]))} ${pair(point(s.t - dt, s[side]))} ${pair(point(s.t, s[side]))}`;
    }).join(" ");
    paths.push(`M ${pair(point(0, samples[0].outer))} ${rail(samples, "outer")} L ${pair(point(1, samples[count].inner))} ${rail([...samples].reverse(), "inner")} Z`);
    // Round joins stay within the original stroke envelope. The image clip,
    // layout, hit targets and neighbor-fit spacing remain unchanged.
    const r = width / 2 * (1 - .3 * amount), k = r * .5522847498;
    paths.push(`M ${pair({x:a.x+r,y:a.y})} C ${pair({x:a.x+r,y:a.y+k})} ${pair({x:a.x+k,y:a.y+r})} ${pair({x:a.x,y:a.y+r})} C ${pair({x:a.x-k,y:a.y+r})} ${pair({x:a.x-r,y:a.y+k})} ${pair({x:a.x-r,y:a.y})} C ${pair({x:a.x-r,y:a.y-k})} ${pair({x:a.x-k,y:a.y-r})} ${pair({x:a.x,y:a.y-r})} C ${pair({x:a.x+k,y:a.y-r})} ${pair({x:a.x+r,y:a.y-k})} ${pair({x:a.x+r,y:a.y})} Z`);
  });
  return paths.join(" ");
}
