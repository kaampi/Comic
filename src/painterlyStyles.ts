import type { IllustrationStyle } from "./stylesLibrary";

const noText = 'No speech bubbles, comic panel borders, text boxes, or lettering.';
const colorOnly = 'Render exclusively in color. Preserve subtle chromatic variation even in shadows and low-saturation passages. No monochrome, grayscale, black-and-white, or uniform sepia treatment.';
const neutralGray = 'Render exclusively in black, white, and neutral grayscale. No color, beige paper, sepia, tinted highlights, or selective color.';
const halftoneBase = `Visual Style & Medium:
A 2D vintage graphic novel and indie comic illustration with a tactile, analog print aesthetic. Clear, dark, slightly textured ink contours with natural hand-drawn variation in line weight. Combine confident outlines with selective finer sketch marks. Flat matte fills, with all intermediate shading and tonal transitions created through clearly visible Ben-Day-style dots, halftone screens, and patterned stippling. No smooth digital gradients.

Drawing & Shading:
A deliberately flat, graphic interpretation of the requested scene. Preserve recognizable characters, expressions, actions, and essential objects. Use readable forms and graphic value design while respecting the panel camera and perspective. Represent cast shadows, contact shadows, and recessed areas through solid ink accents and controlled dot patterns. Vary dot size, density, and spacing to create distinct tonal values. Keep the printed dots visible at the intended viewing size without obscuring faces or small details.

Print Texture & Surface:
Visible paper fibers, fine grain, subtle ink spread, occasional broken ink edges, and restrained print wear. Small scuffs and irregularities create a lived-in quality while preserving clean visual storytelling. Let the paper show through highlights and selected open areas without replacing the requested environment with an empty background. The finish evokes alternative comics, indie animation, and printed ephemera of the 1980s–1990s.

Rendering Constraints:
Traditional-looking ink and printed halftone textures. No glossy 3D rendering or airbrushed shading. Panel camera and effects remain separately controlled. ${noText}`;
const halftoneColor = `Color Mode:
Use a matte, muted retro palette of dusty reds, faded blues, subdued ochres, and restrained greens, printed on warm off-white or pale beige paper. Preserve clear separation between the limited colors. Build shading with visible colored or black halftone dots over flat fills. Keep the paper tone subtle enough that the palette retains distinct hues.`;
const halftoneGray = `Color Mode:
Render entirely in black, white, and neutral grayscale on white or pale neutral-gray paper. Build intermediate gray values through visible black halftone dots and patterned stippling, with solid black accents and exposed paper highlights. Preserve strong tonal separation between characters and their surroundings. No color, beige paper, sepia, or tinted grays.`;

