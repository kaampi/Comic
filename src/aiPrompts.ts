import type { LocalAiSettings } from "./localAi";

export const MAX_BEAT_PROMPT_LENGTH = 12000;
export const DEFAULT_BEAT_PROMPT = `Read the passage as a comic adaptation writer. Select the story moments worth dramatizing, rather than mechanically dividing the prose.

A beat is a meaningful change: an action and its consequence, a discovery, a decision, an obstacle, a relationship shift, or an emotionally significant reaction. It may span several sentences or paragraphs and may eventually need several comic panels.

Prioritize events needed to understand the story, revelations and turning points, expressive reactions or meaningful silences, necessary place/time establishments, and visual details whose significance is established in this passage. Quiet moments can matter as much as dramatic action. Do not assume a detail matters later unless the provided text supports it.

Merge prose describing the same coherent event. Do not make one beat per sentence, paragraph or dialogue line. Split when a distinct story change deserves its own beat, not simply because another action verb appears. Preserve the chain of cause, action and reaction. Do not invent events, motives, facts or missing connective scenes.

For each chosen beat, write a concise event summary and a DIFFERENT visual description of one representative drawable instant: visible action, pose/expression, spatial relationships and relevant props. The visual description is staging, not a copy of the prose or a list of all successive actions. Do not put dialogue, captions, internal monologue, lettering or illustration style into it.

Before answering, review the selection as a continuous story. Can the reader understand who does what and why a reaction matters? Restore essential context from the passage, merge repetitions, and remove beats that add no narrative or visual value. Prefer a coherent, considered selection over the greatest number of beats.`;

export function normalizeBeatPrompt(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_BEAT_PROMPT_LENGTH) return undefined;
  const text = value.trim();
  return text === DEFAULT_BEAT_PROMPT ? undefined : text;
}
export function beatPrompt(settings: Pick<LocalAiSettings, 'prompts'>): string {
  return normalizeBeatPrompt(settings.prompts?.beats) ?? DEFAULT_BEAT_PROMPT;
}
