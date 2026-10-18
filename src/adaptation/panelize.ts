import type {
  AdaptationBeat,
  AdaptationSequence,
  PanelPlan,
  ShotType,
} from "./types";
const id = (prefix: string) => prefix + "-" + crypto.randomUUID();

export function panelForBeat(
  beat: AdaptationBeat,
  order: number,
  variation = 0,
): PanelPlan {
  const shot: ShotType =
    beat.beatType === "establishing"
      ? "establishing-wide"
      : beat.beatType === "reaction"
        ? "close-up"
        : beat.beatType === "dialogue"
          ? "medium-close"
          : "medium";
  return {
    id: id("panel-plan"),
    sourceBeatIds: [beat.id],
    ...(beat.chapterId?{chapterId:beat.chapterId}:{}),
    order,
    title: variation ? `${beat.title} · ${variation + 1}` : beat.title,
    purpose: beat.beatType,
    shotType: variation ? "reaction" : shot,
    sizeHint: "medium",
    pacingRole: variation ? "accent" : "progression",
    visualDescription:
      beat.visualCandidates.find((item) => item.selected !== false)
        ?.description ?? beat.summary,
    characterIds: [...beat.characterIds],
    locationId: beat.locationId,
    dialogue: variation
      ? []
      : beat.dialogueCandidates
          .filter((item) => item.selected !== false)
          .map((item) => ({
            ...item,
            id: id("panel-dialogue"),
            bubbleType: "speech",
          })),
    captions: variation
      ? []
      : beat.captionCandidates
          .filter((item) => item.selected !== false)
          .map((item) => ({ ...item, id: id("panel-caption") })),
    status: "suggested",
    sourceNeedsReview: beat.sourceNeedsReview,
  };
}

// The second argument is accepted only for older callers; sequences no longer
// determine panel creation. Every active beat receives its own panel(s).
export function panelize(
  beats: AdaptationBeat[],
  _legacySequences?: AdaptationSequence[],
): PanelPlan[] {
  const panels: PanelPlan[] = [];
  for (const beat of [...beats].sort((a, b) => a.order - b.order)) {
    if (beat.status === "discarded") continue;
    const count = Math.max(
      1,
      Math.min(12, Math.round(beat.targetPanelCount || 1)),
    );
    for (let variation = 0; variation < count; variation++)
      panels.push(panelForBeat(beat, panels.length + 1, variation));
  }
  return panels;
}

