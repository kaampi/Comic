import type { ComicProject } from "./project";

export type AlbumSummary = Pick<ComicProject, "id" | "title" | "updatedAt" | "introduction" | "cover"> & {
  sourceType: ComicProject["source"]["type"];
  styleName: string;
  pageCount: number;
  format?: never;
};

export type LocalAlbum = AlbumSummary | ComicProject;

export function isOpenAlbum(album: LocalAlbum): album is ComicProject {
  return album.format === 1;
}

export function summarizeAlbum(album: LocalAlbum): AlbumSummary {
  if (!isOpenAlbum(album)) return album;
  const { id, title, updatedAt, introduction, cover } = album;
  return {
    id, title, updatedAt, introduction, cover,
    sourceType: album.source.type,
    styleName: album.style.name,
    pageCount: album.pages.length,
  };
}
