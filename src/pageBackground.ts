import type { ComicProject } from "./project";
type Page = ComicProject["pages"][number];
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
