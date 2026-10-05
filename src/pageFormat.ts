export type PageFormat = { preset: "a4" | "letter" | "custom"; orientation: "portrait" | "landscape"; widthMm: number; heightMm: number };
export const DEFAULT_PAGE_FORMAT: PageFormat = { preset: "a4", orientation: "portrait", widthMm: 210, heightMm: 297 };
// Keep the old 3:5 canvas intact until an existing album's format is changed.
export const LEGACY_PAGE_FORMAT: PageFormat = { preset: "custom", orientation: "portrait", widthMm: 180, heightMm: 300 };
export function validPageFormat(value: unknown): value is PageFormat {
  const f = value as PageFormat | null;
  return !!f && ["a4", "letter", "custom"].includes(f.preset) && ["portrait", "landscape"].includes(f.orientation) && [f.widthMm, f.heightMm].every(n => typeof n === "number" && Number.isFinite(n) && n >= 20 && n <= 1000);
}
export function albumPageFormat(project: { pageFormat?: PageFormat }): PageFormat {
  return validPageFormat(project.pageFormat) ? project.pageFormat! : LEGACY_PAGE_FORMAT;
}
export function pageDimensions(format: PageFormat) {
  const [w, h] = format.preset === "a4" ? [210, 297] : format.preset === "letter" ? [215.9, 279.4] : [format.widthMm, format.heightMm];
  return format.orientation === "landscape" ? { widthMm: h, heightMm: w } : { widthMm: w, heightMm: h };
}
export function pageAspect(format: PageFormat) { const d = pageDimensions(format); return d.widthMm / d.heightMm; }
export function rasterDimensions(format: PageFormat, dpi: number) {
  const d = pageDimensions(format);
  if (!validPageFormat(format) || ![72, 150, 300, 600].includes(dpi)) throw new Error("invalid-export-size");
  const width = Math.round(d.widthMm / 25.4 * dpi), height = Math.round(d.heightMm / 25.4 * dpi);
  if (width > 16384 || height > 16384 || width * height > 40_000_000) throw new Error("export-too-large");
  return { width, height };
}
export const PAGE_RENDER_WIDTH = 700, PAGE_INSET = 10, PAGE_GAP = 6, PANEL_BORDER = 3;
export function layerRect(page: { gridColumns: number; gridRows: number }, layer: { x: number; y: number; width: number; height: number }, format: PageFormat) {
  const height = PAGE_RENDER_WIDTH / pageAspect(format);
  const cellW = (PAGE_RENDER_WIDTH - 2 * PAGE_INSET - (page.gridColumns - 1) * PAGE_GAP) / page.gridColumns;
  const cellH = (height - 2 * PAGE_INSET - (page.gridRows - 1) * PAGE_GAP) / page.gridRows;
  return { x: PAGE_INSET + layer.x * (cellW + PAGE_GAP), y: PAGE_INSET + layer.y * (cellH + PAGE_GAP), width: layer.width * cellW + (layer.width - 1) * PAGE_GAP, height: layer.height * cellH + (layer.height - 1) * PAGE_GAP };
}
