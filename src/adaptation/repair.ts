import { sequenceTitle } from "./extract";
import type { AdaptationBeat, AdaptationSequence, StoryAdaptation } from "./types";

/** Repair the exact legacy extraction bug without rebuilding sequences or losing edits. */
export function repairSequenceBeatIds(beats: AdaptationBeat[], sequences: AdaptationSequence[]): AdaptationSequence[] {
  const orderedBeats = [...beats].sort((a, b) => a.order - b.order);
  const orderedSequences = [...sequences].sort((a, b) => a.order - b.order);
  const references = orderedSequences.flatMap((sequence) => sequence.beatIds);
  const currentIds = new Set(beats.map((beat) => beat.id));
  if (references.every((id) => currentIds.has(id))) return sequences;
  // The buggy extractor created one ordered reference per beat. Refuse to guess
  // when the structure no longer matches that signature.
  if (references.length !== orderedBeats.length || new Set(references).size !== references.length ||
      currentIds.size !== orderedBeats.length) return sequences;
  const replacements = new Map(references.map((id, index) => [id, orderedBeats[index].id]));
  if (references.some((id) => currentIds.has(id) && replacements.get(id) !== id)) return sequences;
  return sequences.map((sequence) => ({
    ...sequence, beatIds: sequence.beatIds.map((id) => replacements.get(id)!)
  }));
}

export function repairLegacyAdaptation(adaptation: StoryAdaptation): StoryAdaptation {
  if (!Array.isArray(adaptation?.beats) || !Array.isArray(adaptation?.sequences)) return adaptation;
  const beatsById = new Map(adaptation.beats.map((beat) => [beat.id, beat]));
  const sequences = repairSequenceBeatIds(adaptation.beats, adaptation.sequences).map((sequence) => {
    const legacyTitle = /^(The dance|First contact|Invitation|Opening|Atmosphere|Exit \/ resolution|Transition|Conversation|Sequence \d+)$/.test(sequence.title);
    if (!legacyTitle) return sequence;
    const beats = sequence.beatIds.map((id) => beatsById.get(id)).filter((beat): beat is AdaptationBeat => Boolean(beat));
    return { ...sequence, title: sequenceTitle(beats, sequence.order - 1) };
  });
  return { ...adaptation, sequences };
}
