import fs from "node:fs";

const path = "src/stylesLibrary.ts";
let source = fs.readFileSync(path, "utf8");

const replacements = new Map([
  [
    '["fb-1","Ligne claire adventure","Franco-Belgian","classic ligne claire comic style, clean even linework, highly readable drawing, flat and controlled colors, crisp contours, minimal hatching, elegant simplified forms, clear perspective, charming European adventure atmosphere, detailed but uncluttered backgrounds, timeless all-ages comic album feel, single comic panel illustration, strong visual storytelling, readable character silhouettes, expressive faces, clear staging, no speech bubbles, no captions, no text","/style-previews/fb-1.svg"]',
    '["fb-1","Ligne claire adventure","Franco-Belgian","classic ligne claire comic style, clean even linework, highly readable drawing, flat and controlled colors, crisp contours, minimal hatching, elegant simplified forms, clear perspective, charming European adventure atmosphere, detailed but uncluttered backgrounds, timeless all-ages comic album feel, single comic panel illustration, strong visual storytelling, readable character silhouettes, expressive faces, clear staging, no speech bubbles, no captions, no text","/Styles/Franco_Belgian/thumb_ligne_claire.jpg","/Styles/Franco_Belgian/thumb_ligne_claire_lines.jpg"]'
  ],
  [
    '["fb-2","Marcinelle dynamic cartoon","Franco-Belgian","dynamic Marcinelle-school comic style, energetic brush-like linework, lively exaggerated poses, elastic character acting, playful facial expressions, warm vibrant colors, fluid movement, rich but readable background drawing, humorous European adventure comic feeling, single comic panel illustration, no speech bubbles, no captions, no text","/style-previews/fb-2.svg"]',
    '["fb-2","Marcinelle dynamic cartoon","Franco-Belgian","dynamic Marcinelle-school comic style, energetic brush-like linework, lively exaggerated poses, elastic character acting, playful facial expressions, warm vibrant colors, fluid movement, rich but readable background drawing, humorous European adventure comic feeling, single comic panel illustration, no speech bubbles, no captions, no text","/Styles/Franco_Belgian/thumb_marcinelle_dynamic_cartoon.jpg","/Styles/Franco_Belgian/thumb_marcinelle_dynamic_cartoon_lines.jpg"]'
  ],
  [
    '["fb-3","Classic European album","Franco-Belgian","classic Franco-Belgian comic album style, balanced composition, clean storytelling, expressive characters, strong environmental drawing, soft flat colors with light shading, readable adventure-comedy tone, polished line art, elegant European comic presentation, single comic panel illustration, no speech bubbles, no captions, no text","/style-previews/fb-3.svg"]',
    '["fb-3","Classic European album","Franco-Belgian","classic Franco-Belgian comic album style, balanced composition, clean storytelling, expressive characters, strong environmental drawing, soft flat colors with light shading, readable adventure-comedy tone, polished line art, elegant European comic presentation, single comic panel illustration, no speech bubbles, no captions, no text","/Styles/Franco_Belgian/thumb_classic_european.jpg","/Styles/Franco_Belgian/thumb_classic_european_lines.jpg"]'
  ],
  [
    '["fb-4","Humorous Belgian adventure","Franco-Belgian","humorous Belgian adventure comic style, expressive cartoon realism, dynamic linework, friendly exaggeration, colorful and inviting palette, strong comedic timing, lively body language, well-drawn interiors and city backgrounds, classic serialized comic energy, single comic panel illustration, no speech bubbles, no captions, no text","/style-previews/fb-4.svg"]',
    '["fb-4","Humorous Belgian adventure","Franco-Belgian","humorous Belgian adventure comic style, expressive cartoon realism, dynamic linework, friendly exaggeration, colorful and inviting palette, strong comedic timing, lively body language, well-drawn interiors and city backgrounds, classic serialized comic energy, single comic panel illustration, no speech bubbles, no captions, no text","/Styles/Franco_Belgian/thumb_humorous_belgian_adventure.jpg","/Styles/Franco_Belgian/thumb_humorous_belgian_adventure_lines.jpg"]'
  ],
  [
    '["anchor-1","Classic clear-line Belgian","Franco-Belgian","clear-line European comic style inspired by classic Belgian adventure albums, precise uniform linework, flat clean colors, strong readability, simplified but accurate forms, uncluttered detailed backgrounds, calm polished storytelling, timeless adventure-comic clarity, single comic panel illustration, no speech bubbles, no captions, no text","/style-previews/anchor-1.svg"]',
    '["anchor-1","Classic clear-line Belgian","Franco-Belgian","clear-line European comic style inspired by classic Belgian adventure albums, precise uniform linework, flat clean colors, strong readability, simplified but accurate forms, uncluttered detailed backgrounds, calm polished storytelling, timeless adventure-comic clarity, single comic panel illustration, no speech bubbles, no captions, no text","/Styles/Franco_Belgian/thumb_classic_clear_line_belgian.jpg","/Styles/Franco_Belgian/thumb_classic_clear_line_belgian_lines.jpg"]'
  ],
  [
    '["anchor-2","Dynamic Marcinelle classic","Franco-Belgian","dynamic European comic cartooning inspired by classic Marcinelle-school adventure comics, elastic movement, energetic expressive line, playful exaggeration, lively acting, rich visual humor, vibrant colors, fluid and charming adventure storytelling, single comic panel illustration, no speech bubbles, no captions, no text"]',
    '["anchor-2","Dynamic Marcinelle classic","Franco-Belgian","dynamic European comic cartooning inspired by classic Marcinelle-school adventure comics, elastic movement, energetic expressive line, playful exaggeration, lively acting, rich visual humor, vibrant colors, fluid and charming adventure storytelling, single comic panel illustration, no speech bubbles, no captions, no text","/Styles/Franco_Belgian/thumb_dynamic_marcinelle_classic.jpg","/Styles/Franco_Belgian/thumb_dynamic_marcinelle_classic_lines.jpg"]'
  ]
]);

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Could not find style tuple: ${before.slice(0, 80)}...`);
  source = source.replace(before, after);
}

fs.writeFileSync(path, source);
fs.rmSync("scripts/connect-franco-belgian-assets.mjs", { force: true });
