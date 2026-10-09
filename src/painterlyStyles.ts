import type { IllustrationStyle } from "./stylesLibrary";

const noText = 'No speech bubbles, comic panel borders, text boxes, or lettering.';
const colorOnly = 'Render exclusively in color. Preserve subtle chromatic variation even in shadows and low-saturation passages. No monochrome, grayscale, black-and-white, or uniform sepia treatment.';
const neutralGray = 'Render exclusively in black, white, and neutral grayscale. No color, beige paper, sepia, tinted highlights, or selective color.';
const cinematicBase = `Visual Style & Medium:
A highly detailed, cinematic digital painting in a rich contemporary graphic novel style, filled with natural atmospheric depth, textured brushwork, and fine, textured, sketch-like linework with variable weights. Blend the lines seamlessly into heavily layered digital paint. No flat comic fills or thick, uniform outlines.

Light & Texture:
Use dramatic light appropriate to the scene, with volumetric sunbeams and luminous rim light where motivated by the light sources. Atmospheric haze, restrained bloom, and glinting dust or leaves catch the light where appropriate. Soft reflected light reveals faces, clothing, and surfaces within the shadows. Preserve detail in both bright and dark areas. Dense environmental details, visible painterly textures, natural grit, subtle film grain or paper overlay, and soft ambient occlusion in crevices.

Composition & Cinematic Quality:
Preserve the requested characters, actions, objects, and setting. Use dynamic framing when appropriate to the action. A high-production-value animated-film aesthetic with cinematic depth of field, selective motion blur on moving elements, and soft defocus in distant backgrounds. Keep important characters readable through tonal separation. Distant detail softens through atmospheric perspective; focal subjects retain sharper detail.
${noText}`;
const cinematicColor = `Color & Light:
A rich, saturated, warm palette with fiery orange, deep amber, rust, and warm shadows where appropriate to the scene. For sunset scenes, use glowing golden-hour backlight and natural warm bounce light. Preserve the specified time of day and lighting conditions.`;
const cinematicGray = `Monochrome Light & Tone:
Render entirely in black, white, and neutral shades of gray, with rich tonal gradations, deep charcoal shadows, and luminous highlights. Translate golden-hour light, when appropriate to the scene, into glowing backlight, layered midtones, and soft reflected light. Distinguish clothing and objects through carefully controlled grayscale values and textures. Maintain continuous painterly tonal transitions rather than a binary ink treatment. ${neutralGray}`;

const halftoneBase = `Visual Style & Medium:
A 2D vintage graphic novel and indie comic illustration with a tactile, analog print aesthetic. Clear, dark, slightly textured ink contours with natural hand-drawn variation in line weight. Combine confident outlines with selective finer sketch marks. Flat matte fills, with all intermediate shading and tonal transitions created through clearly visible Ben-Day-style dots, halftone screens, and patterned stippling. No smooth digital gradients.

Drawing & Shading:
A deliberately flat, graphic interpretation of the requested scene. Preserve recognizable characters, expressions, actions, and essential objects. Use readable compositions and simplified spatial depth without exaggerated cinematic perspective. Represent cast shadows, contact shadows, and recessed areas through solid ink accents and controlled dot patterns. Vary dot size, density, and spacing to create distinct tonal values. Keep the printed dots visible at the intended viewing size without obscuring faces or small details.

Print Texture & Surface:
Visible paper fibers, fine grain, subtle ink spread, occasional broken ink edges, and restrained print wear. Small scuffs and irregularities create a lived-in quality while preserving clean visual storytelling. Let the paper show through highlights and selected open areas without replacing the requested environment with an empty background. The finish evokes alternative comics, indie animation, and printed ephemera of the 1980s–1990s.

Rendering Constraints:
Traditional-looking ink and printed halftone textures. No photographic lens blur, glossy 3D rendering, volumetric lighting, or airbrushed shading. ${noText}`;
const halftoneColor = `Color Mode:
Use a matte, muted retro palette of dusty reds, faded blues, subdued ochres, and restrained greens, printed on warm off-white or pale beige paper. Preserve clear separation between the limited colors. Build shading with visible colored or black halftone dots over flat fills. Keep the paper tone subtle enough that the palette retains distinct hues.`;
const halftoneGray = `Color Mode:
Render entirely in black, white, and neutral grayscale on white or pale neutral-gray paper. Build intermediate gray values through visible black halftone dots and patterned stippling, with solid black accents and exposed paper highlights. Preserve strong tonal separation between characters and their surroundings. No color, beige paper, sepia, or tinted grays.`;

