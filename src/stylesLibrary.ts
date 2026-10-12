import { PAINTERLY_STYLES } from "./painterlyStyles";
import type { ColorMode } from "./styleColorMode";
import type { AlbumPromptStyle, PromptDirection } from "./adaptation/types";

export type IllustrationStyle = {
  id: string; name: string; promptText: string; genre: string;
  previewImage?: string; linePreviewImage?: string;
  supportedColorModes?: ColorMode[];
  modePromptText?: Partial<Record<ColorMode, string>>;
  decorativeSeals?: boolean;
  visualReferences?: string[];
  promptModules?: AlbumPromptStyle;
  panelDefaults?: Pick<PromptDirection, "lens" | "depthOfField" | "effects" | "effectStrength" | "effectScope">;
};

export const STYLE_GROUPS = ["European Comics", "Manga & Japanese Drawing", "Modern Comics", "Painting", "Drawing & Print", "Collage & Graphic Illustration", "Photographic"] as const;
export function styleGroupLabel(group: string, locale: string): string {
  const labels = ["Europeiska serier", "Manga & japansk teckning", "Modern serieteckning", "Måleri", "Teckning & tryck", "Collage & grafisk illustration", "Fotografisk återgivning"];
  const index = STYLE_GROUPS.indexOf(group as typeof STYLE_GROUPS[number]);
  return locale === "sv" && index >= 0 ? labels[index] : group;
}
const sceneRule = "Preserve the requested characters, species, distinctive anatomy, proportions, actions, emotions, objects, setting and story period. Apply this visual language without adding unrelated subjects or locations. No speech bubbles, captions or lettering.";
function profile(id: string, name: string, genre: string, medium: string, lines: string, color: string, texture: string, panelDefaults?: IllustrationStyle["panelDefaults"]): IllustrationStyle {
  const promptModules = { medium: medium + "\n" + sceneRule, lines, color, texture };
  const base = [medium, lines, texture, sceneRule].filter(Boolean).join("\n");
  return { id, name, genre, promptModules, panelDefaults, supportedColorModes: ["color", "grayscale", "line-art"],
    promptText: [base, color].join("\n"), modePromptText: {
      color: [base, color].join("\n"),
      grayscale: base + "\nRender in black, white and neutral grayscale. Translate the shading technique into tonal values; no color or tinted paper.",
      "line-art": [medium, lines, sceneRule, "Render as uncolored black ink contours and appropriate hatching on white paper. No painted fills, color or gray washes."].join("\n"),
    } };
}

const classicReferences: Record<string, string[]> = {
  "fb-1": ["Hergé / ligne claire"], "eu-rounded-caricature": ["Uderzo / Asterix"],
  "eu-economical-figures": ["Morris / Lucky Luke"], "anchor-2": ["Franquin / Spirou"], "er-1": ["Manara"],
};
const retainedPreviewAssets: Record<string, { previewImage?: string; linePreviewImage?: string }> = {
  "fb-1": {
    "previewImage": "/Styles/Franco_Belgian/thumb_ligne_claire.jpg",
    "linePreviewImage": "/Styles/Franco_Belgian/thumb_ligne_claire_lines.jpg"
  },
  "er-1": {
    "previewImage": "/Styles/European_realist/thumb_elegant_european_realism.jpg",
    "linePreviewImage": "/Styles/European_realist/thumb_elegant_european_realism_lines.jpg"
  },
  "noir-1": {
    "previewImage": "/Styles/Crime_Noir/thumb_european_noir.jpg",
    "linePreviewImage": "/Styles/Crime_Noir/thumb_european_noir_lines.jpg"
  },
  "hum-3": {
    "previewImage": "/Styles/Humour_all_ages/childrens_comic_style.jpg",
    "linePreviewImage": "/Styles/Humour_all_ages/thumb_childrens_comic_style_lines.jpg"
  },
  "am-1": {
    "previewImage": "/Styles/American_modern/thumb_american_modern_comic.jpg",
    "linePreviewImage": "/Styles/American_modern/thumb_american_modern_comic_lines.jpg"
  },
  "am-2": {
    "previewImage": "/Styles/American_modern/thumb_indie_graphic_novel.jpg",
    "linePreviewImage": "/Styles/American_modern/thumb_indie_graphic_novel_lines.jpg"
  },
  "am-3": {
    "previewImage": "/Styles/American_modern/thumb_modern_action_comic.jpg",
    "linePreviewImage": "/Styles/American_modern/thumbs_modern_action_comic_lines.jpg"
  },
  "manga-1": {
    "previewImage": "/Styles/Manga/thumb_classic_shonen_manga.jpg"
  },
  "manga-5": {
    "previewImage": "/Styles/Manga/thumb_historical_samurai_manga.jpg",
    "linePreviewImage": "/Styles/Manga/thumb_historical_samurai_manga_lines.jpg"
  },
  "manga-6": {
    "previewImage": "/Styles/Manga/thumb_japanese_seinen_manga.jpg"
  },
  "manga-10": {
    "previewImage": "/Styles/Manga/thumb_shojo_romance_manga.jpg"
  },
  "jp-1": {
    "previewImage": "/Styles/Japanese/thumb_chibi_super_deformed.jpg",
    "linePreviewImage": "/Styles/Japanese/thumb_chibi_super_deformed_lines.jpg"
  },
  "jp-2": {
    "previewImage": "/Styles/Japanese/thumb_gekiga.jpg",
    "linePreviewImage": "/Styles/Japanese/thumb_gekiga_lines.jpg"
  },
  "anchor-2": {
    "previewImage": "/Styles/Franco_Belgian/thumb_dynamic_marcinelle_classic.jpg",
    "linePreviewImage": "/Styles/Franco_Belgian/thumb_dynamic_marcinelle_classic_lines.jpg"
  }
};

