import fs from 'node:fs';
import path from 'node:path';

const move = (from, to) => {
  if (fs.existsSync(from) && !fs.existsSync(to)) {
    fs.renameSync(from, to);
    console.log(`renamed ${from} -> ${to}`);
  }
};

// Fix known filename typos while preserving the binary files.
move('public/Styles/Japanese/gekina.jpg', 'public/Styles/Japanese/gekiga.jpg');
move('public/Styles/Japanese/gekina_lines.jpg', 'public/Styles/Japanese/gekiga_lines.jpg');
move('public/Styles/Japanese/thumb_gekina.jpg', 'public/Styles/Japanese/thumb_gekiga.jpg');
move('public/Styles/Japanese/thumbs_gekina_lines.jpg', 'public/Styles/Japanese/thumb_gekiga_lines.jpg');
move('public/Styles/Manga/thumbs_cyberpunk_manga_lines.jpg', 'public/Styles/Manga/thumb_cyberpunk_manga_lines.jpg');
move('public/Styles/Manga/thumbs_mecha_manga_lines.jpg', 'public/Styles/Manga/thumb_mecha_manga_lines.jpg');
move('public/Styles/Crime_Noir/thumbs_neo_noir_thriller_lines.jpg', 'public/Styles/Crime_Noir/thumb_neo_noir_thriller_lines.jpg');

const file = 'src/stylesLibrary.ts';
let text = fs.readFileSync(file, 'utf8');

