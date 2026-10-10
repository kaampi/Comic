import type { ComicProject } from "./project";
import { albumPageFormat, pageAspect, PAGE_RENDER_WIDTH } from "./pageFormat";
import { panelOutline } from "./panelGeometry";
type Page = ComicProject["pages"][number];
// Check the authored text box in page coordinates, including its rotation.
export function overlapsBackgroundText(project: ComicProject, page: Page, layer: ComicProject["pages"][number]["placements"][number]): boolean {
  const format = albumPageFormat(project), panel = panelOutline(page, layer, format);
  const pageHeight = PAGE_RENDER_WIDTH / pageAspect(format);
  return (page.background?.overlays ?? []).some(text => {
    if (text.type === "sfx" && text.sfxTextHidden) return false;
    const x = text.x / 100 * PAGE_RENDER_WIDTH, y = text.y / 100 * pageHeight;
    const width = text.width / 100 * PAGE_RENDER_WIDTH, height = text.height / 100 * pageHeight;
    const angle = text.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const box = [[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]].map(([dx,dy]) => ({x:x+width/2+dx*c-dy*s,y:y+height/2+dx*s+dy*c}));
    for (const polygon of [panel, box]) for (let i=0; i<polygon.length; i++) {
      const a=polygon[i],b=polygon[(i+1)%polygon.length],nx=b.y-a.y,ny=a.x-b.x;
      const p=panel.map(v=>v.x*nx+v.y*ny),q=box.map(v=>v.x*nx+v.y*ny);
      if (Math.max(...p)<=Math.min(...q)+1e-7 || Math.max(...q)<=Math.min(...p)+1e-7) return false;
    }
    return true;
  });
}
export function ensurePageBackground(
  project: ComicProject,
  pageId: string,
): ComicProject {
  return {
    ...project,
    pages: project.pages.map((page) =>
      page.id !== pageId || page.background
        ? page
        : {
            ...page,
            background: {
              id: `background-${page.id}`,
              x: 0,
              y: 0,
              width: page.gridColumns,
              height: page.gridRows,
              readingOrder: 0,
              overlays: [],
            },
          },
    ),
  };
}
// Reuse the existing frame editor without making the background a layout frame.
export function editPageBackground(
  project: ComicProject,
  pageId: string,
  update: (p: ComicProject) => ComicProject,
): ComicProject {
  const source = ensurePageBackground(project, pageId),
    page = source.pages.find((p) => p.id === pageId);
  if (!page?.background) return update(project);
  const id = page.background.id;
  const projected = {
    ...source,
    pages: source.pages.map((p) =>
      p.id !== pageId
        ? p
        : {
            ...p,
            background: undefined,
            placements: [
              ...p.placements,
              {
                ...p.background!,
                x: 0,
                y: 0,
                width: p.gridColumns,
                height: p.gridRows,
              },
            ],
          },
    ),
  };
  const result = update(projected);
  return {
    ...result,
    pages: result.pages.map((p) =>
      p.id !== pageId
        ? p
        : {
            ...p,
            background:
              p.placements.find((layer) => layer.id === id) ?? page.background,
            placements: p.placements.filter((layer) => layer.id !== id),
          },
    ),
  };
}
export function pageLayers(page: Page) {
  return [...page.placements, ...(page.background ? [page.background] : [])];
}

