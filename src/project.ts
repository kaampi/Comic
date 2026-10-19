import type { ManuscriptChapter } from "./manuscriptChapters";
import { saveProjectData } from "./projectSaveStatus";
import { renderOptionsForStyle, type RenderOptions } from "./styleColorMode";
import type { PanelBorderStyle } from "./panelBorder";
import type { ShapePoint } from "./panelShape";
import { normalizeProjectTypography } from "./pageTypography";
import { DEFAULT_PAGE_FORMAT, albumPageFormat, type PageFormat } from "./pageFormat";
import { BUILTIN_STYLES, type IllustrationStyle } from "./stylesLibrary";
import type { AlbumPromptStyle, PanelImage, StoryAdaptation } from "./adaptation/types";
import { repairLegacyAdaptation } from "./adaptation/repair";

export const PROJECT_FORMAT = 1;

export type ProjectSource = "blank" | "text" | "storybook";

export type OverlayType = "speech" | "thought" | "caption" | "sfx";
export type BubbleStyle = "organic" | "wide" | "tall" | "oval" | "rounded" | "shout" | "whisper";
export type BubbleLink = {
  targetId: string; width: number;
  startWidth?: number; endWidth?: number;
  // Attachment angles are local to each bubble. Handles use the physical
  // endpoint chord as their frame, so they follow moves, rotation and resizing.
  startAngle?: number; endAngle?: number;
  startControl?: { along: number; across: number };
  endControl?: { along: number; across: number };
};
export type TextOverlay = {
  textStyles?: TextStyleRange[];
  bubbleLinks?: BubbleLink[];
  id: string; type: OverlayType; text: string; x: number; y: number; width: number; height: number; rotation: number;
  sfxShapeId?: string; sfxTextHidden?: boolean; sfxTextColor?: string;
  sourcePanelId?: string; sourceTextId?: string;
  textAlign?: "left" | "center" | "right"; textPadding?: number;
  textColor?: string; fontSize?: number; fontFamily?: string; fontWeight?: number; bubbleStyle?: BubbleStyle;
  tailStartAngle?: number;
  thoughtTailWidth?: number; thoughtTailCurve?: number;
  tailEnabled?: boolean; tailCurve?: number; tailRootWidth?: number; roundness?: number; tailX?: number; tailY?: number;
  strokeColor?: string; strokeWidth?: number; fillColor?: string; fillOpacity?: number; swatchId?: string;
};
export type TextStyle = { textColor?: string; fontFamily?: string; fontSize?: number; fontWeight?: number };
export type TextStyleRange = TextStyle & { start: number; end: number };
export type BubbleSwatch = {
  id: string;
  name: string;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
  characterId?: string;
};

export type PageLayer={ moveWithText?:boolean; panelBorder?:PanelBorderStyle;shapePoints?:ShapePoint[];id:string;panelId?:string;x:number;y:number;width:number;height:number;readingOrder:number;overlays:TextOverlay[];image?:PanelImage;sourceBeatIds?:string[];adaptationPanelPlanId?:string };

export type ComicProject = {
  format: 1;
  id: string;
  title: string;
  introduction?: string;
  cover?: { name: string; dataUrl: string };
  createdAt: string;
  updatedAt: string;
  source: { type: ProjectSource; textSnapshot?: string; storyBookId?: string; chapters?: ManuscriptChapter[] };
  references?: { characterPortraits?: Record<string, string> };
  style: IllustrationStyle;
  promptStyle?: AlbumPromptStyle;
  renderOptions: RenderOptions;
  pageFormat?: PageFormat;
  typographyVersion?: 2;
  panelBorderDefaults?: PanelBorderStyle;
  pageDefaults: { gridColumns: number; gridRows: number };
  characters: Array<{ id: string; name: string; description: string; visualIdentity: string; sourceId?: string; pronoun?: string; approximateAge?: number }>;
  locations: Array<{ id: string; name: string; description: string; visualIdentity: string; sourceId?: string }>;
  scenes: Array<{ id: string; title: string; sourceText: string; panelIds: string[] }>;
  panels: Array<{
    id: string; sceneId: string; chapterId?: string; order: number; action: string; dialogue: string; narration: string; imagePrompt: string;
    characterIds: string[]; locationId?: string; adaptationPanelPlanId?: string; sourceBeatIds?: string[];
    image?: PanelImage;
  }>;
  pages: Array<{ id: string; number: number; gridColumns: number; gridRows: number; gridMode?: "preset" | "custom"; background?: PageLayer; foregrounds?: PageLayer[]; placements: PageLayer[] }>;
  adaptations: StoryAdaptation[];
  overlayDefaults?: Partial<Record<OverlayType, Partial<import("./overlayTypography").OverlayTypography>>>;
  bubbleSwatches: BubbleSwatch[];
};