const exists = (p) => !!p && fs.existsSync(path.join('public', p.replace(/^\//, '')));
const firstExisting = (...items) => items.find(exists);

const existingPreviewMap = {
  'er-1': ['/Styles/European_realist/thumb_elegant_european_realism.jpg', '/Styles/European_realist/thumb_elegant_european_realism_lines.jpg'],
  'er-2': ['/Styles/European_realist/thumb_painterly_european_realism.jpg', '/Styles/European_realist/thumb_painterly_european_realism_lines.jpg'],
  'er-3': ['/Styles/European_realist/thumb_historical_realistic_album.jpg', '/Styles/European_realist/thumb_historical_realistic_album_lines.jpg'],
  'er-4': ['/Styles/European_realist/thumb_naturalistic_drama_comics.jpg', '/Styles/European_realist/thumb_naturalistic_drama_comics_lines.jpg'],
  'noir-1': ['/Styles/Crime_Noir/thumb_european_noir.jpg', '/Styles/Crime_Noir/thumb_european_noir_lines.jpg'],
  'noir-2': ['/Styles/Crime_Noir/thumb_hardboiled_crime_comic.jpg', '/Styles/Crime_Noir/thumb_hardboiled_crime_comic_lines.jpg'],
  'noir-3': ['/Styles/Crime_Noir/thumb_retro_detective_serial.jpg', '/Styles/Crime_Noir/thumb_retro_detective_serial_lines.jpg'],
  'noir-4': ['/Styles/Crime_Noir/thumb_neo_noir_thriller.jpg', '/Styles/Crime_Noir/thumb_neo_noir_thriller_lines.jpg'],
  'fan-1': ['/Styles/Fantasy/thumb_european_fantasy_album.jpg', '/Styles/Fantasy/thumb_european_fantasy_album_lines.jpg'],
  'fan-2': ['/Styles/Fantasy/thumb_sword_and_sorcery_comic.jpg', '/Styles/Fantasy/thumb_sword_and_sorcery_comic_lines.jpg'],
  'fan-3': ['/Styles/Fantasy/thumb_dark_fantasy_comic.jpg', '/Styles/Fantasy/thumb_dark_fantasy_comic_lines.jpg'],
  'fan-4': ['/Styles/Fantasy/thumb_mythic_watercolor_fantasy.jpg', '/Styles/Fantasy/thumb_mythic_watercolor_fantasy_lines.jpg'],
  'sf-1': ['/Styles/Sci-Fi/thumb_clean_sci_fi_adventure.jpg', '/Styles/Sci-Fi/thumb_clean_scifi_adventure.jpg', '/Styles/Sci-Fi/thumb_clean_sci_fi_adventure_lines.jpg', '/Styles/Sci-Fi/thumb_clean_scifi_adventure_lines.jpg'],
  'sf-2': ['/Styles/Sci-Fi/thumb_space_opera_comic.jpg', '/Styles/Sci-Fi/thumb_space_opera_comic_lines.jpg'],
  'sf-3': ['/Styles/Sci-Fi/thumb_cyberpunk_comic.jpg', '/Styles/Sci-Fi/thumb_cyberpunk_comic_lines.jpg'],
  'sf-4': ['/Styles/Sci-Fi/thumb_retro_futurist_comic.jpg', '/Styles/Sci-Fi/thumb_retro_futurist_comic_lines.jpg'],
  'hum-1': ['/Styles/Humour_all_ages/thumb_expressive_cartoon_humor.jpg', '/Styles/Humour_all_ages/thumb_expressive_cartoon_humour.jpg', '/Styles/Humour_all_ages/thumb_expressive_cartoon_humor_lines.jpg', '/Styles/Humour_all_ages/thumb_expressive_cartoon_humour_lines.jpg'],
  'hum-2': ['/Styles/Humour_all_ages/thumb_family_adventure_comics.jpg', '/Styles/Humour_all_ages/thumb_family_adventure_comics_lines.jpg'],
  'hum-3': ['/Styles/Humour_all_ages/thumb_childrens_comic_style.jpg', '/Styles/Humour_all_ages/thumb_childrens_comic_style_lines.jpg'],
  'hum-4': ['/Styles/Humour_all_ages/thumb_funny_slice_of_life_comic.jpg', '/Styles/Humour_all_ages/thumb_funny_slice_of_life_comic_lines.jpg'],
  'am-1': ['/Styles/American_modern/thumb_american_modern_comic.jpg', '/Styles/American_modern/thumb_american_modern_comic_lines.jpg'],
  'am-2': ['/Styles/American_modern/thumb_indie_graphic_novel.jpg', '/Styles/American_modern/thumb_indie_graphic_novel_lines.jpg'],
  'am-3': ['/Styles/American_modern/thumb_modern_action_comic.jpg', '/Styles/American_modern/thumb_modern_action_comic_lines.jpg'],
  'am-4': ['/Styles/American_modern/thumb_contemporary_webcomic.jpg', '/Styles/American_modern/thumb_contemporary_webcomic_lines.jpg']
};

function updateExistingLine(line) {
  const match = line.match(/^\["([^"]+)"/);
  if (!match) return line;
  const mapping = existingPreviewMap[match[1]];
  if (!mapping) return line;
  const arr = JSON.parse(line.trim().replace(/,$/, ''));
  const color = firstExisting(mapping[0], mapping[1]);
  // For entries with alternate spellings, select line image independently by suffix.
  const lineCandidates = mapping.filter((p) => p.includes('_lines.'));
  const lineImage = firstExisting(...lineCandidates);
  if (!color) return line;
  arr[4] = color;
  if (lineImage) arr[5] = lineImage;
  return JSON.stringify(arr) + ',';
}
text = text.split('\n').map(updateExistingLine).join('\n');

const newStyles = [
  ['manga-1','Classic shōnen manga','Manga','dynamic Japanese shōnen manga style, energetic black ink linework, expressive faces, strong action poses, clear silhouettes, dramatic perspective, speed-line energy, bold shapes, vivid controlled colors, fast-paced visual storytelling, detailed but readable backgrounds, polished manga illustration, no speech bubbles, no captions, no text','/Styles/Manga/thumb_classic_shonen_manga.jpg'],
  ['manga-2','Comedy manga','Manga','Japanese comedy manga style, energetic cartoon linework, exaggerated reactions, elastic facial expressions, playful poses, fast visual timing, expressive motion effects, bold readable shapes, lively color, strong comedic staging, no speech bubbles, no captions, no text','/Styles/Manga/thumb_comedy_manga.jpg'],
  ['manga-3','Cyberpunk manga','Manga','Japanese cyberpunk comic style, dense futuristic city environments, gritty technology, cables and layered architecture, sharp technical linework, noir atmosphere, dramatic shadows, strong silhouettes, neon color accents, high-detail dystopian manga feeling, no speech bubbles, no captions, no text','/Styles/Manga/thumb_cyberpunk_manga.jpg','/Styles/Manga/thumb_cyberpunk_manga_lines.jpg'],
  ['manga-4','Dark supernatural manga','Manga','dark Japanese supernatural manga style, heavy black ink, eerie shadows, dense cross-hatching, unsettling environments, dramatic silhouettes, occult atmosphere, distorted perspective, intense expressions, high-contrast rendering, detailed gothic and urban backgrounds, no speech bubbles, no captions, no text','/Styles/Manga/thumb_dark_supernatural_manga.jpg','/Styles/Manga/thumb_dark_supernatural_manga_lines.jpg'],
  ['manga-5','Historical samurai manga','Manga','Japanese historical samurai comic style, expressive brush-like ink lines, accurate traditional clothing and architecture, dramatic sword poses, restrained but powerful character acting, strong black shapes, textured hatching, cinematic period composition, grounded historical atmosphere, no speech bubbles, no captions, no text','/Styles/Manga/thumb_historical_samurai_manga.jpg','/Styles/Manga/thumb_historical_samurai_manga_lines.jpg'],
  ['manga-6','Seinen realistic manga','Manga','realistic Japanese seinen manga style, mature naturalistic anatomy, restrained facial expressions, detailed environments, grounded acting, strong value structure, controlled cross-hatching, realistic clothing and architecture, cinematic framing, serious adult graphic storytelling, no speech bubbles, no captions, no text','/Styles/Manga/thumb_japanese_seinen_manga.jpg'],
  ['manga-7','Josei drama manga','Manga','mature Japanese josei manga style, elegant naturalistic linework, subtle emotional expressions, believable adult proportions, intimate urban and domestic settings, refined composition, nuanced body language, sophisticated contemporary drama tone, no speech bubbles, no captions, no text','/Styles/Manga/thumb_josei_drama_manga.jpg'],
  ['manga-8','Mecha manga','Manga','Japanese mecha manga style, highly detailed mechanical design, precise technical linework, complex robot joints and armor panels, dynamic battle staging, dramatic perspective, industrial environments, speed effects, crisp contrast, polished science-fiction manga finish, no speech bubbles, no captions, no text','/Styles/Manga/thumb_mecha_manga.jpg','/Styles/Manga/thumb_mecha_manga_lines.jpg'],
  ['manga-9','Retro 80s/90s manga','Manga','retro Japanese manga style inspired by 1980s and 1990s print comics, analog-looking ink lines, classic screentones, detailed machinery and city backgrounds, period character design, strong contrast, hand-drawn production feel, cinematic action composition, nostalgic serialized manga atmosphere, no speech bubbles, no captions, no text','/Styles/Manga/thumb_retro_manga.jpg','/Styles/Manga/thumb_retro_manga_lines.jpg'],
  ['manga-10','Shōjo romance manga','Manga','elegant Japanese shōjo manga style, delicate fine linework, expressive eyes, graceful faces, soft body language, romantic visual rhythm, decorative floral and light effects, airy backgrounds, emotional character focus, refined rendering, no speech bubbles, no captions, no text','/Styles/Manga/thumb_shojo_romance_manga.jpg'],
  ['manga-11','Slice-of-life manga','Manga','Japanese slice-of-life manga style, clean friendly linework, natural everyday poses, subtle facial expressions, detailed domestic and neighborhood settings, quiet visual rhythm, warm human atmosphere, light controlled shading, readable contemporary manga storytelling, no speech bubbles, no captions, no text','/Styles/Manga/thumb_slice_of_life_manga.jpg'],
  ['jp-1','Chibi / super-deformed','Japanese Comics','Japanese chibi comic style, extremely simplified proportions, large heads, tiny bodies, oversized expressive faces, playful gestures, clean bold linework, minimal background detail, strong comedic readability, cute energetic composition, no speech bubbles, no captions, no text','/Styles/Japanese/thumb_chibi_super_deformed.jpg','/Styles/Japanese/thumb_chibi_super_deformed_lines.jpg'],
  ['jp-2','Gekiga','Japanese Comics','Japanese gekiga style, raw realistic drawing, heavy black ink, rough expressive linework, deep shadows, grounded human faces, urban realism, mature dramatic tone, restrained composition, dense hatching, serious literary comic atmosphere, no speech bubbles, no captions, no text','/Styles/Japanese/thumb_gekiga.jpg','/Styles/Japanese/thumb_gekiga_lines.jpg'],
  ['jp-3','Kawaii all-ages','Japanese Comics','cute Japanese all-ages comic style, rounded friendly character shapes, soft clean linework, gentle facial expressions, charming everyday settings, playful decorative details, bright visual clarity, approachable polished storytelling, no speech bubbles, no captions, no text','/Styles/Japanese/thumb_kawaii_all_ages.jpg','/Styles/Japanese/thumb_kawaii_all_ages_lines.jpg'],
  ['jp-4','Sensual romance','Japanese Comics','elegant romantic comic illustration style with refined adult character design, soft clean linework, expressive eyes, detailed hair, graceful proportions, subtle facial expressions, smooth skin rendering, soft cinematic lighting, intimate atmosphere, polished digital finish, gentle glamour aesthetic, sophisticated visual storytelling, no speech bubbles, no captions, no text','/Styles/Japanese/thumb_sensual_romance.jpg','/Styles/Japanese/thumb_sensual_romance_lines.jpg']
];

if (!text.includes('["manga-1"')) {
  const marker = '["anchor-1"';
  const idx = text.indexOf(marker);
  if (idx < 0) throw new Error('Could not find anchor insertion point');
  const block = newStyles.map((s) => JSON.stringify(s) + ',').join('\n') + '\n\n';
  text = text.slice(0, idx) + block + text.slice(idx);
}

fs.writeFileSync(file, text);

// Remove this one-shot maintenance machinery from the final commit.
for (const temp of ['scripts/connect-style-previews.mjs', '.github/workflows/connect-style-previews.yml']) {
  if (fs.existsSync(temp)) fs.unlinkSync(temp);
}
