import type { ComicProject } from "./project";
import type { PanelPlan } from "./adaptation/types";
import { activeManuscriptAdaptation, withAdaptation } from "./manuscriptModel";

export function orderedStoryboard(project: ComicProject, chapterId?: string | null, archived = false) {
  const a = activeManuscriptAdaptation(project);
  return a.panelPlans.filter(p => Boolean(p.archived) === archived && (!chapterId ||
    p.chapterId === chapterId || (!p.chapterId && a.beats.some(b => b.chapterId === chapterId && p.sourceBeatIds.includes(b.id)))))
    .sort((a, b) => a.order - b.order);
}
/** Reorder only the selected chapter's slots; other chapters retain their positions. */
export function moveStoryboardPanel(project: ComicProject, panelId: string, targetId: string, chapterId?: string | null) {
  const scope = orderedStoryboard(project, chapterId);
  const from = scope.findIndex(p => p.id === panelId), to = scope.findIndex(p => p.id === targetId);
  if (from < 0 || to < 0 || from === to) return project;
  const [moved] = scope.splice(from, 1); scope.splice(to, 0, moved);
  const ids = new Set(scope.map(p => p.id));
  let index = 0;
  const a = activeManuscriptAdaptation(project);
  const plans = [...a.panelPlans].sort((a, b) => a.order - b.order).map(p => ids.has(p.id) ? { ...scope[index++], order: p.order } : p);
  return withAdaptation(project, { ...a, panelPlans: plans });
}
export function insertStoryboardPanel(project: ComicProject, afterId: string | null, chapterId?: string | null, reaction = false, panelId = `panel-plan-${crypto.randomUUID()}`) {
  const a = activeManuscriptAdaptation(project);
  const plans = [...a.panelPlans].sort((a, b) => a.order - b.order);
  const after = plans.find(p => p.id === afterId);
  const chapterPanels = orderedStoryboard(project, chapterId);
  const last = chapterPanels.at(-1);
  const anchor = after ?? last;
  const panel: PanelPlan = {
    id: panelId, order: 0,
    ...(chapterId || anchor?.chapterId ? { chapterId: chapterId || anchor?.chapterId } : {}),
    sourceBeatIds: [...(anchor?.sourceBeatIds ?? [])],
    title: reaction ? "Ny reaktionsbild" : "Ny bildruta",
    visualDescription: "", characterIds: [...(anchor?.characterIds ?? [])], locationId: anchor?.locationId,
    dialogue: [], captions: [], status: "edited", ...(reaction ? { shotType: "reaction" as const } : {}),
  };
  plans.splice(anchor ? plans.findIndex(p => p.id === anchor.id) + 1 : plans.length, 0, panel);
  return { project: withAdaptation(project, { ...a, panelPlans: plans.map((p, i) => ({ ...p, order: i + 1 })) }), panelId: panel.id };
}
/** Archive without destroying images, prompts, text IDs, or placed page assets. */
export function archiveStoryboardPanel(project: ComicProject, panelId: string, archived: boolean) {
  const a = activeManuscriptAdaptation(project);
  if (!a.panelPlans.some(p => p.id === panelId)) return project;
  return withAdaptation(project, { ...a, panelPlans: a.panelPlans.map(p => p.id === panelId ? { ...p, archived } : p) });
}