export const PAINTERLY_STYLES: IllustrationStyle[] = [
  {
    id: 'paint-gritty-dark-fantasy', previewImage: '/Styles/Painterly/paint-gritty-dark-fantasy-color.jpg', name: 'Textured cinematic oil painting', panelDefaults: { lens: '35mm', depthOfField: 'shallow', effects: ['motion_blur', 'lens_flare'], effectStrength: 'subtle', effectScope: 'background' }, genre: 'Painterly / Traditional', supportedColorModes: ['color'],
    promptText: `Style & Medium:
A richly textured oil-painted illustration with highly visible, distinct brushwork and fine organic sketch-like linework. The requested scene is rendered with a thick, expressive painterly hand while preserving the specified character designs, anatomy and expressions. Prominent brushstrokes, impasto textures, loose gestural scrapes, and dry-brush marks remain evident throughout environment, clothing, and background. Visible paint layering gives the surface a thick, tactile quality. Convincing form and expressive faces, preserving the specified proportions, anatomy, species and emotions. No harsh thick ink outlines or cartoonish effects; contours are integrated and defined by layered paint.

Material Rendering:
Thick painterly texture remains highly visible across focal details and supporting surfaces. Form is built through layered pigment, gestural marks and controlled edge definition. Camera, optical focus and effects are supplied by the panel settings.

Lighting & Contrast:
Naturalistic dramatic chiaroscuro. Dense soft-edged shadows filled with believable environmental bounce light from scene-appropriate sources such as twilight, dim indoor lamps, or firelight. Light interacts with clothing, damp skin, and thick brush strokes. Render specified light sources through layered pigment and controlled value contrast without adding luminous objects or wet surfaces.

Details & Texture:
Surface detail follows the requested subjects and environment. Do not add weather, injuries, dampness, fatigue, smoke or dirt unless specified. Rich tactile surfaces with prominent impasto, visible paint layering, and artistic grit.

Palette:
Desaturated, organic, muddy cinematic colors: deep charcoal, slate, dark rust, and mossy greens, broken by rich incandescent orange or fiery gold lighting from realistic sources. Visible strokes of warm highlights catch heavy surface textures. Color rendering is essential: retain subtle chromatic variation even in the darkest areas. ${colorOnly} ${noText}`
  },
  {
    id: 'paint-zorn-alla-prima', previewImage: '/Styles/Painterly/paint-zorn-alla-prima-color.jpg', name: 'Zorn-inspired alla prima', genre: 'Painterly / Traditional', supportedColorModes: ['color'],
    promptText: `Visual Style & Medium:
An expressive alla prima oil painting on canvas with economical bravura brushwork. A restricted earthy palette based on yellow ochre, warm vermilion red, ivory black, and warm white. Natural skin tones, subdued earth colors, muted olive greens, and cool-looking neutral grays through careful mixing and relative color contrast. No bright artificial colors, saturated blues, or neon hues.

Artistic Techniques & Brushwork:
An alla prima (wet-on-wet) appearance with bold, loose, confident brushwork. Large, sweeping, gestural flat-brush strokes describe forms economically while preserving the requested anatomy, proportions, expressions and essential scene details. Strong lost-and-found edges: selected contours dissolve into adjacent shadows or surroundings while focal details remain defined. Reserve rich impasto for concentrated highlights, catchlights, and glinting reflections where appropriate. Traditional textured oil paint with visible canvas tooth and distinct brush marks. No hard ink outlines, airbrushed surfaces, or glossy digital rendering.

Light & Atmosphere:
Sensitive dramatic light appropriate to the scene: filtered daylight, shimmering backlight, subdued interior illumination, or warm lamplight. Luminous highlights, rich softly connected shadows, and subtle reflected color. Quick economical marks convey changing light on skin, fabrics, and surrounding surfaces. When water is present, suggest movement and reflections with loose shimmering strokes. Preserve the specified time of day and lighting.

Composition & Characters:
Candid, unposed composition with believable weight, fluid movement, and figures integrated into surroundings. Preserve requested characters, actions, clothing, and setting. Guide attention through selective detail, edge control, and tonal contrast. Background depth through simplified brushwork and softened edges rather than photographic lens blur. Tactile atmospheric unity across outdoor and interior scenes.

Color Mode:
Preserve subtle warm and cool relationships using the restricted earthy palette. ${colorOnly} ${noText}`
  },
  {
    id: 'paint-broken-color', previewImage: '/Styles/Painterly/paint-broken-color-color.jpg', name: 'Expressive broken color', genre: 'Painterly / Traditional', supportedColorModes: ['color'],
    promptText: `Visual Style & Medium:
A vibrant highly expressive painting combining impressionist light with post-impressionist color and mark-making. A deliberate handmade off-registration aesthetic: loose fragmented colored-pencil or faint ink contours playfully offset from painted shapes. Color may overlap, extend beyond, or occasionally ignore sketch lines while preserving readable figures, actions, and essential details.

Artistic Techniques & Brushwork:
Heavily textured broken-color brushwork from rapid short strokes, spontaneous dabs, flecks, and patches of unblended pigment. Occasional pointillist passages and thicker impasto accents. Adjacent marks interact visually instead of smooth blending. Selective splatters, dry-brush marks, and irregular paint edges create spontaneity. Color drifts beyond selected contours without obscuring faces or important objects. Offsets resemble expressive mixed-media painting, not digital glitches or duplicated images.

Color & Light:
A lively richly saturated palette with strong warm–cool relationships. Where appropriate, contrast sunlit ambers, yellows, and oranges with blues, purples, and greens. Translate specified lighting into adjacent dots, streaks, and patches suggesting shimmer, atmosphere, and movement. Preserve time of day and light sources; do not impose daylight on night or interior scenes. Shadows use varied chromatic strokes instead of uniform black fills.

Texture & Ground:
Visible canvas weave or rough paper beneath overlapping paint and sketch marks. Thin passages and exposed ground contrast with raised highlights and dense accents. Selected boundaries dissolve into light and movement while retaining a clear focal subject. Analog tactile finish full of energy and colorful imperfections. No airbrushed surfaces or glossy digital rendering.

Color Mode:
Contrasting hues, broken color, and visible unblended pigments are essential. ${colorOnly} ${noText}`
  },
  {
    id: 'draw-expressive-charcoal', linePreviewImage: '/Styles/Painterly/draw-expressive-charcoal-gray.jpg', name: 'Expressive charcoal drawing', genre: 'Drawing / Print', supportedColorModes: ['grayscale'], reinforceAfterScene: true,
    promptText: `An intentionally rough, unfinished charcoal value study on toothy white paper. Block in the requested scene with the broad side of thick charcoal sticks. Large blunt black and gray masses, vigorous broken strokes, rubbed smudges and broad erased white gaps dominate every subject. Radically simplify the scene rather than rendering all described surface detail.

Build each person from a few chunky connected tonal shapes. Heads are roughly rubbed ovals with only two or three blunt marks suggesting the face. Hands are dark blunt masses; hair and clothing are broad smudged shapes with at most a few emphatic folds. Preserve identities and age cues through silhouette, hair shape, clothing and posture. Animals and machines use equally coarse body blocks and only a few identifying structural accents. Keep the requested cast, species, anatomy, scale, staging, actions and emotions recognizable without finishing faces or small features.

Group all scenery into large loose value patches with substantial open paper. Nothing is drawn more finely than the figures: no portrait rendering, precise fingers, clean outlines, garment patterns, individual leaves, fur, mechanical micro-detail or tiny surface marks. Suggest every complex material with a few blunt charcoal gestures. Maintain deliberately unresolved, ragged and smudged edges, coarse mark scale and paper gaps across the whole image. Preserve the specified lighting as broad light and dark masses. ${neutralGray} ${noText}`
  },
  {
    id: 'paint-neo-expressionist', previewImage: '/Styles/Painterly/paint-neo-expressionist-color.jpg', name: 'Cinematic palette-knife expressionism', genre: 'Painterly / Traditional', supportedColorModes: ['color'],
    promptText: `Visual Style & Medium:
A dramatic highly expressive digital oil painting with heavy visible brushwork, raised impasto, and dynamic palette-knife strokes. Forms defined through bold color planes, decisive value shifts, and textured paint edges. Raw gestural neo-expressionism with convincing anatomy and readable expressions. No ink outlines or conventional comic line art.

Color & Lighting:
A rich moody palette contrasting cool petroleum grays, muted blues, and dark olive greens with concentrated burnt-orange, crimson, and vivid teal accents. Chromatic variation throughout shadows and neutral passages. Cinematic chiaroscuro and selective rim light appropriate to scene light sources. Carefully placed color contrasts and luminous accents guide attention. Bold streaks and occasional splatters add tension without obscuring faces or actions.

Texture & Rendering:
Thick layered paint, canvas grain, palette-knife ridges, scraped passages, dry-brush drag, and gritty irregular edges. Coarse abstraction in peripheral areas contrasts with focused expressive realism in faces, hands, and important objects. Vary thickness and mark size for depth and visual hierarchy. No smooth airbrushing, plastic surfaces, or polished photographic rendering.

Atmosphere & Composition:
An artfully unpolished finish whose marks respond to the specified emotion and scene. Preserve setting, period, characters and events without imposing melancholy, tension or a dystopian setting. Keep action readable within energetic marks and abstract surroundings.

Color Mode:
Cool subdued hues and intense warm or teal accents are essential. ${colorOnly} ${noText}`
  },
  {
    id: 'paint-east-asian-silk', previewImage: '/Styles/Painterly/paint-east-asian-silk-color.jpg', name: 'East Asian ink and mineral color', genre: 'Painterly / Traditional', supportedColorModes: ['color'], decorativeSeals: true,
    promptText: `Visual Style & Medium:
A traditional East Asian painting inspired by Chinese guohua ink painting and Japanese nihonga mineral-pigment techniques on aged weathered silk. Warm golden-brown support with fine fabric weave, subtle patina, occasional historical creases, and restrained wear. Preserve the requested aspect ratio, evoking a hanging scroll without forcing vertical format or adding an external scroll frame.

Brushwork & Ink:
Expressive calligraphic contours in soot-black and softened brown-black ink, varied line weights, selective dry-brush passages. Precise strokes, translucent ink washes, softly diffused edges. Flattened forms, layered spatial arrangements, and atmospheric negative space rather than Western linear perspective or sculptural 3D shading. Depth through overlap, scale changes, distant washes, and untouched silk.

Color Palette:
Faded mineral and plant-derived colors: malachite greens, cinnabar reds, azurite and slate blues, warm earth ochres. Delicate translucent washes and selected denser accents allow silk texture and underlying ink to show through. Preserve distinct pigment hues against warm support; avoid a uniform sepia wash.

Scene & Atmosphere:
Interpret requested characters, actions, objects, and setting through elegant brush rhythms, restrained detail, and balance of forms and open space. Apply the brush language to the actual specified environment without adding traditional landscape motifs. Do not introduce mountains, waterfalls, or tiny distant figures unless suited to the scene. Keep important characters and actions readable.

Decorative Elements:
Where space permits, sparse vertical calligraphic brush marks and a few small red artist or collector seal impressions in peripheral areas. Decorative elements without required readable wording. Keep away from faces and essential details.

Color Mode & Finish:
Color with warm silk patina, subtle mineral pigments, and red seals. No grayscale or black-and-white. Traditional ink-and-pigment textures only. No digital gradients, photorealistic lens effects, glossy rendering, speech bubbles, comic panel borders, or narrative text boxes.`
  },
  {
    id: 'print-vintage-halftone', previewImage: '/Styles/Painterly/print-vintage-halftone-color.jpg', linePreviewImage: '/Styles/Painterly/print-vintage-halftone-gray.jpg', name: 'Vintage indie halftone comic', genre: 'Drawing / Print', supportedColorModes: ['color', 'grayscale'],
    promptText: halftoneBase + '\n\n' + halftoneColor,
    modePromptText: { color: halftoneBase + '\n\n' + halftoneColor, grayscale: halftoneBase + '\n\n' + halftoneGray }
  }
];

