import type { ComicProject, PageLayer } from "./project";
import { albumPageFormat } from "./pageFormat";
import { panelsOverlap } from "./panelGeometry";
import { overlapsBackgroundText } from "./pageBackground";

type Page = ComicProject["pages"][number];
export function panelMoveAllowed(project: ComicProject, page: Page, candidate: PageLayer): boolean {
  if (![candidate.x, candidate.y].every(Number.isInteger) || candidate.x < 0 || candidate.y < 0 ||
      candidate.x + candidate.width > page.gridColumns || candidate.y + candidate.height > page.gridRows) return false;
  return !page.placements.some(layer => layer.id !== candidate.id && panelsOverlap(page, layer, candidate, albumPageFormat(project), project.panelBorderDefaults)) &&
    !overlapsBackgroundText(project, page, candidate);
}

// Revalidate against the current album when committing. Preserve all authored
// content, shape points and reading order; only the grid origin changes.
export function relocatePanel(project: ComicProject, pageId: string, id: string, x: number, y: number): ComicProject {
  const page = project.pages.find(p => p.id === pageId), layer = page?.placements.find(p => p.id === id);
  if (!page || !layer || (layer.x === x && layer.y === y)) return project;
  const candidate = { ...layer, x, y };
  if (!panelMoveAllowed(project, page, candidate)) return project;
  return { ...project, pages: project.pages.map(p => p.id === pageId ? { ...p, placements: p.placements.map(l => l.id === id ? candidate : l) } : p) };
}
