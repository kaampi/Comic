import type { ComicProject } from "./project";
import type {
  AdaptationBeat,
  PanelPlan,
  StoryAdaptation,
} from "./adaptation/types";
import { extractBeats } from "./adaptation/extract";
import { panelForBeat } from "./adaptation/panelize";
import { buildImagePrompt } from "./adaptation/prompts";

export type TextRange = { start: number; end: number };
const id = (prefix: string) => prefix + "-" + crypto.randomUUID();
export function anchorBeats(
  source: string,
  beats: AdaptationBeat[],
): AdaptationBeat[] {
  let cursor = 0;
  return beats.map((beat) => {
    const start = beat.sourceStart,
      end = beat.sourceEnd;
    if (
      typeof start === "number" &&
      typeof end === "number" &&
      start >= 0 &&
      end >= start &&
      end <= source.length &&
      (beat.sourceNeedsReview ||
        source.slice(start, end) === beat.sourceTextExcerpt)
    ) {
      cursor = end;
      return beat;
    }
    const excerpt = beat.sourceTextExcerpt;
    const found = excerpt ? source.indexOf(excerpt, cursor) : -1;
    if (found >= 0) {
      cursor = found + excerpt.length;
      return { ...beat, sourceStart: found, sourceEnd: found + excerpt.length };
    }
    return {
      ...beat,
      sourceStart: undefined,
      sourceEnd: undefined,
      sourceNeedsReview: true,
    };
  });
}
export function activeManuscriptAdaptation(
  project: ComicProject,
): StoryAdaptation {
  const source = project.source.textSnapshot ?? "";
  const previous = project.adaptations[0];
  if (previous)
    return { ...previous, beats: anchorBeats(source, previous.beats) };
  const now = new Date().toISOString();
  return {
    id: id("adaptation"),
    name: project.title + " – adaptation",
    sourceText: source,
    createdAt: now,
    updatedAt: now,
    status: "draft",
    beats: [],
    sequences: [],
    panelPlans: [],
    imagePrompts: [],
  };
}
export function withAdaptation(
  project: ComicProject,
  adaptation: StoryAdaptation,
): ComicProject {
  const sceneId = "scene-adaptation-" + adaptation.id;
  const sourcePanels = adaptation.panelPlans.map((plan) => {
    const previous = project.panels.find(
      (panel) => panel.adaptationPanelPlanId === plan.id,
    );
    const old = project.adaptations
      .find((item) => item.id === adaptation.id)
      ?.panelPlans.find((item) => item.id === plan.id);
    const dialogue = plan.dialogue.map((item) => item.text).join("\n");
    const narration = plan.captions.map((item) => item.text).join("\n");
    const prompt = adaptation.imagePrompts.find(
      (item) => item.panelId === plan.id,
    )?.prompt;
    const oldPrompt = project.adaptations
      .find((item) => item.id === adaptation.id)
      ?.imagePrompts.find((item) => item.panelId === plan.id)?.prompt;
    // Preserve edits in the existing panel/scene workspace unless this plan field changed.
    return {
      ...previous,
      id: previous?.id ?? id("panel"),
      sceneId: previous?.sceneId ?? sceneId,
      order:
        previous && old?.order === plan.order ? previous.order : plan.order,
      action:
        previous && old?.visualDescription === plan.visualDescription
          ? previous.action
          : plan.visualDescription,
      dialogue:
        previous &&
        old?.dialogue.map((item) => item.text).join("\n") === dialogue
          ? previous.dialogue
          : dialogue,
      narration:
        previous &&
        old?.captions.map((item) => item.text).join("\n") === narration
          ? previous.narration
          : narration,
      imagePrompt:
        previous && oldPrompt === prompt
          ? previous.imagePrompt
          : (prompt ?? previous?.imagePrompt ?? ""),
      characterIds:
        previous &&
        old &&
        JSON.stringify(old.characterIds) === JSON.stringify(plan.characterIds)
          ? previous.characterIds
          : plan.characterIds,
      locationId:
        previous && old && old.locationId === plan.locationId
          ? previous.locationId
          : plan.locationId,
      adaptationPanelPlanId: plan.id,
      sourceBeatIds: plan.sourceBeatIds,
    };
  });
  const projectedIds = new Set(sourcePanels.map((panel) => panel.id));
  const panels = [
    ...project.panels.filter((panel) => !projectedIds.has(panel.id)),
    ...sourcePanels,
  ];
  const previousScene = project.scenes.find((scene) => scene.id === sceneId);
  const scene = {
    id: sceneId,
    title: previousScene?.title ?? adaptation.name,
    sourceText: previousScene?.sourceText ?? adaptation.sourceText,
    panelIds: [
      ...(previousScene?.panelIds ?? []).filter((id) =>
        panels.some((panel) => panel.id === id && panel.sceneId === sceneId),
      ),
      ...panels
        .filter(
          (panel) =>
            panel.sceneId === sceneId &&
            !previousScene?.panelIds.includes(panel.id),
        )
        .map((panel) => panel.id),
    ],
  };
  const scenes = sourcePanels.length
    ? previousScene
      ? project.scenes.map((item) => (item.id === sceneId ? scene : item))
      : [...project.scenes, scene]
    : project.scenes;
  return {
    ...project,
    panels,
    scenes,
    pages: project.pages.map((page) => ({
      ...page,
      placements: page.placements.map((placement) => {
        if (placement.image) return placement;
        const planId =
          placement.adaptationPanelPlanId ??
          panels.find((panel) => panel.id === placement.panelId)
            ?.adaptationPanelPlanId;
        const image = adaptation.panelPlans.find(
          (plan) => plan.id === planId,
        )?.image;
        return image ? { ...placement, image } : placement;
      }),
    })),
    adaptations: [
      { ...adaptation, updatedAt: new Date().toISOString() },
      ...project.adaptations.filter((item) => item.id !== adaptation.id),
    ],
  };
}
export function addManualBeat(
  project: ComicProject,
  range: TextRange,
): { project: ComicProject; beatId: string } {
  const source = project.source.textSnapshot ?? "";
  if (
    range.start < 0 ||
    range.end > source.length ||
    range.end <= range.start ||
    !source.slice(range.start, range.end).trim()
  )
    throw new Error("Select manuscript text first.");
  const excerpt = source.slice(range.start, range.end);
  const candidates = extractBeats(excerpt);
  const first = candidates[0];
  const beat: AdaptationBeat = {
    ...first,
    id: id("beat"),
    sourceTextExcerpt: excerpt,
    sourceStart: range.start,
    sourceEnd: range.end,
    title: first.title.slice(0, 60),
    summary: excerpt.replace(/\s+/g, " ").trim(),
    dialogueCandidates: candidates.flatMap((item) => item.dialogueCandidates),
    captionCandidates: candidates.flatMap((item) => item.captionCandidates),
    characterIds: project.characters
      .filter(
        (item) =>
          item.name &&
          excerpt.toLocaleLowerCase().includes(item.name.toLocaleLowerCase()),
      )
      .map((item) => item.id),
    locationId: project.locations.find(
      (item) =>
        item.name &&
        excerpt.toLocaleLowerCase().includes(item.name.toLocaleLowerCase()),
    )?.id,
    visualCandidates: [
      {
        id: id("visual"),
        description: excerpt.replace(/\s+/g, " ").trim(),
        selected: true,
      },
    ],
    origin: "heuristic",
    status: "suggested",
  };
  const adaptation = activeManuscriptAdaptation(project);
  const beats = [...adaptation.beats, beat]
    .sort((a, b) => (a.sourceStart ?? Infinity) - (b.sourceStart ?? Infinity))
    .map((item, index) => ({ ...item, order: index + 1 }));
  return {
    project: ensureBeatPanels(
      withAdaptation(project, {
        ...adaptation,
        beats,
        status: "beats-generated",
      }),
    ),
    beatId: beat.id,
  };
}
/** Keep existing plans/images; AI selections append proposals to the manuscript. */
export function appendAiBeats(
  project: ComicProject,
  proposals: AdaptationBeat[],
): ComicProject {
  const adaptation = activeManuscriptAdaptation(project);
  const beats = [...adaptation.beats];
  for (const proposal of proposals) {
    if (
      !beats.some(
        (beat) =>
          beat.sourceStart === proposal.sourceStart &&
          beat.sourceEnd === proposal.sourceEnd &&
          beat.summary === proposal.summary,
      )
    )
      beats.push(proposal);
  }
  beats.sort(
    (a, b) => (a.sourceStart ?? Infinity) - (b.sourceStart ?? Infinity),
  );
  return ensureBeatPanels(
    withAdaptation(project, {
      ...adaptation,
      beats: beats.map((beat, index) => ({ ...beat, order: index + 1 })),
      status: "beats-generated",
    }),
  );
}
export function editManuscript(
  project: ComicProject,
  nextSource: string,
): ComicProject {
  const previousSource = project.source.textSnapshot ?? "";
  if (previousSource === nextSource) return project;
  let start = 0;
  while (
    start < Math.min(previousSource.length, nextSource.length) &&
    previousSource[start] === nextSource[start]
  )
    start++;
  let oldEnd = previousSource.length,
    newEnd = nextSource.length;
  while (
    oldEnd > start &&
    newEnd > start &&
    previousSource[oldEnd - 1] === nextSource[newEnd - 1]
  ) {
    oldEnd--;
    newEnd--;
  }
  const delta = newEnd - oldEnd;
  const adaptations = project.adaptations.map((adaptation) => {
    const beats = anchorBeats(previousSource, adaptation.beats).map((beat) => {
      if (beat.sourceStart === undefined || beat.sourceEnd === undefined)
        return beat;
      const a = beat.sourceStart,
        b = beat.sourceEnd;
      if (b <= start) return beat;
      if (a >= oldEnd)
        return { ...beat, sourceStart: a + delta, sourceEnd: b + delta };
      const movedStart = a < start ? a : start;
      const movedEnd = b > oldEnd ? b + delta : newEnd;
      return {
        ...beat,
        sourceStart: movedStart,
        sourceEnd: Math.max(movedStart, movedEnd),
        sourceNeedsReview: true,
      };
    });
    const affected = new Set(
      beats.filter((beat) => beat.sourceNeedsReview).map((beat) => beat.id),
    );
    return {
      ...adaptation,
      sourceText: nextSource,
      beats,
      updatedAt: new Date().toISOString(),
      panelPlans: adaptation.panelPlans.map((panel) =>
        panel.sourceBeatIds.some((id) => affected.has(id))
          ? { ...panel, sourceNeedsReview: true }
          : panel,
      ),
    };
  });
  return {
    ...project,
    source: { ...project.source, textSnapshot: nextSource },
    adaptations,
  };
}
export function patchManuscriptBeat(
  project: ComicProject,
  beatId: string,
  patch: Partial<AdaptationBeat>,
): ComicProject {
  const adaptation = activeManuscriptAdaptation(project);
  const previous = adaptation.beats.find((beat) => beat.id === beatId);
  const relinked =
    previous &&
    ((patch.sourceStart !== undefined &&
      patch.sourceStart !== previous.sourceStart) ||
      (patch.sourceEnd !== undefined &&
        patch.sourceEnd !== previous.sourceEnd));
  return withAdaptation(project, {
    ...adaptation,
    beats: adaptation.beats.map((beat) =>
      beat.id === beatId
        ? {
            ...beat,
            ...patch,
            visualCandidates:
              patch.visualCandidates ??
              beat.visualCandidates.map((visual) =>
                patch.summary !== undefined &&
                visual.description === beat.summary
                  ? { ...visual, description: patch.summary }
                  : visual,
              ),
          }
        : beat,
    ),
    panelPlans: relinked
      ? adaptation.panelPlans.map((panel) =>
          panel.sourceBeatIds.includes(beatId)
            ? { ...panel, sourceNeedsReview: true }
            : panel,
        )
      : adaptation.panelPlans,
  });
}
export function addBeatPanel(
  project: ComicProject,
  beatId: string,
): ComicProject {
  const adaptation = activeManuscriptAdaptation(project);
  const beat = adaptation.beats.find((item) => item.id === beatId);
  if (!beat) return project;
  const variation = adaptation.panelPlans.filter((panel) =>
    panel.sourceBeatIds.includes(beatId),
  ).length;
  const panel = panelForBeat(beat, adaptation.panelPlans.length + 1, variation);
  return withAdaptation(project, {
    ...adaptation,
    panelPlans: [...adaptation.panelPlans, panel],
    status: "panels-generated",
  });
}
export function patchBeatPanel(
  project: ComicProject,
  panelId: string,
  patch: Partial<PanelPlan>,
): ComicProject {
  const adaptation = activeManuscriptAdaptation(project);
  return withAdaptation(project, {
    ...adaptation,
    panelPlans: adaptation.panelPlans.map((panel) => {
      if (panel.id !== panelId) return panel;
      const merged = { ...panel, ...patch, status: "edited" as const };
      if (
        Object.prototype.hasOwnProperty.call(patch, "image") &&
        panel.image &&
        panel.image.dataUrl !== patch.image?.dataUrl
      ) {
        merged.imageVersions = [
          ...(panel.imageVersions ?? []).filter(
            (image) =>
              image.dataUrl !== panel.image!.dataUrl &&
              image.dataUrl !== patch.image?.dataUrl,
          ),
          panel.image,
        ];
      }
      return merged;
    }),
  });
}
export function generateBeatPanelPrompt(
  project: ComicProject,
  panelId: string,
): ComicProject {
  const adaptation = activeManuscriptAdaptation(project);
  const panel = adaptation.panelPlans.find((item) => item.id === panelId);
  if (!panel) return project;
  const previous = adaptation.imagePrompts.find(
    (item) => item.panelId === panelId,
  );
  const now = new Date().toISOString();
  const prompt = {
    id: previous?.id ?? id("image-prompt"),
    panelId,
    mode: "full" as const,
    prompt: buildImagePrompt(project, panel),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  return withAdaptation(project, {
    ...adaptation,
    imagePrompts: [
      ...adaptation.imagePrompts.filter((item) => item.panelId !== panelId),
      prompt,
    ],
    panelPlans: adaptation.panelPlans.map((item) =>
      item.id === panelId ? { ...item, imagePromptId: prompt.id } : item,
    ),
  });
}

/** Remove the source beat, retaining independent panels, prompts, images and page layout. */
export function removeManuscriptBeat(
  project: ComicProject,
  beatId: string,
): ComicProject {
  if (!project.adaptations.some((a) => a.beats.some((b) => b.id === beatId)))
    return project;
  const without = (ids: string[]) => ids.filter((id) => id !== beatId);
  return {
    ...project,
    adaptations: project.adaptations.map((a) => ({
      ...a,
      beats: a.beats
        .filter((b) => b.id !== beatId)
        .map((b, index) => ({ ...b, order: index + 1 })),
      sequences: a.sequences.map((sequence) => ({
        ...sequence,
        beatIds: without(sequence.beatIds),
      })),
      panelPlans: a.panelPlans.map((panel) => ({
        ...panel,
        sourceBeatIds: without(panel.sourceBeatIds),
      })),
      updatedAt: new Date().toISOString(),
    })),
    panels: project.panels.map((panel) => ({
      ...panel,
      sourceBeatIds: panel.sourceBeatIds
        ? without(panel.sourceBeatIds)
        : undefined,
    })),
    pages: project.pages.map((page) => ({
      ...page,
      placements: page.placements.map((placement) => ({
        ...placement,
        sourceBeatIds: placement.sourceBeatIds
          ? without(placement.sourceBeatIds)
          : undefined,
      })),
    })),
  };
}

/** Supply one initial panel per active beat, without changing any existing panel. */
export function ensureBeatPanels(project: ComicProject): ComicProject {
  const existing = project.adaptations[0];
  if (!existing) return project;
  const missing = existing.beats.filter(
    (beat) =>
      beat.status !== "discarded" &&
      !existing.panelPlans.some((panel) =>
        panel.sourceBeatIds.includes(beat.id),
      ),
  );
  if (!missing.length) return project;
  return withAdaptation(project, {
    ...existing,
    status: "panels-generated",
    panelPlans: [
      ...existing.panelPlans,
      ...missing.map((beat, index) =>
        panelForBeat(beat, existing.panelPlans.length + index + 1),
      ),
    ],
  });
}