// Groups describe the medium and drawing language, never the story genre.
// Existing album snapshots and custom styles are deliberately not migrated.
export const BUILTIN_STYLES: IllustrationStyle[] = [
  profile("fb-1", "Ligne claire", "European Comics", "Clear-line 2D comic illustration.", "Precise, uniform ink contours, minimal hatching, simplified expressive faces and carefully constructed environments. Consistent readable forms and clear silhouettes.", "Flat clean local colors, restrained tonal modeling and clear separation of adjacent shapes.", "Smooth ink and clean printed finish."),
  profile("eu-rounded-caricature", "Rounded expressive caricature", "European Comics", "Hand-inked 2D caricature comic illustration.", "Rounded sculptural shapes, compact character proportions, large expressive features and supple variable-weight brush contours. Lively gestures and detailed but readable scenery. Interpret the specified emotions through expressive exaggeration.", "Rich flat colors with selective simple shadows.", "Crisp hand-inked contours and a restrained printed texture."),
  profile("eu-economical-figures", "Economical elongated cartoon", "European Comics", "Minimal, graphic hand-drawn comic illustration.", "Economical fluid contours, elongated stylized figures, spare facial marks and strongly readable silhouettes. Angular and curved shapes alternate; simplified objects and environments keep the scene readable.", "Broad flat color areas with selective bold color separation and minimal modeling.", "Clean matte printed finish."),
  profile("anchor-2", "Elastic brush-ink cartoon", "European Comics", "Expressive European brush-ink comic illustration.", "Springy gestural drawing, elastic poses, asymmetrical shapes and energetic thick-to-thin brush contours. Expressive hands and faces; intricate but legible object drawing and environmental detail.", "Vibrant controlled local colors with sparse simple shadows.", "Visible hand-inked variation, clean printed color fills."),
  profile("er-1", "Elegant fine-line realism", "European Comics", "Elegant naturalistic fine-line comic illustration.", "Fine flowing contours, delicate contour variation, carefully observed anatomy, supple gestures, subtle facial acting and selective interior detail. Preserve the specified character age, anatomy and expression.", "Soft transparent local colors, nuanced skin or surface tones and restrained modeling.", "Delicate ink with a lightly washed paper finish."),
  profile("manga-1", "Dynamic manga ink", "Manga & Japanese Drawing", "Expressive manga ink illustration.", "Decisive variable-weight contours, angular accents, expressive faces, readable silhouettes and bold shape simplification. Exaggeration follows the requested action and emotion.", "Controlled flat colors and crisp cel-shading.", "Clean ink with selective fine hatching.", { effects: ["speed_lines"], effectStrength: "subtle", effectScope: "background" }),
  profile("manga-6", "Naturalistic manga", "Manga & Japanese Drawing", "Naturalistic manga drawing.", "Carefully observed proportions, controlled fine contours, subtle facial acting, selective dense cross-hatching and detailed environment drawing. Strong separation of light and dark masses.", "Restrained local colors with tonal shading translated from ink structure.", "Fine printed ink, hatching and subtle paper grain."),
  profile("manga-10", "Airy fine-line manga", "Manga & Japanese Drawing", "Delicate fine-line manga illustration.", "Fine tapered contours, large expressive eyes, graceful stylization and airy spacing. Detail is concentrated on the focal characters while supporting forms remain light. Expressions follow the specified emotion.", "Light transparent colors with soft value transitions.", "Fine clean ink and a delicate paper finish."),
  profile("manga-5", "Gestural brush manga", "Manga & Japanese Drawing", "Manga illustration with expressive brush calligraphy.", "Broad-to-fine sweeping ink contours, selectively broken dry-brush edges, strong black shape accents and textured hatching. Gestural anatomy and deliberate expressive silhouettes.", "Restrained color areas supporting the ink structure.", "Tactile brush ink and visible paper tooth."),
  profile("jp-2", "Raw realist ink", "Manga & Japanese Drawing", "Raw expressive realist ink illustration.", "Rough hand-drawn contours, heavy black masses, dense irregular hatching and selectively detailed faces and surfaces. Preserve the requested expressions rather than imposing a dramatic mood.", "A limited palette with strong value separation.", "Rough ink edges and lightly textured paper."),
  profile("jp-1", "Chibi proportions", "Manga & Japanese Drawing", "Super-deformed cartoon illustration.", "Very large heads, compact small bodies, simple readable limbs and oversized expressive facial features. Bold clean contours and sparse supporting detail. Preserve character identity, age cues, species and specified emotions through stylization.", "Clear flat colors with simple cel-shading.", "Clean digital ink and matte color."),
  profile("am-1", "Polished digital comic", "Modern Comics", "Polished digital comic illustration.", "Confident controlled contours, selectively varied line weights, readable anatomy and clear environmental drawing. Fine detail balanced with strong silhouettes.", "Polished digital local colors with layered tonal modeling and crisp shadow boundaries where appropriate.", "Smooth professional digital finish without plastic-looking surfaces."),
  profile("am-3", "Bold sculptural comic", "Modern Comics", "Bold sculptural comic illustration.", "Strong tapered ink, emphatic planes, sculptural anatomy and exaggerated readable forms. Selective detail and decisive contour accents make hands, faces and objects legible.", "Strong color separation, broad shadow masses and crisp tonal planes.", "Crisp heavy ink and smooth matte coloring."),
  profile("am-2", "Loose indie drawing", "Modern Comics", "Loose expressive hand-drawn comic illustration.", "Uneven personal-looking contours, simplified idiosyncratic shapes, economical facial marks and selective sketch detail. Acting and gesture follow the scene rather than a prescribed genre.", "A limited intentional palette with flat or lightly washed fills.", "Visible hand-drawn irregularity and modest paper grain."),
  profile("noir-1", "High-contrast graphic ink", "Modern Comics", "High-contrast graphic comic illustration.", "Controlled outlines, large solid black shapes, selective fine hatching and readable silhouettes. Represent the requested lighting through decisive light and dark design without imposing night or a particular environment.", "Restrained local colors with strong value contrasts.", "Matte ink with crisp graphic shadow shapes."),
  profile("hum-3", "Soft rounded cartoon", "Modern Comics", "Accessible rounded cartoon illustration.", "Soft rounded forms, clear facial features, gently exaggerated proportions and uncluttered readable shapes. Friendly visual language accommodates happiness, fear, anger, grief and other requested emotions.", "Bright soft colors, simple shading and clear separation of forms.", "Clean matte illustration finish."),
  profile("ink-nervous-caricature", "Nervous caricature ink", "Modern Comics", "Expressive caricature ink illustration.", "Nervous uneven contours, angular elongated shapes, exaggerated facial features, elastic poses and deliberately skewed but readable objects. Fine short hatching and stippling contrast with large solid black areas. Expressions follow the requested emotion.", "Limited flat colors organized around the black ink structure.", "Handmade ink irregularities, selective scratch marks and fine stippling."),
  ...PAINTERLY_STYLES.map(style => ({ ...style, genre: style.genre === "Drawing / Print" ? "Drawing & Print" : "Painting" })),
  profile("draw-colored-pencil", "Colored pencil & wax crayon", "Drawing & Print", "Layered colored-pencil and wax-crayon illustration on paper.", "Grainy overlapping strokes, selectively reinforced outlines and simplified readable forms. Directional marks describe surfaces and volumes.", "Layered translucent pencil colors with denser wax accents and visible unfilled paper grain.", "Visible paper tooth, broken pigment marks and waxy stroke texture."),
  profile("print-woodcut", "Woodcut & linocut", "Drawing & Print", "Hand-carved woodcut or linocut print illustration.", "Strong cut contours, bold positive and negative shapes, irregular gouged lines and selective parallel carved hatching.", "A small number of broad spot-color areas with solid ink masses.", "Uneven ink coverage, subtle carved edge variation and absorbent paper."),
  profile("print-risograph", "Risograph overprint", "Drawing & Print", "Risograph-style stencil print illustration.", "Simplified drawn forms and readable layers with restrained edge misregistration.", "Two or three translucent spot inks with visible overprints, granular tonal areas and small registration offsets. Keep faces and essential objects legible.", "Soy-ink-like grain, uneven ink density and matte paper."),
  profile("draw-scratchboard", "Scratchboard", "Drawing & Print", "Scratchboard illustration worked into a dark coated surface.", "Fine light scratches define forms against large dark masses. Directional carved hatching, sharp highlights and selective intricate detail.", "Restrained tinted accents over the dark-and-light structure.", "Incised scratch marks and a matte dark ground."),
  profile("print-engraving", "Fine-line engraving", "Drawing & Print", "Fine-line engraving illustration.", "Precise closely spaced lines and curved cross-hatching follow forms. Controlled line density builds tone; sharply defined details contrast with open paper highlights.", "Restrained translucent color washes over the engraved line structure.", "Fine printed marks and subtle paper fibers."),
  profile("paint-gouache", "Stylized matte gouache", "Painting", "Opaque matte gouache illustration.", "Simplified modeled volumes, soft painted contour edges and selective dry-brush accents. Forms remain readable without ink outlines.", "Opaque color shapes, restrained layered tonal planes and soft painterly color transitions.", "Matte pigment, visible brush edges and lightly textured paper."),
  profile("collage-cut-paper", "Cut-paper collage", "Collage & Graphic Illustration", "Layered cut-paper collage illustration.", "Characters and objects built from cut and torn shapes, deliberate overlaps and simplified readable silhouettes.", "Colored paper areas with visible translucent or opaque layering.", "Paper fibers, torn edges and small contact shadows between physical paper layers."),
  profile("graphic-geometric", "Flat geometric illustration", "Collage & Graphic Illustration", "Flat geometric graphic illustration.", "Simple circles, curves and angular shapes construct figures and objects. Economical features, clear silhouettes and sparse detail.", "A controlled palette of flat color areas with minimal tonal modeling.", "Clean matte graphic surfaces."),
  profile("photo-natural", "Natural photographic rendering", "Photographic", "Photographic rendering of the requested scene, including imaginary or exaggerated subjects.", "Convincing fine surface detail, material response and continuous tonal modeling. Preserve the specified anatomy, species and exaggerated proportions exactly; do not normalize fantastical designs into ordinary humans or animals.", "Natural local colors and believable tonal relationships under the specified lighting.", "Convincing photographic surface detail without a prescribed camera or optical effect."),
  profile("photo-analog", "Analog film rendering", "Photographic", "Analog-film photographic rendering of the requested scene, including imaginary subjects.", "Convincing photographic materials and continuous tonal modeling. Retain the specified anatomy, species, exaggerated proportions and design.", "Gentle film-like tonal roll-off, subtle hue shifts and restrained saturation, respecting the specified lighting.", "Fine analog film grain and a tactile photographic finish."),
  profile("photo-cinematic", "Cinematic photographic rendering", "Photographic", "Cinematic photographic rendering of the requested scene, including unreal or exaggerated subjects.", "Convincing material detail, controlled tonal hierarchy and readable surface modeling. Preserve requested anatomy, species and proportions without normalization.", "Coherent film-like color grading and controlled highlight roll-off while preserving scene colors, time of day and lighting.", "Polished photographic detail with restrained fine grain."),
].map(style => ({ ...style, ...retainedPreviewAssets[style.id], ...(classicReferences[style.id] ? { visualReferences: classicReferences[style.id] } : {}) })).map(style => style.genre === "Photographic" ? { ...style, supportedColorModes: ["color", "grayscale"] as ColorMode[] } : style);

