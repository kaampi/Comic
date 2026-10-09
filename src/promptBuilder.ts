import { resolveColorMode, stylePromptForMode, grayscaleModifier } from "./styleColorMode";
import type { ComicProject } from "./project";

const lineOnlyModifier = "Line art only. Black ink drawing with clean contour lines and controlled hatching. No color, no painted fills, no grayscale wash, no colored lighting. Preserve the selected comic style through line quality, shape language, anatomy, expression, composition, and background detail.";

export function buildPanelPrompt(project: ComicProject, panelId: string): string {
  const panel = project.panels.find((item) => item.id === panelId);
  if (!panel) return "";

  const characters = project.characters.filter((character) => (panel.characterIds ?? []).includes(character.id));
  const location = panel.locationId ? project.locations.find((item) => item.id === panel.locationId) : undefined;

  const sections: string[] = [];
  const colorMode = resolveColorMode(project.style, project.renderOptions);
  sections.push("STYLE\n" + stylePromptForMode(project.style, colorMode));
  if (colorMode === "line-art") sections.push("RENDERING MODE\n" + lineOnlyModifier);
  if (colorMode === "grayscale") sections.push("RENDERING MODE\n" + grayscaleModifier);

  if (characters.length) {
    sections.push("CHARACTERS\n" + characters.map((character) =>
      character.name + ": " + (character.visualIdentity.trim() || character.description.trim() || "No visual anchor specified.")
    ).join("\n"));
  }

  if (location) {
    sections.push("LOCATION\n" + location.name + ": " + (location.visualIdentity.trim() || location.description.trim() || "No visual anchor specified."));
  }

  if (panel.action.trim()) sections.push("PANEL ACTION\n" + panel.action.trim());
  if (panel.imagePrompt.trim()) sections.push("COMPOSITION AND CAMERA\n" + panel.imagePrompt.trim());

  sections.push("REQUIREMENTS\nSingle comic panel. Preserve the established visual identity of recurring characters and locations. Leave appropriate clear space for planned speech balloons or captions. Do not render dialogue, captions, lettering, speech balloons, watermarks, signatures, or UI elements into the image.");

  if (project.style.decorativeSeals) sections.push("DECORATIVE EXCEPTION\nPeripheral decorative calligraphic marks and red seal impressions are allowed as specified by the style; no narrative text or dialogue.");
  return sections.join("\n\n");
}

