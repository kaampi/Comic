import { repairSequenceBeatIds } from "./repair";
import type { AdaptationBeat, AdaptationSequence, PanelPlan, PanelSizeHint, ShotType } from "./types";

const id = (prefix: string) => prefix + "-" + crypto.randomUUID();

function countFor(sequence: AdaptationSequence): number {
  return Math.max(1, Math.min(12, sequence.preferredPanelCount));
}

function shotFor(beat: AdaptationBeat, index: number, total: number): ShotType {
  if (beat.beatType === "establishing") return "establishing-wide";
  if (beat.beatType === "reaction") return "close-up";
  if (beat.beatType === "dialogue") return index % 2 ? "over-shoulder" : "medium-close";
  if (total > 3 && index === total - 1) return "wide";
  return "medium";
}

function sizeFor(index: number, total: number, sequence: AdaptationSequence): PanelSizeHint {
  if (sequence.density === "cinematic" && total >= 4 && index === total - 2) return "large";
  if (index === 0 && sequence.order === 1) return "large";
  return "medium";
}

function clonePanel(beat: AdaptationBeat, sequence: AdaptationSequence, index: number, total: number, variation: number): PanelPlan {
  const visual = beat.visualCandidates.find((v) => v.selected !== false)?.description ?? beat.summary;
  const silent = variation > 0 && sequence.allowSilentPanels;
  return {
    id: id("panel-plan"),
    sequenceId: sequence.id,
    sourceBeatIds: [beat.id],
    order: index + 1,
    title: variation ? `${beat.title} · beat ${variation + 1}` : beat.title,
    purpose: beat.beatType,
    shotType: variation ? (variation % 2 ? "close-up" : "reaction") : shotFor(beat, index, total),
    sizeHint: sizeFor(index, total, sequence),
    pacingRole: beat.beatType === "establishing" ? "setup" : beat.beatType === "resolution" ? "release" : variation ? "accent" : "progression",
    visualDescription: variation ? `${visual} Focus on a distinct visual reaction, gesture, or intermediate movement without repeating the previous panel.` : visual,
    characterIds: beat.characterIds,
    locationId: beat.locationId,
    dialogue: silent ? [] : beat.dialogueCandidates.filter((d) => d.selected !== false).map((d) => ({ id: id("panel-dialogue"), speaker: d.speaker, text: d.text, bubbleType: "speech" as const, source: d.source })),
    captions: variation ? [] : beat.captionCandidates.filter((c) => c.selected !== false).map((c) => ({ id: id("panel-caption"), text: c.text, source: c.source, style: c.style })),
    status: "suggested"
  };
}

export function panelize(beats: AdaptationBeat[], sequences: AdaptationSequence[]): PanelPlan[] {
  const beatById = new Map(beats.map((b) => [b.id, b]));
  const panels: PanelPlan[] = [];
  for (const sequence of [...repairSequenceBeatIds(beats, sequences)].sort((a,b)=>a.order-b.order)) {
    const seqBeats = sequence.beatIds.map((id) => beatById.get(id)).filter((b): b is AdaptationBeat => Boolean(b && b.status !== "discarded"));
    if (!seqBeats.length) continue;
    const target = countFor(sequence);
    for (let i = 0; i < target; i++) {
      const beatIndex = Math.min(seqBeats.length - 1, Math.floor(i * seqBeats.length / target));
      const beat = seqBeats[beatIndex];
      const previousCount = panels.filter((p) => p.sequenceId === sequence.id && p.sourceBeatIds.includes(beat.id)).length;
      panels.push(clonePanel(beat, sequence, panels.length, target, previousCount));
    }
  }
  return panels.map((p, index) => ({ ...p, order: index + 1 }));
}
