import { BUILTIN_STYLES, type IllustrationStyle } from "./stylesLibrary";

export const PROJECT_FORMAT = 1;

export type ProjectSource = "blank" | "text" | "storybook";

export type ComicProject = {
  format: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  source: { type: ProjectSource; textSnapshot?: string };
  style: IllustrationStyle;
  characters: Array<{ id: string; name: string; description: string }>;
  locations: Array<{ id: string; name: string; description: string }>;
  scenes: Array<{ id: string; title: string; sourceText: string; panelIds: string[] }>;
  panels: Array<{ id: string; order: number; action: string; dialogue: string; narration: string; imagePrompt: string }>;
  pages: Array<{ id: string; number: number; panelIds: string[] }>;
};

const PROJECTS_KEY = "comicbook-ai.projects";

export function stableId(prefix: string): string {
  return prefix + "-" + crypto.randomUUID();
}

export function createProject(title: string, source: ProjectSource, style: IllustrationStyle = BUILTIN_STYLES[0]): ComicProject {
  const now = new Date().toISOString();
  return {
    format: PROJECT_FORMAT, id: stableId("project"), title: title.trim(), createdAt: now, updatedAt: now,
    source: { type: source, textSnapshot: "" }, style: { ...style }, characters: [], locations: [], scenes: [], panels: [], pages: []
  };
}

export function readProjects(): ComicProject[] {
  try {
    const data = JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? "[]");
    return Array.isArray(data) ? data.filter((p) => p?.format === PROJECT_FORMAT && typeof p?.id === "string") : [];
  } catch { return []; }
}

export function saveProjects(projects: ComicProject[]): void {
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); } catch {}
}