const PROJECTS_KEY = "comicbook-ai.projects";

export function stableId(prefix: string): string {
  return prefix + "-" + crypto.randomUUID();
}

export function createProject(title: string, source: ProjectSource, style: IllustrationStyle = BUILTIN_STYLES[0]): ComicProject {
  const now = new Date().toISOString();
  return {
    typographyVersion: 2, format: PROJECT_FORMAT, id: stableId("project"), title: title.trim(), createdAt: now, updatedAt: now,
    pageFormat: { ...DEFAULT_PAGE_FORMAT }, source: { type: source, textSnapshot: "" }, style: { ...style }, renderOptions: renderOptionsForStyle(style), pageDefaults: { gridColumns: 3, gridRows: 5 }, characters: [], locations: [], scenes: [], panels: [], pages: [], adaptations: [], bubbleSwatches: []
  };
}

export function normalizeStoredProjects(data: unknown): ComicProject[] {
    return Array.isArray(data) ? data.filter((p) => p?.format === PROJECT_FORMAT && typeof p?.id === "string").map((p) => ({
      ...p,
      renderOptions: renderOptionsForStyle(p.style, p.renderOptions),
      pageFormat: albumPageFormat(p),
      pageDefaults: p.pageDefaults ?? { gridColumns: 3, gridRows: 5 },
      characters: Array.isArray(p.characters) ? p.characters.map((item: any) => ({ ...item, visualIdentity: item.visualIdentity ?? "" })) : [],
      locations: Array.isArray(p.locations) ? p.locations.map((item: any) => ({ ...item, visualIdentity: item.visualIdentity ?? "" })) : [],
      panels: Array.isArray(p.panels) ? p.panels.map((item: any) => ({ ...item, characterIds: item.characterIds ?? [] })) : [],
      adaptations: Array.isArray(p.adaptations) ? p.adaptations.map(repairLegacyAdaptation) : [],
      bubbleSwatches: Array.isArray(p.bubbleSwatches) ? p.bubbleSwatches : [],
      pages: Array.isArray(p.pages) ? p.pages.map((page: any) => ({
        ...page, foregrounds:Array.isArray(page.foregrounds)?page.foregrounds.map((layer:any)=>({...layer,overlays:Array.isArray(layer.overlays)?layer.overlays:[],image:layer.image?{...layer.image,zoom:layer.image.zoom??1,offsetX:layer.image.offsetX??0,offsetY:layer.image.offsetY??0,fit:layer.image.fit??"contain",positionMode:"frame"}:undefined})):undefined, background:page.background?{...page.background,overlays:Array.isArray(page.background.overlays)?page.background.overlays:[],image:page.background.image?{...page.background.image,zoom:page.background.image.zoom??1,offsetX:page.background.image.offsetX??0,offsetY:page.background.image.offsetY??0,fit:page.background.image.fit??"cover"}:undefined}:undefined, gridColumns: page.gridColumns ?? 3, gridRows: page.gridRows ?? 5,
        placements: Array.isArray(page.placements) ? page.placements.filter((item: any) => typeof item?.x === "number" && typeof item?.y === "number").map((item:any)=>({...item,sourceBeatIds:Array.isArray(item.sourceBeatIds)?item.sourceBeatIds:undefined,adaptationPanelPlanId:typeof item.adaptationPanelPlanId==="string"?item.adaptationPanelPlanId:undefined,image:item.image?{...item.image,zoom:item.image.zoom??1,offsetX:item.image.offsetX??0,offsetY:item.image.offsetY??0,fit:item.image.fit??"cover"}:undefined,overlays:Array.isArray(item.overlays)?item.overlays.map((overlay:any)=>({
          ...overlay,
          tailEnabled:overlay.type==="speech"?(overlay.tailEnabled??true):overlay.tailEnabled,
          strokeColor:overlay.strokeColor??"#171411",
          strokeWidth:overlay.strokeWidth??2,
          fillColor:overlay.fillColor??"#fffdf7",
          fillOpacity:overlay.fillOpacity??1
        })):[]})) : []
      })) : []
    })).map(normalizeProjectTypography) : [];
}

export function readProjects(): ComicProject[] {
  try { return normalizeStoredProjects(JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? "[]")); }
  catch { return []; }
}

export function saveProjects(projects: ComicProject[]): boolean {
  return saveProjectData(PROJECTS_KEY, projects);
}