export const STYLE_GENRES = [...new Set(BUILTIN_STYLES.map(style => style.genre))];
export function albumStyleModules(style: IllustrationStyle): AlbumPromptStyle {
  return { medium: style.promptText, lines: "", color: "", texture: "", ...style.promptModules };
}
export function newPanelStyleDirection(style: IllustrationStyle): PromptDirection | undefined {
  if (!style.panelDefaults || !Object.keys(style.panelDefaults).length) return undefined;
  return { ...style.panelDefaults, ...(style.panelDefaults.effects ? { effects: [...style.panelDefaults.effects] } : {}),
    styleDefaultKeys: Object.keys(style.panelDefaults), styleDefaultName: style.name };
}
const CUSTOM_STYLES_KEY = "comicbook-ai.custom-styles";
export function readCustomStyles(): IllustrationStyle[] {
  try { const parsed = JSON.parse(localStorage.getItem(CUSTOM_STYLES_KEY) ?? "[]"); return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.promptText === "string" && typeof item.genre === "string") : []; } catch { return []; }
}
export function saveCustomStyles(styles: IllustrationStyle[]): void { try { localStorage.setItem(CUSTOM_STYLES_KEY, JSON.stringify(styles)); } catch {} }
export function createCustomStyleId(): string { return "custom-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }
