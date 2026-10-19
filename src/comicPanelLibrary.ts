import { pageLayers } from "./pageBackground";
import { overlayDefaults } from "./overlayTypography";
import type { ComicProject, TextOverlay } from "./project";

export function libraryEntries(project: ComicProject) {
  return project.panels.map((panel) => {
    const plan = project.adaptations
      .flatMap((a) => a.panelPlans)
      .find((p) => p.id === panel.adaptationPanelPlanId);
    const pages = project.pages.filter((page) =>
      pageLayers(page).some(
        (p) =>
          p.panelId === panel.id ||
          (!!plan && p.adaptationPanelPlanId === plan.id),
      ),
    );
    const sourceBeatIds = new Set([...(panel.sourceBeatIds ?? []), ...(plan?.sourceBeatIds ?? [])]);
    const beat = project.adaptations.flatMap(a => a.beats).find(b => sourceBeatIds.has(b.id));
    return {
      panel,
      plan,
      beat,
      title: plan?.title || panel.action || `Ruta ${panel.order}`,
      image: plan?.image ?? panel.image,
      pages,
    };
  }).filter(entry => !entry.plan?.archived || entry.pages.length > 0)
    .sort((a,b)=>(a.plan?.order ?? a.panel.order)-(b.plan?.order ?? b.panel.order));
}

export function assignLibraryPanel(
  project: ComicProject,
  pageId: string,
  placementId: string,
  panelId: string,
): ComicProject {
  const entry = libraryEntries(project).find((e) => e.panel.id === panelId);
  const target = project.pages
    .find((p) => p.id === pageId)
    ?.placements.find((p) => p.id === placementId);
  if (
    !entry ||
    !target ||
    (target.panelId && target.panelId !== panelId) ||
    (target.adaptationPanelPlanId &&
      target.adaptationPanelPlanId !== entry.plan?.id)
  )
    return project;
  if (
    project.pages.some((page) =>
      pageLayers(page).some(
        (p) =>
          !(page.id === pageId && p.id === placementId) &&
          (p.panelId === panelId ||
            (!!entry.plan && p.adaptationPanelPlanId === entry.plan.id)),
      ),
    )
  )
    return project;
  const texts = entry.plan
    ? [
        ...entry.plan.dialogue.map((d) => ({
          id: d.id,
          text: d.text,
          type: d.bubbleType,
          speaker: d.speaker,
        })),
        ...entry.plan.captions.map((c) => ({
          id: c.id,
          text: c.text,
          type: "caption" as const,
          speaker: undefined,
        })),
      ]
    : [
        {
          id: `${panelId}-dialogue`,
          text: entry.panel.dialogue,
          type: "speech" as const,
          speaker: undefined,
        },
        {
          id: `${panelId}-narration`,
          text: entry.panel.narration,
          type: "caption" as const,
          speaker: undefined,
        },
      ];
  const overlays = [...target.overlays];
  for (const text of texts) {
    if (
      !text.text.trim() ||
      overlays.some(
        (o) =>
          (o.sourceTextId === text.id && o.sourcePanelId === panelId) ||
          (o.text === text.text && o.type === text.type),
      )
    )
      continue;
    const index = overlays.length;
    const x = 8 + (index % 2) * 42,
      y = Math.min(72, 8 + Math.floor(index / 2) * 28);
    const character = project.characters.find(
      (c) => c.id === text.speaker || c.name === text.speaker,
    );
    const swatch =
      character &&
      project.bubbleSwatches.find((s) => s.characterId === character.id);
    const defaults=overlayDefaults(project,text.type);
    const overlay: TextOverlay = {
      id: `overlay-${crypto.randomUUID()}`,
      sourcePanelId: panelId,
      sourceTextId: text.id,
      text: text.text,
      type: text.type,
      x,
      y,
      width: 40,
      height: 24,
      rotation: 0,
      bubbleStyle: "organic",
      tailEnabled: text.type === "speech",
      tailX: x + 26,
      tailY: y + (text.type === "thought" ? 24*1.55 : 28),
      ...defaults,
      strokeColor: swatch?.strokeColor ?? defaults.strokeColor ?? "#171411",
      strokeWidth: swatch?.strokeWidth ?? defaults.strokeWidth ?? 2,
      fillColor: swatch?.fillColor ?? defaults.fillColor ?? "#fffdf7",
      fillOpacity: swatch?.fillOpacity ?? defaults.fillOpacity ?? 1,
      swatchId: swatch?.id,
    };
    overlays.push(overlay);
  }
  return {
    ...project,
    pages: project.pages.map((page) =>
      page.id !== pageId
        ? page
        : {
            ...page,
            placements: page.placements.map((p) =>
              p.id !== placementId
                ? p
                : {
                    ...p,
                    panelId,
                    adaptationPanelPlanId: entry.plan?.id,
                    sourceBeatIds:
                      entry.panel.sourceBeatIds ?? entry.plan?.sourceBeatIds,
                    image: p.image ?? entry.image,
                    overlays,
                  },
            ),
          },
    ),
  };
}

