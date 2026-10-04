import type { TextOverlay } from "./project";
type Point = { x: number; y: number };
export function thoughtTailEndpoint(o: TextOverlay) {
  return {
    x: o.tailX ?? o.x + o.width * 0.75,
    y: o.tailY ?? o.y + o.height * 1.55,
  };
}
export function thoughtCloudGeometry(width: number, height: number) {
  const w = Math.max(0.1, width),
    h = Math.max(0.1, height),
    rx = w / 2,
    ry = h / 2;
  const perimeter =
    Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const count = Math.max(6, Math.min(48, Math.round(perimeter / 9)));
  const points = Array.from({ length: count }, (_, i) => {
    const a = ((i + 0.16 * Math.sin(i * 98.765)) * Math.PI * 2) / count;
    return { x: rx * Math.cos(a), y: ry * Math.sin(a) };
  });
  const outline: Point[] = [],
    arcs: { end: Point; radius: number }[] = [];
  for (let i = 0; i < count; i++) {
    const p = points[i],
      q = points[(i + 1) % count],
      dx = q.x - p.x,
      dy = q.y - p.y,
      d = Math.hypot(dx, dy),
      r = d * 0.65;
    const offset = Math.sqrt(Math.max(0, r * r - (d * d) / 4));
    const center = {
      x: (p.x + q.x) / 2 - (dy / d) * offset,
      y: (p.y + q.y) / 2 + (dx / d) * offset,
    };
    const a = Math.atan2(p.y - center.y, p.x - center.x),
      sweep = 2 * Math.asin(d / (2 * r));
    for (let j = 0; j < 17; j++) {
      const angle = a + (sweep * j) / 16;
      outline.push({
        x: center.x + r * Math.cos(angle),
        y: center.y + r * Math.sin(angle),
      });
    }
    arcs.push({ end: q, radius: r });
  }
  const minX = Math.min(...outline.map((p) => p.x)),
    maxX = Math.max(...outline.map((p) => p.x)),
    minY = Math.min(...outline.map((p) => p.y)),
    maxY = Math.max(...outline.map((p) => p.y));
  // Fit the complete arcs, not just the underlying ellipse, into the editable frame.
  const scale = Math.min(
      (w * 0.94) / (maxX - minX),
      (h * 0.94) / (maxY - minY),
    ),
    cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  const fit = (p: Point) => ({
    x: w / 2 + (p.x - cx) * scale,
    y: h / 2 + (p.y - cy) * scale,
  });
  const first = fit(points[0]);
  const path =
    `M ${first.x} ${first.y} ` +
    arcs
      .map((arc) => {
        const p = fit(arc.end),
          r = arc.radius * scale;
        return `A ${r} ${r} 0 0 1 ${p.x} ${p.y}`;
      })
      .join(" ") +
    " Z";
  return { path, outline: outline.map(fit), count };
}
export function thoughtTrailGeometry(o: TextOverlay, outline: Point[]) {
  const end = thoughtTailEndpoint(o),
    target = { x: end.x - o.x, y: end.y - o.y },
    center = { x: o.width / 2, y: o.height / 2 };
  const dx = target.x - center.x,
    dy = target.y - center.y,
    length = Math.hypot(dx, dy);
  if (length < 0.001) return [];
  const direction = { x: dx / length, y: dy / length };
  let boundary = 0;
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i],
      q = outline[(i + 1) % outline.length],
      sx = q.x - p.x,
      sy = q.y - p.y,
      px = p.x - center.x,
      py = p.y - center.y;
    const cross = direction.x * sy - direction.y * sx;
    if (Math.abs(cross) < 1e-9) continue;
    const distance = (px * sy - py * sx) / cross,
      t = (px * direction.y - py * direction.x) / cross;
    if (distance > 0 && t >= 0 && t <= 1)
      boundary = Math.max(boundary, distance);
  }
  const distance = length - boundary;
  if (distance < 1) return [];
  const count = Math.min(24, Math.max(1, Math.floor(distance / 5))),
    start = {
      x: center.x + direction.x * boundary,
      y: center.y + direction.y * boundary,
    };
  const control = {
    x: (start.x + target.x) / 2 - direction.y * distance * 0.15,
    y: (start.y + target.y) / 2 + direction.x * distance * 0.15,
  };
  const largest = Math.min(
      Math.min(o.width, o.height) * 0.125,
      (distance / count) * 0.38,
    ),
    smallest = Math.min(0.65, largest * 0.45);
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / count;
    return {
      x:
        (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t * t * target.x,
      y:
        (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t * t * target.y,
      r: largest * (1 - t) + smallest * t,
    };
  });
}
