import type { AdaptationBeat, AdaptationSequence, BeatType, PanelDensity, StoryAdaptation } from "./types";

const id = (prefix: string) => prefix + "-" + crypto.randomUUID();

function sentences(text: string): string[] {
  return text.replace(/\r/g, "").split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ"“])/).map((s) => s.trim()).filter(Boolean);
}

function paragraphChunks(text: string): string[] {
  const paras = text.replace(/\r/g, "").split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (paras.length > 1) return paras;
  const all = sentences(text);
  const chunks: string[] = [];
  for (let i = 0; i < all.length; i += 2) chunks.push(all.slice(i, i + 2).join(" "));
  return chunks;
}

function dialogueFrom(text: string) {
  const found: string[] = [];
  const re = /["“]([^"”]+)["”]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) if (match[1].trim()) found.push(match[1].trim());
  return found;
}

function classify(text: string, index: number, total: number): BeatType {
  const t = text.toLowerCase();
  if (index === 0) return "establishing";
  if (dialogueFrom(text).length) return "dialogue";
  if (/turned|looked|smiled|hesitated|felt|heart|eyes/.test(t)) return "reaction";
  if (/left|made their way|outside|night air|later|as the night/.test(t)) return index >= total - 2 ? "resolution" : "transition";
  if (/light|smell|air|atmosphere|room|pub|stage/.test(t)) return "atmosphere";
  return "action";
}

function shortTitle(text: string, type: BeatType, order: number): string {
  const clean = text.replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
  const first = clean.split(/[.!?]/)[0]?.trim() || clean;
  const clipped = first.length > 58 ? first.slice(0, 55).trimEnd() + "…" : first;
  return clipped || `Beat ${order}`;
}

function adaptedCaption(text: string): string | undefined {
  const first = sentences(text).find((s) => !/["“]/.test(s));
  if (!first) return undefined;
  const cleaned = first.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 110) return cleaned;
  const clause = cleaned.split(/[,;:]/)[0]?.trim();
  return clause && clause.length > 18 ? clause + "." : cleaned.slice(0, 105).trimEnd() + "…";
}

function visualSummary(text: string): string {
  const noDialogue = text.replace(/["“][^"”]+["”]/g, "").replace(/\s+/g, " ").trim();
  return noDialogue || text.replace(/\s+/g, " ").trim();
}

export function extractBeats(sourceText: string): AdaptationBeat[] {
  const chunks = paragraphChunks(sourceText);
  return chunks.map((chunk, index) => {
    const type = classify(chunk, index, chunks.length);
    const dialogue = dialogueFrom(chunk);
    const caption = type === "atmosphere" || type === "establishing" || type === "transition" || type === "resolution" ? adaptedCaption(chunk) : undefined;
    return {
      id: id("beat"),
      order: index + 1,
      title: shortTitle(chunk, type, index + 1),
      summary: visualSummary(chunk),
      beatType: type,
      sourceTextExcerpt: chunk,
      characterIds: [],
      dialogueCandidates: dialogue.map((text) => ({ id: id("dialogue"), text, source: "original" as const, selected: true })),
      captionCandidates: caption ? [{ id: id("caption"), text: caption, source: "adapted" as const, style: "narration" as const, selected: true }] : [],
      visualCandidates: [{ id: id("visual"), description: visualSummary(chunk), shotType: type === "establishing" ? "establishing-wide" as const : type === "reaction" ? "close-up" as const : "medium" as const, selected: true }],
      importance: type === "dialogue" || type === "climax" || type === "resolution" ? "high" as const : "medium" as const,
      visualPriority: type === "atmosphere" ? "medium" as const : "high" as const,
      density: "normal" as PanelDensity,
      targetPanelCount: 1,
      status: "suggested" as const
    };
  });
}

function sequenceTheme(beat: AdaptationBeat): string {
  if (beat.beatType === "establishing" || beat.beatType === "atmosphere") return "opening";
  if (beat.beatType === "transition" || beat.beatType === "resolution") return "transition";
  if (beat.beatType === "dialogue" || beat.beatType === "reaction") return "conversation";
  return "action";
}

export function sequenceTitle(beats: AdaptationBeat[], index: number): string {
  // Use the current manuscript rather than titles from a particular example story.
  const first = beats.find((beat) => beat.sourceTextExcerpt.trim());
  return first ? `${index + 1} · ${shortTitle(first.sourceTextExcerpt, first.beatType, first.order)}` : `Sequence ${index + 1}`;
}

export function buildSequences(beats: AdaptationBeat[]): AdaptationSequence[] {
  const groups: AdaptationBeat[][] = [];
  let current: AdaptationBeat[] = [];
  let currentTheme = "";

  for (const beat of beats) {
    const theme = sequenceTheme(beat);
    const hardBreak = beat.beatType === "transition" || beat.beatType === "resolution";
    const themeChanged = current.length > 0 && theme !== currentTheme;
    const tooLong = current.length >= 8;

    if (current.length && (themeChanged || tooLong || (hardBreak && current.length >= 2))) {
      groups.push(current);
      current = [];
    }

    current.push(beat);
    currentTheme = theme;

    if (hardBreak) {
      groups.push(current);
      current = [];
      currentTheme = "";
    }
  }
  if (current.length) groups.push(current);

  return groups.map((group, index) => {
    const theme = sequenceTheme(group[0]);
    const density: PanelDensity = theme === "opening" ? "compact" : "normal";
    const factor = density === "compact" ? .75 : .9;
    return {
      id: id("sequence"),
      order: index + 1,
      title: sequenceTitle(group, index),
      beatIds: group.map((b) => b.id),
      density,
      preferredPanelCount: Math.max(1, Math.round(group.length * factor)),
      allowReactionShots: false,
      allowAtmospherePanels: density !== "compact",
      allowSilentPanels: false
    };
  });
}

export function createAdaptation(name: string, sourceText: string, previous?: StoryAdaptation | null): StoryAdaptation {
  const now = new Date().toISOString();
  const previousByExcerpt = new Map<string, AdaptationBeat[]>();
  for (const beat of previous?.beats ?? []) {
    const key = beat.sourceTextExcerpt.trim();
    previousByExcerpt.set(key, [...(previousByExcerpt.get(key) ?? []), beat]);
  }
  const beats = extractBeats(sourceText).map((beat) => {
    // Consume each match once, so repeated paragraphs still have distinct IDs.
    const match = previousByExcerpt.get(beat.sourceTextExcerpt.trim())?.shift();
    return match ? { ...beat, id: match.id } : beat;
  });
  return {
    id: id("adaptation"),
    name,
    sourceText,
    createdAt: now,
    updatedAt: now,
    status: "beats-generated",
    beats,
    sequences: [],
    panelPlans: [],
    imagePrompts: []
  };
}
