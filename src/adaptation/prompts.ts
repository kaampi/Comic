import type { ComicProject } from "../project";
import type { ImagePrompt, PanelPlan } from "./types";

const id = (prefix: string) => prefix + "-" + crypto.randomUUID();

function characterText(project: ComicProject, ids: string[]): string {
  return ids.map((cid) => project.characters.find((c) => c.id === cid)).filter(Boolean).map((c) => {
    const identity = c!.visualIdentity?.trim() || c!.description?.trim();
    return identity ? `${c!.name}: ${identity}` : c!.name;
  }).join(". ");
}

function locationText(project: ComicProject, locationId?: string): string {
  if (!locationId) return "";
  const location = project.locations.find((l) => l.id === locationId);
  if (!location) return "";
  const identity = location.visualIdentity?.trim() || location.description?.trim();
  return identity ? `${location.name}: ${identity}` : location.name;
}

export function buildImagePrompt(project: ComicProject, panel: PanelPlan, mode: ImagePrompt["mode"] = "full"): string {
  const parts = [
    "Comic panel illustration.",
    panel.visualDescription.trim(),
    panel.shotType ? `Shot: ${panel.shotType}.` : "",
    panel.sizeHint ? `Composition should read clearly in a ${panel.sizeHint} comic panel.` : "",
    characterText(project, panel.characterIds) ? `Characters: ${characterText(project, panel.characterIds)}.` : "",
    locationText(project, panel.locationId) ? `Location: ${locationText(project, panel.locationId)}.` : "",
    project.style?.promptText ? `Illustration style: ${project.style.promptText}` : "",
    "Preserve character identity and clothing continuity with adjacent panels.",
    "Leave natural negative space for later speech balloons or captions.",
    "Do not render dialogue, captions, lettering, speech bubbles, watermarks, signatures, or UI."
  ].filter(Boolean);
  if (mode === "short") return parts.slice(0, 4).join(" ");
  if (mode === "medium") return [...parts.slice(0, 7), parts[parts.length - 1]].join(" ");
  return parts.join(" ");
}

export function generateImagePrompts(project: ComicProject, panels: PanelPlan[], mode: ImagePrompt["mode"] = "full"): ImagePrompt[] {
  const now = new Date().toISOString();
  return panels.map((panel) => ({
    id: id("image-prompt"),
    panelId: panel.id,
    mode,
    prompt: buildImagePrompt(project, panel, mode),
    negativePrompt: "text, lettering, speech bubbles, captions, watermark, signature, UI",
    createdAt: now,
    updatedAt: now
  }));
}
