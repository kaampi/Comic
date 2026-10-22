import type { AdaptationBeat } from "./adaptation/types";

/** Merge consecutive, unapplied proposals; the exact enclosing source remains reviewable. */
export function mergeBeatProposals(beats: AdaptationBeat[], ids: string[], source: string): AdaptationBeat[] {
  const wanted = new Set(ids);
  const indices = beats.flatMap((beat, i) => wanted.has(beat.id) ? [i] : []);
  if (wanted.size < 2 || indices.length !== wanted.size || indices.at(-1)! - indices[0] + 1 !== indices.length) {
    throw new Error("Select at least two consecutive proposals to merge.");
  }
  const selected = indices.map(i => beats[i]);
  const first = selected[0];
  if (selected.some(b => b.chapterId !== first.chapterId || b.sourceSceneId !== first.sourceSceneId || b.sourceNeedsReview || !Number.isSafeInteger(b.sourceStart) || !Number.isSafeInteger(b.sourceEnd) || b.sourceStart! < 0 || b.sourceEnd! <= b.sourceStart! || b.sourceEnd! > source.length || source.slice(b.sourceStart, b.sourceEnd) !== b.sourceTextExcerpt)) {
    throw new Error("The proposals must have current source references in the same scene and chapter.");
  }
  const start = Math.min(...selected.map(b => b.sourceStart!));
  const end = Math.max(...selected.map(b => b.sourceEnd!));
  const unique = <T extends {id:string}>(values:T[]) => [...new Map(values.map(value => [value.id, value])).values()];
  const visuals = unique(selected.flatMap(b => b.visualCandidates));
  const preferred = visuals.find(v => v.selected)?.id;
  const merged: AdaptationBeat = {
    ...first, sourceStart:start, sourceEnd:end, sourceTextExcerpt:source.slice(start,end),
    summary:selected.map(b=>b.summary).join('\n\n'),
    adaptationReason:selected.map(b=>b.adaptationReason).filter(Boolean).join('\n\n'),
    characterIds:[...new Set(selected.flatMap(b=>b.characterIds))],
    locationId:selected.every(b=>b.locationId===first.locationId)?first.locationId:undefined,
    unresolvedCharacters:[...new Set(selected.flatMap(b=>b.unresolvedCharacters??[]))],
    unresolvedLocation:selected.every(b=>b.unresolvedLocation===first.unresolvedLocation)?first.unresolvedLocation:undefined,
    dialogueCandidates:unique(selected.flatMap(b=>b.dialogueCandidates)),
    captionCandidates:unique(selected.flatMap(b=>b.captionCandidates)),
    visualCandidates:visuals.map(v=>({...v,selected:v.id===preferred})),
    // Merging story moments does not define their visual panel breakdown.
    targetPanelCount:1,
  };
  return [...beats.slice(0,indices[0]),merged,...beats.slice(indices.at(-1)!+1)].map((b,i)=>({...b,order:i+1}));
}
