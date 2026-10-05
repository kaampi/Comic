import type { ComicProject, PageLayer, TextOverlay } from "./project";
import { albumPageFormat, layerRect, pageDimensions, pageAspect, PAGE_RENDER_WIDTH, PANEL_BORDER } from "./pageFormat";
import { overlayTextMeasure, wrapOverlayTextToWidth, type MeasureText } from "./overlayTypography";
export type LayerTextMetrics = { width: number; height: number; pageWidthMm: number };
export function pageLayerTextMetrics(project: ComicProject, page: ComicProject["pages"][number], layer: PageLayer): LayerTextMetrics {
  const format = albumPageFormat(project);
  const rect = layer.id === page.background?.id ? {width: PAGE_RENDER_WIDTH, height: PAGE_RENDER_WIDTH / pageAspect(format)} : layerRect(page, layer, format);
  const border = layer.id === page.background?.id ? 0 : 2 * PANEL_BORDER;
  return { width: Math.max(1, rect.width - border), height: Math.max(1, rect.height - border), pageWidthMm: pageDimensions(format).widthMm };
}
export function overlayTextLayout(overlay: TextOverlay, metrics: LayerTextMetrics, measureText?: MeasureText) {
  const width = overlay.width * metrics.width / 100, height = overlay.height * metrics.height / 100;
  const padding = width * Math.max(0, Math.min(25, overlay.textPadding ?? 4)) / 100;
  const fontSize = (overlay.fontSize ?? (overlay.type === "sfx" ? 28 : 8)) * 25.4 / 72 * PAGE_RENDER_WIDTH / metrics.pageWidthMm;
  const textLines = wrapOverlayTextToWidth(overlay.text, Math.max(1, width - 2 * padding), measureText ?? overlayTextMeasure(overlay, fontSize));
  const align = overlay.textAlign ?? "center";
  return { fontSize, textLines, textX: align === "left" ? padding : align === "right" ? width - padding : width / 2, textY: height / 2 - (textLines.length - 1) * fontSize * .575, width, height };
}
// Convert old panel-relative values once. Preserve the authored vertical size,
// IDs, images and geometry; the new text rendering also removes glyph stretching.
export function normalizeProjectTypography(project: ComicProject): ComicProject {
  if (project.typographyVersion === 2) return project;
  const convertSize = (size: number, metrics: LayerTextMetrics) => Math.round(size * .6 * metrics.height / 100 * metrics.pageWidthMm / PAGE_RENDER_WIDTH * 72 / 25.4 * 100) / 100;
  const convertLayer = (page: ComicProject["pages"][number], layer: PageLayer) => {
    const metrics = pageLayerTextMetrics(project, page, layer);
    return { ...layer, overlays: layer.overlays.map(o => ({ ...o, fontSize: convertSize(o.fontSize ?? (o.type === "sfx" ? 20 : 12), metrics) })) };
  };
  const grid = project.pageDefaults ?? {gridColumns:3,gridRows:5};
  const defaultMetrics = pageLayerTextMetrics(project, {id:"defaults", number:1, ...grid, placements:[]}, {id:"defaults-layer",x:0,y:0,width:1,height:1,readingOrder:1,overlays:[]});
  const overlayDefaults = Object.fromEntries(Object.entries(project.overlayDefaults ?? {}).map(([type, defaults]) => [type, {...defaults, ...(defaults.fontSize === undefined ? {} : {fontSize:convertSize(defaults.fontSize,defaultMetrics)})}]));
  return {...project, typographyVersion:2, overlayDefaults, pages:project.pages.map(page => ({...page, background:page.background ? convertLayer(page,page.background) : undefined, placements:page.placements.map(layer => convertLayer(page,layer))}))};
}
