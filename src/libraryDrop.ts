import { libraryEntries, assignLibraryPanel } from "./comicPanelLibrary";
import { albumPageFormat, PANEL_BORDER } from "./pageFormat";
import { panelsOverlap } from "./panelGeometry";
import { overlapsBackgroundText } from "./pageBackground";
import { panelShapePoints, shapedPanel } from "./panelShape";
import type { ComicProject, PageLayer } from "./project";

export const LIBRARY_DRAG_TYPE = "application/x-comicbook-panel";
export type LibraryDropTarget = { kind: "frame"; placementId: string } | { kind: "new"; x: number; y: number };
export type LibraryDropUndo = { projectId: string; pageId: string; placementId: string; previous?: PageLayer; applied: PageLayer };
type GridMetrics = { width: number; height: number; gapX: number; gapY: number; border?: number };

export function libraryDropTarget(project: ComicProject, pageId: string, x: number, y: number, grid: GridMetrics): LibraryDropTarget | null {
  const page = project.pages.find(page => page.id === pageId);
  const border = grid.border ?? PANEL_BORDER;
  if (!page || ![x, y, grid.width, grid.height, grid.gapX, grid.gapY, border].every(Number.isFinite) || x < 0 || y < 0 || x >= grid.width || y >= grid.height) return null;
  const cellW = (grid.width - (page.gridColumns - 1) * grid.gapX) / page.gridColumns;
  const cellH = (grid.height - (page.gridRows - 1) * grid.gapY) / page.gridRows;
  if (cellW <= 0 || cellH <= 0) return null;
  const stepX = cellW + grid.gapX, stepY = cellH + grid.gapY;
  for (const layer of [...page.placements].reverse()) {
    const left = layer.x * stepX, top = layer.y * stepY;
    const width = layer.width * cellW + (layer.width - 1) * grid.gapX;
    const height = layer.height * cellH + (layer.height - 1) * grid.gapY;
    if (x < left || y < top || x > left + width || y > top + height) continue;
    if (shapedPanel(layer)) {
      const px = (x - left - border) / (width - 2 * border) * 4;
      const py = (y - top - border) / (height - 2 * border) * 4;
      const points = panelShapePoints(layer);
      if (!points.every((a, index) => {
        const b = points[(index + 1) % points.length];
        return (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x) >= -1e-7;
      })) continue;
    }
    return { kind: "frame", placementId: layer.id };
  }
  const column = Math.floor(x / stepX), row = Math.floor(y / stepY);
  if (column >= page.gridColumns || row >= page.gridRows || x - column * stepX > cellW || y - row * stepY > cellH) return null;
  const candidate: PageLayer = { id: "candidate", x: column, y: row, width: 1, height: 1, readingOrder: 0, overlays: [] };
  if (overlapsBackgroundText(project, page, candidate)) return null;
  if (page.placements.some(layer => panelsOverlap(page, layer, candidate, albumPageFormat(project), project.panelBorderDefaults))) return null;
  return { kind: "new", x: column, y: row };
}

export function dropLibraryPanel(project: ComicProject, pageId: string, target: LibraryDropTarget, panelId: string): { project: ComicProject; undo: LibraryDropUndo } | null {
  const page = project.pages.find(page => page.id === pageId);
  const entry = libraryEntries(project).find(entry => entry.panel.id === panelId);
  if (!page || !entry?.image || entry.parked) return null;
  const previous = target.kind === "frame" ? page.placements.find(layer => layer.id === target.placementId) : undefined;
  if (target.kind === "frame" && !previous) return null;
  if (entry.pages.some(usedPage => usedPage.id !== pageId || [...(usedPage.background ? [usedPage.background] : []), ...usedPage.placements].some(layer =>
    layer.id !== previous?.id && (layer.panelId === panelId || (!!entry.plan && layer.adaptationPanelPlanId === entry.plan.id))))) return null;
  let layer: PageLayer;
  if (previous) {
    layer = { ...previous, panelId: undefined, adaptationPanelPlanId: undefined, sourceBeatIds: undefined, image: undefined };
  } else {
    if (target.kind !== "new" || !Number.isInteger(target.x) || !Number.isInteger(target.y) || target.x < 0 || target.y < 0 || target.x >= page.gridColumns || target.y >= page.gridRows) return null;
    layer = { id: "placement-" + crypto.randomUUID(), x: target.x, y: target.y, width: 1, height: 1, readingOrder: Math.max(0, ...page.placements.map(layer => layer.readingOrder)) + 1, overlays: [] };
    if (overlapsBackgroundText(project, page, layer)) return null;
    if (page.placements.some(other => panelsOverlap(page, other, layer, albumPageFormat(project), project.panelBorderDefaults))) return null;
  }
  const prepared = { ...project, pages: project.pages.map(p => p.id !== pageId ? p : { ...p, placements: previous ? p.placements.map(p => p.id === layer.id ? layer : p) : [...p.placements, layer] }) };
  const assigned = assignLibraryPanel(prepared, pageId, layer.id, panelId);
  const applied = assigned.pages.find(page => page.id === pageId)?.placements.find(p => p.id === layer.id);
  if (!applied || applied.panelId !== panelId) return null;
  // Existing authored text stays exactly as it was when replacing an image.
  const preserveText = previous && (previous.image || previous.panelId || previous.adaptationPanelPlanId || previous.overlays.length);
  const finalLayer = preserveText ? { ...applied, overlays: previous.overlays } : applied;
  const result = { ...assigned, pages: assigned.pages.map(p => p.id !== pageId ? p : { ...p, placements: p.placements.map(p => p.id === layer.id ? finalLayer : p) }) };
  return { project: result, undo: { projectId: project.id, pageId, placementId: layer.id, previous, applied: finalLayer } };
}

export function canUndoLibraryDrop(project: ComicProject, undo: LibraryDropUndo) {
  return project.id === undo.projectId && project.pages.find(page => page.id === undo.pageId)?.placements.find(layer => layer.id === undo.placementId) === undo.applied;
}

export function undoLibraryDrop(project: ComicProject, undo: LibraryDropUndo): ComicProject {
  if (!canUndoLibraryDrop(project, undo)) return project;
  return { ...project, pages: project.pages.map(page => page.id !== undo.pageId ? page : {
    ...page, placements: undo.previous ? page.placements.map(layer => layer.id === undo.placementId ? undo.previous! : layer) : page.placements.filter(layer => layer.id !== undo.placementId),
  }) };
}