export const PAINTERLY_STYLES: IllustrationStyle[] = [
  {
    id: 'paint-cinematic-graphic-novel', previewImage: '/Styles/Painterly/paint-cinematic-graphic-novel-color.jpg', linePreviewImage: '/Styles/Painterly/paint-cinematic-graphic-novel-gray.jpg', name: 'Cinematic painterly graphic novel', genre: 'Painterly / Traditional',
    supportedColorModes: ['color', 'grayscale'],
    promptText: cinematicBase + '\n\n' + cinematicColor,
    modePromptText: { color: cinematicBase + '\n\n' + cinematicColor, grayscale: cinematicBase + '\n\n' + cinematicGray }
  },
  {
    id: 'paint-gritty-dark-fantasy', previewImage: '/Styles/Painterly/paint-gritty-dark-fantasy-color.jpg', name: 'Gritty dark-fantasy oil painting', genre: 'Painterly / Traditional', supportedColorModes: ['color'],
    promptText: `Style & Medium:
A cinematic film still from a gritty, dark-fantasy psychological drama, heavily overlaid with highly visible, distinct, textured brushwork and fine organic sketch-like linework. The image feels like a photograph or movie scene capturing a candid, real-world moment, rendered with a thick, expressive painterly hand. Prominent brushstrokes, impasto textures, loose gestural scrapes, and dry-brush marks remain evident throughout environment, clothing, and background. Visible paint layering gives the surface a thick, tactile quality. Natural anatomical proportions, realistic faces, and genuine expressions. No harsh thick ink outlines or cartoonish effects; contours are integrated and defined by layered paint.

Camera & Optical Effects:
Captured as if on 35mm film with natural camera lens behaviors. Realistic depth of field with cinematic soft background defocus, motion blur on moving elements, subtle lens flares, natural grain, and water droplets or dust on the lens where appropriate. Grounded camera perspective focusing on candid, unstaged human moments. Thick painterly texture remains highly visible through the camera effects.

Lighting & Contrast:
Naturalistic dramatic chiaroscuro. Dense soft-edged shadows filled with believable environmental bounce light from scene-appropriate sources such as twilight, dim indoor lamps, or firelight. Light interacts with clothing, damp skin, and thick brush strokes. Luminous elements bleed through atmospheric haze with natural bloom, highlights on wet surfaces, and restrained lens flare.

Details & Texture:
Visceral, candid, and weather-worn. Authentic details appropriate to the scene: stray damp hair, tired or intense eyes, weathered skin, sweat, rain on glass, and rising mist or smoke. Rich tactile surfaces with prominent impasto, visible paint layering, and artistic grit.

Palette:
Desaturated, organic, muddy cinematic colors: deep charcoal, slate, dark rust, and mossy greens, broken by rich incandescent orange or fiery gold lighting from realistic sources. Visible strokes of warm highlights catch heavy surface textures. Color rendering is essential: retain subtle chromatic variation even in the darkest areas. ${colorOnly} ${noText}`
  },
  {
    id: 'paint-americana-rockwell', previewImage: '/Styles/Painterly/paint-americana-rockwell-color.jpg', name: '1950s Americana oil painting', genre: 'Painterly / Traditional', supportedColorModes: ['color'],
    promptText: `A classic mid-century 1950s Americana oil painting on finely textured canvas, in the iconic narrative illustration style of Norman Rockwell. Strong visual storytelling, gently humorous human observation, natural anatomical proportions, and highly expressive, believable faces. Carefully observed everyday details, period-appropriate materials, and a polished, hand-painted finish with subtle visible brushwork and fine canvas texture.

Warm, nostalgic color palette with crimson reds, warm ochres, creamy whites, and softly balanced earth tones. Smooth, luminous lighting with gentle shadows, natural reflected color, and carefully controlled highlights. Preserve rich local colors and subtle color variation throughout the image, including shadow areas.

Color is essential to this style. No monochrome, grayscale, black-and-white, or uniform sepia treatment. ${noText}`
  },
  {
    id: 'paint-regionalist-wood', previewImage: '/Styles/Painterly/paint-regionalist-wood-color.jpg', name: 'American Regionalist oil painting', genre: 'Painterly / Traditional', supportedColorModes: ['color'],
    promptText: `Visual Style & Medium:
A stylized American Regionalist oil painting on wood panel (beaverboard), in the tight, meticulous 1930s style of Grant Wood. Uncanny, austere realism with a formal, highly structured interplay between flattened shapes and carefully modeled three-dimensional forms. Traditional tightly painted surfaces with fine, tiny brush marks and a matte, eggshell-like finish. No loose expressive brushwork, photorealistic camera effects, or modern digital effects.

Composition & Characters:
Favor frontal, static, carefully balanced compositions with a stark stillness inspired by 19th-century portrait photography. Convey emotion through restrained expressions, deliberate posture, and subtle gestures. Preserve the actions, identities, and emotions specified in the scene while interpreting them through this formal visual language. Precisely controlled contours, selectively softened edges, and strong tonal separation between figures and surroundings.

Color, Patterns & Details:
Muted earthy colors: deep navy blues, near-blacks, forest greens, ochres, off-whites, and clay tones. Maintain subtle but perceptible hue differences, including dark areas. Meticulous attention to material surfaces, small decorative patterns, and geometric repetition in clothing, objects, and architecture. Patterns follow forms and remain appropriate to the scene.

Environment & Architecture:
Interpret the specified setting through tightly ordered shapes, simplified volumes, rhythmic repetition, and carefully arranged perspective. Where appropriate, rounded sculptural trees, patterned fields, parallel crop rows, linear fences, and American vernacular or Carpenter Gothic architecture. Quiet, restrained, grounded atmosphere without replacing the requested location or introducing unrelated rural elements.

Color Mode:
The restrained earthy palette is essential even when saturation is low. ${colorOnly} ${noText}`
  },
  {
    id: 'paint-zorn-alla-prima', previewImage: '/Styles/Painterly/paint-zorn-alla-prima-color.jpg', name: 'Zorn-inspired alla prima', genre: 'Painterly / Traditional', supportedColorModes: ['color'],
    promptText: `Visual Style & Medium:
An expressive, realist oil painting on canvas inspired by the distinctive late-19th-century bravura style of Anders Zorn. A restricted earthy palette based on yellow ochre, warm vermilion red, ivory black, and warm white. Natural skin tones, subdued earth colors, muted olive greens, and cool-looking neutral grays through careful mixing and relative color contrast. No bright artificial colors, saturated blues, or neon hues.

Artistic Techniques & Brushwork:
An alla prima (wet-on-wet) appearance with bold, loose, confident brushwork. Large, sweeping, gestural flat-brush strokes describe forms economically while preserving convincing anatomy, expressions, and essential scene details. Strong lost-and-found edges: selected contours dissolve into adjacent shadows or surroundings while focal details remain defined. Reserve rich impasto for concentrated highlights, catchlights, and glinting reflections where appropriate. Traditional textured oil paint with visible canvas tooth and distinct brush marks. No hard ink outlines, airbrushed surfaces, or glossy digital rendering.

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
    id: 'draw-expressive-charcoal', linePreviewImage: '/Styles/Painterly/draw-expressive-charcoal-gray.jpg', name: 'Expressive charcoal drawing', genre: 'Drawing / Print', supportedColorModes: ['grayscale'],
    promptText: `Visual Style & Medium:
A traditional raw highly expressive charcoal drawing on heavyweight textured paper. Deep velvety charcoal blacks, a broad range of smoky grainy neutral grays, and white or pale neutral-gray exposed paper. Highlights through eraser lifts and selective white chalk. No warm tint, beige paper, or sepia.

Artistic Techniques:
Rough gestural lines, fragmented sketch contours, selective dense hatching and cross-hatching. Heavily smudged, blended, and rubbed charcoal creates smoky tonal transitions as if worked by fingers or a tortillon. Broad shadow masses, sharp decisive marks, and visibly lifted highlights. Dramatic chiaroscuro appropriate to specified lighting. Preserve recognizable faces, convincing anatomy, and essential details.

Texture & Surface:
Visible paper tooth interrupts charcoal marks and remains perceptible through blended passages. Restrained charcoal dust, scattered particles, finger smudges, and eraser crumbs near worked areas and outer edges. Vary density and pressure, contrasting exposed paper with heavily worked shadows. Keep focal subjects readable without covering every surface in debris.

Finish & Composition:
Tactile imperfect handmade drawing with selectively unfinished areas, loose peripheral marks, and irregular transitions into untouched paper. Preserve characters, actions, objects, and setting. Selective detail and edge control guide attention. Tonal transitions retain charcoal grain and rubbing texture. No smooth digital gradients, photographic filters, or glossy surfaces.

Color Mode:
${neutralGray} ${noText}`
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
Melancholic tense cinematic atmosphere with an artfully unpolished finish. Dystopian mood through color, texture, and light while preserving setting, period, characters, and events. Keep action readable within energetic marks and abstract surroundings.

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
Interpret requested characters, actions, objects, and setting through elegant brush rhythms, restrained detail, and balance of forms and open space. Where appropriate, ancient pines or willows, angular rocks, flowing water, and mist. Do not introduce mountains, waterfalls, or tiny distant figures unless suited to the scene. Keep important characters and actions readable.

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
