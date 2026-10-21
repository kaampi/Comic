import { validBubbleShape } from "./bubbleShape";
import { validManuscriptChapters } from "./manuscriptChapters";
import { readOrganization } from "./styleOrganization";
import { validPanelBorder } from "./panelBorder";
import { panelShapePoints, validPanelShape } from "./panelShape";
import { normalizeProjectTypography } from "./pageTypography";
import { validPageFormat, spacingFitsAlbum } from "./pageFormat";
import { pageLayers } from "./pageBackground";
import type { ComicProject } from "./project";
export const ALBUM_BACKUP_KIND = "comicbook-ai.album";
export function packAlbumBackup(
  project: ComicProject,
  exportedAt = new Date().toISOString(),
) {
  return { kind: ALBUM_BACKUP_KIND, format: 1, exportedAt, project, styleOrganization: readOrganization() };
}
export function albumBackupFilename(
  project: ComicProject,
  date = new Date().toISOString(),
) {
  const slug =
    project.title
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
      .trim()
      .replace(/[. ]+$/g, "")
      .slice(0, 80) || "album";
  return `${slug}-backup-${date.replace(/[:.]/g, "-")}.json`;
}
function record(value: unknown): asserts value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid-backup");
}
function string(value: unknown) {
  if (typeof value !== "string") throw new Error("invalid-backup");
}
function list(value: unknown): asserts value is any[] {
  if (!Array.isArray(value)) throw new Error("invalid-backup");
}
function strings(value: unknown) {
  list(value);
  value.forEach(string);
}
function number(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("invalid-backup");
}
function objects(value: unknown) {
  list(value);
  const ids = new Set();
  for (const item of value) {
    record(item);
    string(item.id);
    if (ids.has(item.id)) throw new Error("invalid-backup");
    ids.add(item.id);
  }
  return value;
}
function image(value: unknown) {
  if (value === undefined) return;
  record(value);
  if (value.positionMode !== undefined && value.positionMode !== "frame") throw new Error("invalid-backup");
  string(value.name);
  string(value.dataUrl);
  for(const key of ["rotation","zoom","offsetX","offsetY"])if(value[key]!==undefined)number(value[key]);
  if(value.zoom!==undefined&&value.zoom<=0)throw new Error("invalid-backup");
  for (const key of ["flipX", "flipY"]) if (value[key] !== undefined && typeof value[key] !== "boolean") throw new Error("invalid-backup");
}
export function parseAlbumBackup(input: unknown): ComicProject {
  record(input);
  if (input.kind !== ALBUM_BACKUP_KIND) throw new Error("wrong-backup");
  if (input.format !== 1) throw new Error("unsupported-backup");
  const p = input.project;
  record(p);
  if (p.format !== 1) throw new Error("unsupported-backup");
  for (const key of ["id", "title", "createdAt", "updatedAt"]) string(p[key]);
  if(p.introduction !== undefined) string(p.introduction);
  if(p.cover !== undefined){record(p.cover);string(p.cover.name);string(p.cover.dataUrl);if(!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(p.cover.dataUrl))throw new Error("invalid-backup");}
  record(p.source);
  if (!["blank", "text", "storybook"].includes(p.source.type))
    throw new Error("invalid-backup");
  if (p.source.textSnapshot !== undefined) string(p.source.textSnapshot);
  if(p.source.chapters!==undefined&&!validManuscriptChapters(p.source.chapters,p.source.textSnapshot??""))throw new Error("invalid-backup");
  const chapterIds=new Set((p.source.chapters??[]).map((c:any)=>c.id));
  for(const adaptation of Array.isArray(p.adaptations)?p.adaptations:[]){
    for(const item of [...(Array.isArray(adaptation?.beats)?adaptation.beats:[]),...(Array.isArray(adaptation?.panelPlans)?adaptation.panelPlans:[])])if(item && item.chapterId!==undefined&&(typeof item.chapterId!=="string"||(p.source.chapters!==undefined&&!chapterIds.has(item.chapterId))))throw new Error("invalid-backup");
  }
  for(const item of Array.isArray(p.panels)?p.panels:[])if(item && item.chapterId!==undefined&&(typeof item.chapterId!=="string"||(p.source.chapters!==undefined&&!chapterIds.has(item.chapterId))))throw new Error("invalid-backup");
  record(p.style);
  for (const key of ["id", "name", "promptText"]) string(p.style[key]);
  if (p.style.promptModules !== undefined) {
    record(p.style.promptModules);
    for (const key of ["medium", "lines", "color", "texture"]) string(p.style.promptModules[key]);
  }
  if (p.style.visualReferences !== undefined) strings(p.style.visualReferences);
  if (p.style.panelDefaults !== undefined) {
    const d = p.style.panelDefaults;
    record(d);
    for (const key of ["lens", "depthOfField"]) if (d[key] !== undefined) string(d[key]);
    if (d.effects !== undefined) strings(d.effects);
    if (d.effectStrength !== undefined && !["subtle", "normal", "strong"].includes(d.effectStrength)) throw new Error("invalid-backup");
    if (d.effectScope !== undefined && !["background", "subjects", "whole-image"].includes(d.effectScope)) throw new Error("invalid-backup");
  }
  if (p.promptStyle !== undefined) {
    record(p.promptStyle);
    for (const key of ["medium", "lines", "color", "texture"]) string(p.promptStyle[key]);
  }
  record(p.renderOptions);
  if (typeof p.renderOptions.linesOnly !== "boolean")
    throw new Error("invalid-backup");
  if (p.pageFormat !== undefined && !validPageFormat(p.pageFormat)) throw new Error("invalid-backup");
  if (p.panelBorderDefaults !== undefined && !validPanelBorder(p.panelBorderDefaults)) throw new Error("invalid-backup");
  record(p.pageDefaults);
  for (const key of ["gridColumns", "gridRows"]) {
    number(p.pageDefaults[key]);
    if (!Number.isInteger(p.pageDefaults[key]) || p.pageDefaults[key] < 1)
      throw new Error("invalid-backup");
  }
  for (const entity of [...objects(p.characters), ...objects(p.locations)]) {
    string(entity.name);
    if (entity.description !== undefined) string(entity.description);
    string(entity.visualIdentity);
  }
  for (const scene of objects(p.scenes)) {
    string(scene.title);
    string(scene.sourceText);
    strings(scene.panelIds);
  }
  for (const panel of objects(p.panels)) {
    for (const key of [
      "sceneId",
      "action",
      "dialogue",
      "narration",
      "imagePrompt",
    ])
      string(panel[key]);
    number(panel.order);
    strings(panel.characterIds);
    image(panel.image);
  }
  const pooledPages:any[]=[];
  if(p.unplacedPanels!==undefined){
    list(p.unplacedPanels);
    const ids=new Set(objects(p.pages).flatMap((page:any)=>pageLayers(page).map(layer=>layer.id)));
    for(const item of p.unplacedPanels){
      record(item);record(item.layer);string(item.layer.id);record(item.sourceGrid);
      if(ids.has(item.layer.id))throw new Error("invalid-backup");ids.add(item.layer.id);
      for(const key of ["gridColumns","gridRows"]){number(item.sourceGrid[key]);if(!Number.isInteger(item.sourceGrid[key])||item.sourceGrid[key]<1||item.sourceGrid[key]>100)throw new Error("invalid-backup");}
      if(item.targetPageId!==undefined){string(item.targetPageId);if(!p.pages.some((page:any)=>page.id===item.targetPageId))throw new Error("invalid-backup");}
      pooledPages.push({id:`pool-${item.layer.id}`,number:0,...item.sourceGrid,placements:[item.layer]});
    }
  }
  for (const page of [...objects(p.pages),...pooledPages]) {
    if (page.gridMode !== undefined && page.gridMode !== "preset" && page.gridMode !== "custom") throw new Error("invalid-backup");
    for (const key of ["number", "gridColumns", "gridRows"]) number(page[key]);
    if(page.foregrounds!==undefined){
      list(page.foregrounds);
      const ids=new Set([...objects(page.placements),...(page.background?[page.background]:[])].map(layer=>layer.id));
      for(const layer of page.foregrounds){record(layer);string(layer.id);if(ids.has(layer.id))throw new Error("invalid-backup");ids.add(layer.id);if(layer.moveWithText!==undefined&&typeof layer.moveWithText!=="boolean")throw new Error("invalid-backup");}
    }
    for (const place of objects(pageLayers(page))) {
      for (const key of ["x", "y", "width", "height", "readingOrder"])
        number(place[key]);
      if (place.width <= 0 || place.height <= 0)
        throw new Error("invalid-backup");
      if (place.shapePoints !== undefined && !validPanelShape(place.shapePoints)) throw new Error("invalid-backup");
      if(place.hiddenShapeEdges!==undefined && (!Array.isArray(place.hiddenShapeEdges)||place.hiddenShapeEdges.length>panelShapePoints(place).length||!place.hiddenShapeEdges.every((i:unknown)=>typeof i==="number"&&Number.isInteger(i)&&i>=0&&i<panelShapePoints(place).length)))throw new Error("invalid-backup");
      if (place.panelBorder !== undefined && !validPanelBorder(place.panelBorder)) throw new Error("invalid-backup");
      image(place.image);
      for (const overlay of objects(place.overlays)) {
        if (overlay.textColor!==undefined && (typeof overlay.textColor!=="string"||!/^#[0-9a-f]{6}$/i.test(overlay.textColor))) throw new Error("invalid-backup");
        if(overlay.bubbleShapeSmooth!==undefined&&typeof overlay.bubbleShapeSmooth!=="boolean")throw new Error("invalid-backup");
        if(overlay.bubbleShapePoints!==undefined&&!validBubbleShape(overlay.bubbleShapePoints,overlay.bubbleShapeSmooth!==false))throw new Error("invalid-backup");
        if(overlay.fontStyle!==undefined&&!['normal','italic'].includes(overlay.fontStyle))throw new Error("invalid-backup");
        if(overlay.underline!==undefined&&typeof overlay.underline!=="boolean")throw new Error("invalid-backup");
        string(overlay.text);
        if (!["speech", "thought", "caption", "sfx"].includes(overlay.type))
          throw new Error("invalid-backup");
        for (const key of ["x", "y", "width", "height", "rotation"])
          number(overlay[key]);
        if (overlay.roundness !== undefined) {
          number(overlay.roundness);
          if (overlay.roundness < (overlay.type === "caption" ? -100 : 0) || overlay.roundness > 100) throw new Error("invalid-backup");
        }
        if (overlay.textStyles !== undefined) {
          list(overlay.textStyles);let end=0;
          for (const style of overlay.textStyles) {
            record(style);number(style.start);number(style.end);
            if (!Number.isInteger(style.start)||!Number.isInteger(style.end)||style.start<end||style.end<=style.start||style.end>overlay.text.length) throw new Error("invalid-backup");
            end=style.end;
            if(style.fontStyle!==undefined&&!['normal','italic'].includes(style.fontStyle))throw new Error("invalid-backup");
            if(style.underline!==undefined&&typeof style.underline!=="boolean")throw new Error("invalid-backup");
            if (style.fontFamily!==undefined) string(style.fontFamily);
            if (style.textColor!==undefined && (typeof style.textColor!=="string"||!/^#[0-9a-f]{6}$/i.test(style.textColor))) throw new Error("invalid-backup");
            if (style.fontSize!==undefined) {number(style.fontSize);if(style.fontSize<.1||style.fontSize>600)throw new Error("invalid-backup");}
            if (style.fontWeight!==undefined) {number(style.fontWeight);if(style.fontWeight<100||style.fontWeight>900)throw new Error("invalid-backup");}
          }
        }
        if (overlay.bubbleLinks !== undefined) {
          list(overlay.bubbleLinks);
          const targets = new Set<string>();
          for (const link of overlay.bubbleLinks) {
            record(link); string(link.targetId); number(link.width);
            const target = place.overlays.find((o: any) => o.id === link.targetId);
            if (!["speech", "thought"].includes(overlay.type) || !target || target.type !== overlay.type || target.id === overlay.id || targets.has(link.targetId) || link.width < 2 || link.width > 80) throw new Error("invalid-backup");
            for (const key of ['startWidth', 'endWidth']) if (link[key] !== undefined) { number(link[key]); if (link[key] < 2 || link[key] > 80) throw new Error("invalid-backup"); }
            for (const key of ['startAngle', 'endAngle']) if (link[key] !== undefined) { number(link[key]); if (Math.abs(link[key]) > Math.PI * 2) throw new Error("invalid-backup"); }
            for (const key of ['startControl', 'endControl']) if (link[key] !== undefined) {
              record(link[key]); number(link[key].along); number(link[key].across);
              if (link[key].along < .05 || link[key].along > .45 || Math.abs(link[key].across) > .75) throw new Error("invalid-backup");
            }
            targets.add(link.targetId);
          }
        }
      }
    }
  }
  if (p.pageFormat?.spacing && !spacingFitsAlbum(p.pageFormat, [p.pageDefaults, ...p.pages])) throw new Error("invalid-backup");
  for (const a of objects(p.adaptations)) {
    string(a.sourceText);
    for (const beat of objects(a.beats)) {
      for (const key of ["title", "summary", "sourceTextExcerpt"])
        string(beat[key]);
      strings(beat.characterIds);
      for (const key of [
        "dialogueCandidates",
        "captionCandidates",
        "visualCandidates",
      ])
        objects(beat[key]);
    }
    objects(a.sequences);
    objects(a.imagePrompts);
    for (const plan of objects(a.panelPlans)) {
      if (plan.archived !== undefined && typeof plan.archived !== "boolean") throw new Error("invalid-backup");
      string(plan.title);
      string(plan.visualDescription);
      if (plan.promptDirection !== undefined) {
        const d = plan.promptDirection;
        record(d);
        for (const key of ["cameraAngle", "lens", "depthOfField", "focalPoint", "setting", "lighting", "continuity"]) if (d[key] !== undefined) string(d[key]);
        if (d.effects !== undefined) strings(d.effects);
        if (d.styleDefaultKeys !== undefined) strings(d.styleDefaultKeys);
        if (d.styleDefaultName !== undefined) string(d.styleDefaultName);
        if (d.characterActions !== undefined) { record(d.characterActions); Object.values(d.characterActions).forEach(string); }
        for (const key of ["lockShot", "lockAngle"]) if (d[key] !== undefined && typeof d[key] !== "boolean") throw new Error("invalid-backup");
        if (d.effectStrength !== undefined && !["subtle", "normal", "strong"].includes(d.effectStrength)) throw new Error("invalid-backup");
        if (d.effectScope !== undefined && !["background", "subjects", "whole-image"].includes(d.effectScope)) throw new Error("invalid-backup");
      }
      strings(plan.sourceBeatIds);
      strings(plan.characterIds);
      for (const text of [...objects(plan.dialogue), ...objects(plan.captions)])
        string(text.text);
      image(plan.image);
      if (plan.imageVersions !== undefined) {
        list(plan.imageVersions);
        plan.imageVersions.forEach(image);
      }
    }
  }
  objects(p.bubbleSwatches);
  if (p.overlayDefaults !== undefined) {
    record(p.overlayDefaults);
    for (const [type,value] of Object.entries(p.overlayDefaults)) {
      record(value);
      for (const key of ["fontSize", "fontWeight", "roundness", "textPadding"])
        if (value[key] !== undefined) number(value[key]);
      if (value.roundness !== undefined && (value.roundness < (type === "caption" ? -100 : 0) || value.roundness > 100)) throw new Error("invalid-backup");
      if (value.fontFamily !== undefined) string(value.fontFamily);
      for(const key of ["textColor","fillColor","strokeColor"])if(value[key]!==undefined)string(value[key]);
      if(value.strokeWidth!==undefined){number(value.strokeWidth);if(value.strokeWidth<0||value.strokeWidth>20)throw new Error("invalid-backup");}
      if(value.fillOpacity!==undefined){number(value.fillOpacity);if(value.fillOpacity<0||value.fillOpacity>1)throw new Error("invalid-backup");}
      if(value.bubbleStyle!==undefined && !["organic","wide","tall","oval","rounded","shout","whisper"].includes(value.bubbleStyle))throw new Error("invalid-backup");
      if (
        value.textAlign !== undefined &&
        !["left", "center", "right"].includes(value.textAlign)
      )
        throw new Error("invalid-backup");
    }
  }
  if (p.typographyVersion !== undefined && p.typographyVersion !== 2) throw new Error("unsupported-backup");
  return normalizeProjectTypography(structuredClone(p) as ComicProject);
}
export function restoredAlbumCopy(project: ComicProject): ComicProject {
  const now = new Date().toISOString();
  return {
    ...normalizeProjectTypography(structuredClone(project)),
    id: `project-${crypto.randomUUID()}`,
    createdAt: now,
    updatedAt: now,
  };
}





