export type IllustrationStyle = {
  id: string;
  name: string;
  promptText: string;
  genre: string;
};

export const BUILTIN_STYLES: IllustrationStyle[] = [
["fb-1","Ligne claire adventure","Franco-Belgian","classic ligne claire comic style, clean even linework, highly readable drawing, flat and controlled colors, crisp contours, minimal hatching, elegant simplified forms, clear perspective, charming European adventure atmosphere, detailed but uncluttered backgrounds, timeless all-ages comic album feel, single comic panel illustration, strong visual storytelling, readable character silhouettes, expressive faces, clear staging, no speech bubbles, no captions, no text"],
["fb-2","Marcinelle dynamic cartoon","Franco-Belgian","dynamic Marcinelle-school comic style, energetic brush-like linework, lively exaggerated poses, elastic character acting, playful facial expressions, warm vibrant colors, fluid movement, rich but readable background drawing, humorous European adventure comic feeling, single comic panel illustration, no speech bubbles, no captions, no text"],
["fb-3","Classic European album","Franco-Belgian","classic Franco-Belgian comic album style, balanced composition, clean storytelling, expressive characters, strong environmental drawing, soft flat colors with light shading, readable adventure-comedy tone, polished line art, elegant European comic presentation, single comic panel illustration, no speech bubbles, no captions, no text"],
["fb-4","Humorous Belgian adventure","Franco-Belgian","humorous Belgian adventure comic style, expressive cartoon realism, dynamic linework, friendly exaggeration, colorful and inviting palette, strong comedic timing, lively body language, well-drawn interiors and city backgrounds, classic serialized comic energy, single comic panel illustration, no speech bubbles, no captions, no text"],

["er-1","Elegant European realism","European Realist","elegant European realistic comic style, refined naturalistic anatomy, graceful body language, soft sensual linework, expressive eyes and subtle facial emotion, sophisticated lighting, warm painterly color palette, stylish interiors and urban backgrounds, mature European comic album atmosphere, single comic panel illustration, no speech bubbles, no captions, no text"],
["er-2","Painterly European realism","European Realist","painterly European comic realism, controlled naturalistic drawing, soft brush rendering, nuanced skin tones, atmospheric lighting, rich textures, realistic environments, cinematic mood, mature graphic novel presentation, balanced realism and illustration, single comic panel illustration, no speech bubbles, no captions, no text"],
["er-3","Historical realistic album","European Realist","realistic European historical comic style, careful period detail, believable anatomy, richly researched costume and architecture, subtle ink linework, natural color palette, restrained shading, elegant album-style storytelling, immersive historical atmosphere, single comic panel illustration, no speech bubbles, no captions, no text"],
["er-4","Naturalistic drama comics","European Realist","naturalistic European drama comic style, believable human proportions, subtle expressions, emotional realism, soft contour line, muted yet rich colors, realistic domestic and city settings, intimate mature storytelling, refined graphic novel aesthetic, single comic panel illustration, no speech bubbles, no captions, no text"],

["adv-1","Cinematic pulp adventure","Adventure","cinematic adventure comic style, bold compositions, dramatic lighting, energetic staging, expressive action poses, strong environmental storytelling, pulpy excitement, crisp linework, vivid colors, high readability, fast-paced serialized adventure atmosphere, single comic panel illustration, no speech bubbles, no captions, no text"],
["adv-2","Expedition adventure","Adventure","expedition adventure comic style, rugged explorers, strong sense of place, richly drawn landscapes, practical costume detail, adventurous mood, dynamic framing, clean ink linework, natural but vibrant palette, classic treasure-hunt storytelling, single comic panel illustration, no speech bubbles, no captions, no text"],
["adv-3","Swashbuckling action comic","Adventure","swashbuckling comic adventure style, energetic sword-and-chase action, dramatic gestures, dynamic perspective, crisp lines, colorful storytelling, lively movement, theatrical staging, classic serial adventure feeling, single comic panel illustration, no speech bubbles, no captions, no text"],
["adv-4","Young-adult adventure comic","Adventure","accessible young-adult comic adventure style, expressive but readable faces, clean line art, bright colors, inviting world-building, clear action storytelling, adventurous spirit, polished panel-friendly composition, all-ages appeal, single comic panel illustration, no speech bubbles, no captions, no text"],

["noir-1","European noir","Noir / Crime","European noir comic style, moody shadows, restrained color palette, dramatic contrast, realistic urban environments, trench-coat detective atmosphere, subtle facial tension, cinematic framing, sophisticated crime-story mood, graphic storytelling with controlled linework, single comic panel illustration, no speech bubbles, no captions, no text"],
["noir-2","Hardboiled crime comic","Noir / Crime","hardboiled crime comic style, sharp ink shadows, gritty city texture, tense staging, cold urban lighting, muted colors with occasional strong accents, realistic faces, tough atmosphere, classic detective and underworld storytelling, single comic panel illustration, no speech bubbles, no captions, no text"],
["noir-3","Retro detective serial","Noir / Crime","retro detective comic serial style, clean but shadow-heavy drawing, smoky interiors, night streets, moody lamps and reflections, period crime atmosphere, elegant composition, readable pulp-noir storytelling, single comic panel illustration, no speech bubbles, no captions, no text"],
["noir-4","Neo-noir thriller","Noir / Crime","neo-noir comic style, modern crime-thriller mood, deep blacks, selective neon accents, cinematic tension, angular framing, realistic urban detail, expressive restrained acting, dark contemporary graphic novel look, single comic panel illustration, no speech bubbles, no captions, no text"],

["fan-1","European fantasy album","Fantasy","European fantasy comic album style, elegant linework, imaginative world-building, magical atmosphere, richly detailed costumes and architecture, balanced colors, readable fantasy storytelling, polished illustrated-comic look, single comic panel illustration, no speech bubbles, no captions, no text"],
["fan-2","Sword and sorcery comic","Fantasy","sword and sorcery comic style, bold fantasy action, muscular heroic staging, dramatic poses, vivid color contrasts, rugged environments, ancient ruins and taverns, energetic adventure-comic feel, pulpy fantasy atmosphere, single comic panel illustration, no speech bubbles, no captions, no text"],
["fan-3","Dark fantasy comic","Fantasy","dark fantasy comic style, ominous atmosphere, textured linework, dramatic shadows, cold and moody palette, eerie environments, mystical tension, mature fantasy storytelling, detailed gothic world-building, single comic panel illustration, no speech bubbles, no captions, no text"],
["fan-4","Mythic watercolor fantasy","Fantasy","mythic fantasy comic style, soft painterly rendering, luminous magical light, delicate textures, graceful character design, dreamlike atmosphere, ornate natural scenery, poetic European fantasy graphic novel aesthetic, single comic panel illustration, no speech bubbles, no captions, no text"],

["sf-1","Clean sci-fi adventure","Sci-fi","clean science-fiction comic style, readable futuristic design, sleek technology, crisp linework, controlled flat colors with subtle shading, adventurous space-age atmosphere, clear storytelling, polished classic sci-fi album feel, single comic panel illustration, no speech bubbles, no captions, no text"],
["sf-2","Space opera comic","Sci-fi","space opera comic style, dramatic interstellar atmosphere, heroic staging, colorful cosmic environments, elegant spacecraft design, cinematic scale, vibrant lighting, high-adventure science-fiction storytelling, single comic panel illustration, no speech bubbles, no captions, no text"],
["sf-3","Cyberpunk comic","Sci-fi","cyberpunk comic style, dense urban future, neon reflections, gritty technology, moody atmosphere, layered city detail, strong silhouettes, dramatic contrast, contemporary science-fiction graphic novel tone, single comic panel illustration, no speech bubbles, no captions, no text"],
["sf-4","Retro-futurist comic","Sci-fi","retro-futurist comic style, vintage future design, streamlined machines, bold graphic clarity, optimistic old-school science-fiction mood, clean illustration, bright controlled colors, classic magazine-and-comic hybrid feeling, single comic panel illustration, no speech bubbles, no captions, no text"],

["hum-1","Expressive cartoon humor","Humor / All Ages","expressive cartoon comic style, playful linework, exaggerated acting, strong clarity, cheerful colors, humorous timing, bouncy poses, friendly character design, all-ages comic readability, lively fun atmosphere, single comic panel illustration, no speech bubbles, no captions, no text"],
["hum-2","Family adventure comics","Humor / All Ages","family-friendly adventure comic style, warm inviting palette, clear storytelling, appealing character design, lively but gentle humor, expressive faces, charming backgrounds, all-ages album presentation, single comic panel illustration, no speech bubbles, no captions, no text"],
["hum-3","Children's comic style","Humor / All Ages","children's comic illustration style, rounded friendly forms, simple readable composition, bright soft colors, happy atmosphere, clear expressions, playful energy, easy-to-read visual storytelling, single comic panel illustration, no speech bubbles, no captions, no text"],
["hum-4","Funny slice-of-life comic","Humor / All Ages","light comedic slice-of-life comic style, relatable acting, expressive body language, soft clean linework, warm everyday colors, charming domestic or street environments, friendly humorous tone, approachable visual storytelling, single comic panel illustration, no speech bubbles, no captions, no text"],

["am-1","Modern mainstream comics","American / Modern Comics","modern mainstream comic style, dynamic composition, confident linework, polished digital coloring, bold contrast, expressive characters, cinematic action framing, contemporary commercial comic-book finish, single comic panel illustration, no speech bubbles, no captions, no text"],
["am-2","Indie graphic novel","American / Modern Comics","modern indie graphic novel style, slightly loose linework, personal expressive drawing, grounded acting, limited but intentional color palette, intimate storytelling, contemporary literary comic feel, single comic panel illustration, no speech bubbles, no captions, no text"],
["am-3","Modern action comic","American / Modern Comics","modern action-comic style, dramatic anatomy, dynamic foreshortening, punchy composition, bold lighting, energetic linework, strong color separation, heightened but readable visual storytelling, single comic panel illustration, no speech bubbles, no captions, no text"],
["am-4","Contemporary webcomic polish","American / Modern Comics","contemporary polished webcomic style, clean digital line art, appealing character design, crisp coloring, strong readability, expressive faces, modern visual rhythm, accessible and commercial comic presentation, single comic panel illustration, no speech bubbles, no captions, no text"],

["anchor-1","Classic clear-line Belgian","Franco-Belgian","clear-line European comic style inspired by classic Belgian adventure albums, precise uniform linework, flat clean colors, strong readability, simplified but accurate forms, uncluttered detailed backgrounds, calm polished storytelling, timeless adventure-comic clarity, single comic panel illustration, no speech bubbles, no captions, no text"],
["anchor-2","Dynamic Marcinelle classic","Franco-Belgian","dynamic European comic cartooning inspired by classic Marcinelle-school adventure comics, elastic movement, energetic expressive line, playful exaggeration, lively acting, rich visual humor, vibrant colors, fluid and charming adventure storytelling, single comic panel illustration, no speech bubbles, no captions, no text"],
["anchor-3","Elegant adult European realism","European Realist","elegant mature European realistic comic style, graceful anatomy, sophisticated body language, refined linework, warm naturalistic color, subtle facial expression, stylish atmospheric environments, polished adult graphic storytelling, single comic panel illustration, no speech bubbles, no captions, no text"]
].map(([id,name,genre,promptText]) => ({ id, name, genre, promptText }));

export const STYLE_GENRES = [...new Set(BUILTIN_STYLES.map((style) => style.genre))];
const CUSTOM_STYLES_KEY = "comicbook-ai.custom-styles";

export function readCustomStyles(): IllustrationStyle[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_STYLES_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) =>
      item && typeof item.id === "string" && typeof item.name === "string" &&
      typeof item.promptText === "string" && typeof item.genre === "string"
    ) : [];
  } catch { return []; }
}

export function saveCustomStyles(styles: IllustrationStyle[]): void {
  try { localStorage.setItem(CUSTOM_STYLES_KEY, JSON.stringify(styles)); } catch {}
}

export function createCustomStyleId(): string {
  return "custom-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
