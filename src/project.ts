import { BUILTIN_STYLES, type IllustrationStyle } from "./stylesLibrary";
import type { StoryAdaptation } from "./adaptation/types";

export const PROJECT_FORMAT = 1;

export type ProjectSource = "blank" | "text" | "storybook";

export type OverlayType = "speech" | "thought" | "caption" | "sfx";
export type BubbleStyle = "organic" | "wide" | "tall" | "oval" | "rounded" | "shout" | "whisper";
export type TextOverlay = {
  id: string; type: OverlayType; text: string; x: number; y: number; width: number; height: number; rotation: number;
  fontSize?: number; fontFamily?: string; fontWeight?: number; bubbleStyle?: BubbleStyle;
  tailEnabled?: boolean; tailCurve?: number; tailRootWidth?: number; roundness?: number; tailX?: number; tailY?: number;
  strokeColor?: string; strokeWidth?: number; fillColor?: string; fillOpacity?: number; swatchId?: string;
};
export type BubbleSwatch = {
  id: string;
  name: string;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
  characterId?: string;
};

export type ComicProject = {
  format: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  source: { type: ProjectSource; textSnapshot?: string; storyBookId?: string };
  references?: { characterPortraits?: Record<string, string> };
  style: IllustrationStyle;
  pageDefaults: { gridColumns: number; gridRows: number };
  characters: Array<{ id: string; name: string; description: string; visualIdentity: string; sourceId?: string; pronoun?: string; approximateAge?: number }>;
  locations: Array<{ id: string; name: string; description: string; visualIdentity: string; sourceId?: string }>;
  scenes: Array<{ id: string; title: string; sourceText: string; panelIds: string[] }>;
  panels: Array<{
    id: string; sceneId: string; order: number; action: string; dialogue: string; narration: string; imagePrompt: string;
    characterIds: string[]; locationId?: string; adaptationPanelPlanId?: string; sourceBeatIds?: string[];
  }>;
  pages: Array<{ id: string; number: number; gridColumns: number; gridRows: number; placements: Array<{ id: string; panelId?: string; x: number; y: number; width: number; height: number; readingOrder: number; overlays: TextOverlay[]; image?: { name: string; dataUrl: string; zoom?: number; offsetX?: number; offsetY?: number; fit?: "cover" | "contain" }; sourceBeatIds?: string[] }> }>;
  adaptations: StoryAdaptation[];
  bubbleSwatches: BubbleSwatch[];
};

const PROJECTS_KEY = "comicbook-ai.projects";

export function stableId(prefix: string): string {
  return prefix + "-" + crypto.randomUUID();
}

export function createProject(title: string, source: ProjectSource, style: IllustrationStyle = BUILTIN_STYLES[0]): ComicProject {
  const now = new Date().toISOString();
  return {
    format: PROJECT_FORMAT, id: stableId("project"), title: title.trim(), createdAt: now, updatedAt: now,
    source: { type: source, textSnapshot: "" }, style: { ...style }, pageDefaults: { gridColumns: 3, gridRows: 5 }, characters: [], locations: [], scenes: [], panels: [], pages: [], adaptations: [], bubbleSwatches: []
  };
}

export function readProjects(): ComicProject[] {
  try {
    const data = JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? "[]");
    return Array.isArray(data) ? data.filter((p) => p?.format === PROJECT_FORMAT && typeof p?.id === "string").map((p) => ({
      ...p,
      pageDefaults: p.pageDefaults ?? { gridColumns: 3, gridRows: 5 },
      characters: Array.isArray(p.characters) ? p.characters.map((item: any) => ({ ...item, visualIdentity: item.visualIdentity ?? "" })) : [],
      locations: Array.isArray(p.locations) ? p.locations.map((item: any) => ({ ...item, visualIdentity: item.visualIdentity ?? "" })) : [],
      panels: Array.isArray(p.panels) ? p.panels.map((item: any) => ({ ...item, characterIds: item.characterIds ?? [] })) : [],
      adaptations: Array.isArray(p.adaptations) ? p.adaptations : [],
      bubbleSwatches: Array.isArray(p.bubbleSwatches) ? p.bubbleSwatches : [],
      pages: Array.isArray(p.pages) ? p.pages.map((page: any) => ({
        ...page, gridColumns: page.gridColumns ?? 3, gridRows: page.gridRows ?? 5,
        placements: Array.isArray(page.placements) ? page.placements.filter((item: any) => typeof item?.x === "number" && typeof item?.y === "number").map((item:any)=>({...item,sourceBeatIds:Array.isArray(item.sourceBeatIds)?item.sourceBeatIds:undefined,image:item.image?{...item.image,zoom:item.image.zoom??1,offsetX:item.image.offsetX??0,offsetY:item.image.offsetY??0,fit:item.image.fit??"cover"}:undefined,overlays:Array.isArray(item.overlays)?item.overlays.map((overlay:any)=>({
          ...overlay,
          tailEnabled:overlay.type==="speech"?(overlay.tailEnabled??true):overlay.tailEnabled,
          strokeColor:overlay.strokeColor??"#171411",
          strokeWidth:overlay.strokeWidth??2,
          fillColor:overlay.fillColor??"#fffdf7",
          fillOpacity:overlay.fillOpacity??1
        })):[]})) : []
      })) : []
    })) : [];
  } catch { return []; }
}

export function saveProjects(projects: ComicProject[]): void {
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); } catch {}
}
