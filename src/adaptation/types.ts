export type PanelDensity = "compact" | "normal" | "cinematic";
export type BeatType = "establishing" | "introduction" | "action" | "dialogue" | "reaction" | "transition" | "atmosphere" | "climax" | "resolution";
export type TextOrigin = "original" | "adapted" | "ai-generated";
export type ShotType = "wide" | "establishing-wide" | "medium" | "medium-close" | "close-up" | "extreme-close-up" | "over-shoulder" | "reaction" | "insert" | "full-shot";

export type AlbumPromptStyle = { medium: string; lines: string; color: string; texture: string };
export type PromptDirection = {
  cameraAngle?: string;
  lens?: string;
  depthOfField?: string;
  focalPoint?: string;
  setting?: string;
  lighting?: string;
  continuity?: string;
  characterActions?: Record<string, string>;
  effects?: string[];
  effectStrength?: "subtle" | "normal" | "strong";
  effectScope?: "background" | "subjects" | "whole-image";
  lockShot?: boolean;
  lockAngle?: boolean;
};
export type PanelSizeHint = "small" | "medium" | "large" | "full-width" | "splash";

export type DialogueCandidate = {
  id: string;
  speaker?: string;
  text: string;
  source: TextOrigin;
  selected?: boolean;
};

export type CaptionCandidate = {
  id: string;
  text: string;
  source: TextOrigin;
  style: "narration" | "inner-monologue" | "time-place";
  selected?: boolean;
};

export type VisualCandidate = {
  id: string;
  description: string;
  shotType?: ShotType;
  selected?: boolean;
};

export type AdaptationBeat = {
  id: string;
  order: number;
  title: string;
  summary: string;
  beatType: BeatType;
  sourceTextExcerpt: string;
  sourceStart?: number;
  sourceEnd?: number;
  origin?: "heuristic" | "ai-generated";
  sourceNeedsReview?: boolean;
  characterIds: string[];
  locationId?: string;
  dialogueCandidates: DialogueCandidate[];
  captionCandidates: CaptionCandidate[];
  visualCandidates: VisualCandidate[];
  importance: "low" | "medium" | "high";
  visualPriority: "low" | "medium" | "high";
  density: PanelDensity;
  targetPanelCount: number;
  status: "suggested" | "approved" | "discarded";
};

export type AdaptationSequence = {
  id: string;
  order: number;
  title: string;
  beatIds: string[];
  density: PanelDensity;
  preferredPanelCount: number;
  allowReactionShots: boolean;
  allowAtmospherePanels: boolean;
  allowSilentPanels: boolean;
};

export type PanelDialogue = {
  id: string;
  speaker?: string;
  text: string;
  bubbleType: "speech" | "thought";
  source: TextOrigin;
};

export type PanelCaption = {
  id: string;
  text: string;
  source: TextOrigin;
  style: "narration" | "time-place" | "inner-monologue";
};

export type PanelPlan = {
  id: string;
  sequenceId?: string; // Read older projects; new panels are linked directly to beats.
  sourceBeatIds: string[];
  order: number;
  title: string;
  purpose?: string;
  shotType?: ShotType;
  sizeHint?: PanelSizeHint;
  pacingRole?: "setup" | "progression" | "accent" | "climax" | "release";
  visualDescription: string;
  promptDirection?: PromptDirection;
  characterIds: string[];
  locationId?: string;
  dialogue: PanelDialogue[];
  captions: PanelCaption[];
  imagePromptId?: string;
  status: "suggested" | "approved" | "edited";
  sourceNeedsReview?: boolean;
  image?: PanelImage;
  imageVersions?: PanelImage[];
};

export type PanelImage = { flipX?: boolean; flipY?: boolean; rotation?: number; positionMode?: "frame"; name: string; dataUrl: string; zoom?: number; offsetX?: number; offsetY?: number; fit?: "cover" | "contain" };

export type ImagePrompt = {
  id: string;
  panelId: string;
  mode: "short" | "medium" | "full";
  prompt: string;
  negativePrompt?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoryAdaptation = {
  id: string;
  name: string;
  sourceText: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "beats-generated" | "sequenced" | "panels-generated" | "prompts-generated";
  beats: AdaptationBeat[];
  sequences: AdaptationSequence[];
  panelPlans: PanelPlan[];
  imagePrompts: ImagePrompt[];
};



