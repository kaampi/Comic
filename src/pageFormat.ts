export type PageSpacing = { topMm: number; rightMm: number; bottomMm: number; leftMm: number; columnGapMm: number; rowGapMm: number };
export type PageGrid = { gridColumns: number; gridRows: number };
export type PageFormat = { spacing?: PageSpacing; preset: "a4" | "letter" | "custom"; orientation: "portrait" | "landscape"; widthMm: number; heightMm: number };
export const DEFAULT_PAGE_FORMAT: PageFormat = { preset: "a4", orientation: "portrait", widthMm: 210, heightMm: 297 };
// Keep the old 3:5 canvas intact until an existing album's format is changed.
export const LEGACY_PAGE_FORMAT: PageFormat = { preset: "custom", orientation: "portrait", widthMm: 180, heightMm: 300 };
export function validPageFormat(value: unknown): value is PageFormat {
  const f = value as PageFormat | null;
  return !!f && ["a4", "letter", "custom"].includes(f.preset) && ["portrait", "landscape"].includes(f.orientation) && [f.widthMm, f.heightMm].every(n => typeof n === "number" && Number.isFinite(n) && n >= 20 && n <= 1000) && (f.spacing === undefined || validPageSpacing(f.spacing));
}
export function albumPageFormat(project: { pageFormat?: PageFormat; pageDefaults?: PageGrid; pages?: PageGrid[] }): PageFormat {
  let format = validPageFormat(project.pageFormat) ? project.pageFormat! : LEGACY_PAGE_FORMAT;
  if (project.pageFormat) {
    const { spacing, ...size } = project.pageFormat;
    if (!validPageFormat(project.pageFormat) && validPageFormat(size)) format = size;
  }
  // Recover a corrupt local spacing value without changing page size or authored content.
  if (format.spacing && !spacingFitsAlbum(format, [...(project.pages ?? []), ...(project.pageDefaults ? [project.pageDefaults] : [])])) {
    const { spacing, ...size } = format; return size;
  }
  return format;
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
export function validPageSpacing(value: unknown): value is PageSpacing {
  const s = value as PageSpacing | null;
  return !!s && [s.topMm, s.rightMm, s.bottomMm, s.leftMm, s.columnGapMm, s.rowGapMm].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1000);
}
export function pageSpacing(format: PageFormat): PageSpacing {
  if (validPageSpacing(format.spacing)) return { ...format.spacing };
  // Missing settings retain the old 10px margins and 6px gutters at the 700px canvas.
  const mmPerPixel = pageDimensions(format).widthMm / PAGE_RENDER_WIDTH;
  return { topMm: PAGE_INSET * mmPerPixel, rightMm: PAGE_INSET * mmPerPixel, bottomMm: PAGE_INSET * mmPerPixel, leftMm: PAGE_INSET * mmPerPixel, columnGapMm: PAGE_GAP * mmPerPixel, rowGapMm: PAGE_GAP * mmPerPixel };
}
export function pageGridMetrics(page: PageGrid, format: PageFormat) {
  const spacing = pageSpacing(format), scale = PAGE_RENDER_WIDTH / pageDimensions(format).widthMm, explicit = validPageSpacing(format.spacing);
  const top = explicit ? spacing.topMm * scale : PAGE_INSET, right = explicit ? spacing.rightMm * scale : PAGE_INSET;
  const bottom = explicit ? spacing.bottomMm * scale : PAGE_INSET, left = explicit ? spacing.leftMm * scale : PAGE_INSET;
  const gapX = explicit ? spacing.columnGapMm * scale : PAGE_GAP, gapY = explicit ? spacing.rowGapMm * scale : PAGE_GAP;
  const width = PAGE_RENDER_WIDTH - left - right, height = PAGE_RENDER_WIDTH / pageAspect(format) - top - bottom;
  return { top, right, bottom, left, gapX, gapY, width, height, cellWidth: (width - (page.gridColumns - 1) * gapX) / page.gridColumns, cellHeight: (height - (page.gridRows - 1) * gapY) / page.gridRows };
}
export function spacingFitsAlbum(format: PageFormat, grids: PageGrid[]): boolean {
  if (!validPageFormat(format)) return false;
  return (grids.length ? grids : [{ gridColumns: 1, gridRows: 1 }]).every(grid => {
    if (![grid.gridColumns, grid.gridRows].every(n => Number.isInteger(n) && n > 0)) return false;
    const m = pageGridMetrics(grid, format);
    return m.cellWidth >= 2 * PANEL_BORDER + 1 && m.cellHeight >= 2 * PANEL_BORDER + 1;
  });
}
// cqw is a percentage of the complete page width, for both axes; matches export at every preview size.
export function pageGridStyle(format: PageFormat) {
  const m = pageGridMetrics({ gridColumns: 1, gridRows: 1 }, format), unit = (n: number) => `${n / PAGE_RENDER_WIDTH * 100}cqw`;
  return { "--page-grid-top": unit(m.top), "--page-grid-right": unit(m.right), "--page-grid-bottom": unit(m.bottom), "--page-grid-left": unit(m.left), "--page-grid-column-gap": unit(m.gapX), "--page-grid-row-gap": unit(m.gapY) };
}
export function layerRect(page: PageGrid, layer: { x: number; y: number; width: number; height: number }, format: PageFormat) {
  const m = pageGridMetrics(page, format);
  return { x: m.left + layer.x * (m.cellWidth + m.gapX), y: m.top + layer.y * (m.cellHeight + m.gapY), width: layer.width * m.cellWidth + (layer.width - 1) * m.gapX, height: layer.height * m.cellHeight + (layer.height - 1) * m.gapY };
}
