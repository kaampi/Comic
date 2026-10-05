import { validPanelShape } from "./panelShape";
import { normalizeProjectTypography } from "./pageTypography";
import { validPageFormat } from "./pageFormat";
import { pageLayers } from "./pageBackground";
import type { ComicProject } from "./project";
export const ALBUM_BACKUP_KIND = "comicbook-ai.album";
export function packAlbumBackup(
  project: ComicProject,
  exportedAt = new Date().toISOString(),
) {
  return { kind: ALBUM_BACKUP_KIND, format: 1, exportedAt, project };
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
  string(value.name);
  string(value.dataUrl);
}
export function parseAlbumBackup(input: unknown): ComicProject {
  record(input);
  if (input.kind !== ALBUM_BACKUP_KIND) throw new Error("wrong-backup");
  if (input.format !== 1) throw new Error("unsupported-backup");
  const p = input.project;
  record(p);
  if (p.format !== 1) throw new Error("unsupported-backup");
  for (const key of ["id", "title", "createdAt", "updatedAt"]) string(p[key]);
  record(p.source);
  if (!["blank", "text", "storybook"].includes(p.source.type))
    throw new Error("invalid-backup");
  if (p.source.textSnapshot !== undefined) string(p.source.textSnapshot);
  record(p.style);
  for (const key of ["id", "name", "promptText"]) string(p.style[key]);
  record(p.renderOptions);
  if (typeof p.renderOptions.linesOnly !== "boolean")
    throw new Error("invalid-backup");
  if (p.pageFormat !== undefined && !validPageFormat(p.pageFormat)) throw new Error("invalid-backup");
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
  for (const page of objects(p.pages)) {
    for (const key of ["number", "gridColumns", "gridRows"]) number(page[key]);
    for (const place of objects(pageLayers(page))) {
      for (const key of ["x", "y", "width", "height", "readingOrder"])
        number(place[key]);
      if (place.width <= 0 || place.height <= 0)
        throw new Error("invalid-backup");
      if (place.shapePoints !== undefined && !validPanelShape(place.shapePoints)) throw new Error("invalid-backup");
      image(place.image);
      for (const overlay of objects(place.overlays)) {
        string(overlay.text);
        if (!["speech", "thought", "caption", "sfx"].includes(overlay.type))
          throw new Error("invalid-backup");
        for (const key of ["x", "y", "width", "height", "rotation"])
          number(overlay[key]);
      }
    }
  }
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
      string(plan.title);
      string(plan.visualDescription);
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
    for (const value of Object.values(p.overlayDefaults)) {
      record(value);
      for (const key of ["fontSize", "fontWeight", "roundness", "textPadding"])
        if (value[key] !== undefined) number(value[key]);
      if (value.fontFamily !== undefined) string(value.fontFamily);
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
