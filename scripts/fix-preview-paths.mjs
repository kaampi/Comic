import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stylesDir = path.join(root, 'public', 'Styles');
const libraryPath = path.join(root, 'src', 'stylesLibrary.ts');
let source = fs.readFileSync(libraryPath, 'utf8');

// Rename accidental thumbs_* files to the established thumb_* convention.
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.startsWith('thumbs_')) {
      const target = path.join(dir, entry.name.replace(/^thumbs_/, 'thumb_'));
      if (!fs.existsSync(target)) fs.renameSync(full, target);
    }
  }
}
if (fs.existsSync(stylesDir)) walk(stylesDir);

// Remove legacy preview URLs. They point to files that do not exist in public.
source = source.replace(/,"\/style-previews\/[^"]+"/g, ',undefined');

// Add line-preview paths where a matching thumb_*_lines file now exists but the preset only has a color preview.
const additions = new Map([
  ['/Styles/American_modern/thumb_modern_action_comic.jpg', '/Styles/American_modern/thumb_modern_action_comic_lines.jpg'],
  ['/Styles/Crime_Noir/thumb_neo_noir_thriller.jpg', '/Styles/Crime_Noir/thumb_neo_noir_thriller_lines.jpg'],
  ['/Styles/Japanese/thumb_gekiga.jpg', '/Styles/Japanese/thumb_gekiga_lines.jpg'],
  ['/Styles/Manga/thumb_cyberpunk_manga.jpg', '/Styles/Manga/thumb_cyberpunk_manga_lines.jpg'],
  ['/Styles/Manga/thumb_mecha_manga.jpg', '/Styles/Manga/thumb_mecha_manga_lines.jpg']
]);
for (const [color, lines] of additions) {
  const esc = color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`("${esc}")(?!,\"/Styles/)`, 'g');
  source = source.replace(re, `$1,"${lines}"`);
}

// Do not leave any preview path that resolves to a missing public file.
source = source.replace(/"(\/Styles\/[^"\n]+)"/g, (match, urlPath) => {
  const diskPath = path.join(root, 'public', urlPath.replace(/^\//, ''));
  return fs.existsSync(diskPath) ? match : 'undefined';
});

fs.writeFileSync(libraryPath, source);
