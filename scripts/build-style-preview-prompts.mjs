// Build preview inputs with the same prompt builder used by the application.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.argv[2] || resolve(root, 'style-preview-validation'));
const compiled = resolve(output, 'compiled');
for (const file of ['stylesLibrary', 'painterlyStyles', 'styleColorMode', 'adaptation/prompts']) {
  const destination = resolve(compiled, file + '.mjs');
  mkdirSync(dirname(destination), { recursive: true });
  const source = readFileSync(resolve(root, 'src', file + '.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from "(\.[^"]+)"/g, 'from "$1.mjs"');
  writeFileSync(destination, js);
}
const { BUILTIN_STYLES } = await import(pathToFileURL(resolve(compiled, 'stylesLibrary.mjs')));
const { buildImagePrompt } = await import(pathToFileURL(resolve(compiled, 'adaptation/prompts.mjs')));
const scene = 'A complete wide landscape scene, 16:9: a colossal abandoned humanoid robot sits on the right at the edge of a forest, leaning back against trees, rusty moss-covered blue-gray blocky armor, slit eyes and ribbed chest, huge bent legs stretched toward the foreground. On the left exactly five rural villagers watch with quiet curiosity: three standing people (a young adult man in a cream shirt and overalls holding a farm fork, a younger adult woman in a checked dress, and an elderly gray-haired woman in a dark blouse and patterned skirt), and two men seated on a wooden horse cart (an elderly bearded man in a brimmed hat and a man in a flat cap). A brown horse with a pale facial blaze stands near center in front of the cart. Two wooden farmhouses, fenced ploughed fields, a winding dirt road and distant deciduous trees occupy the left background; dense woodland is behind the robot; a shallow stream crosses the lower-right foreground. All five people, horse, cart and entire seated robot should be visible.';
// Optional arguments: style-id or style-id:color-mode.
const selections = process.argv.slice(3).length ? process.argv.slice(3) : ['manga-10', 'jp-1', 'draw-colored-pencil', 'collage-cut-paper', 'graphic-geometric'];
const manifest = [];
for (const selection of selections) {
  const [id, colorMode = 'color'] = selection.split(':');
  if (!['color', 'grayscale', 'line-art'].includes(colorMode)) throw new Error('Invalid color mode: ' + colorMode);
  const style = BUILTIN_STYLES.find(s => s.id === id);
  if (!style) throw new Error('Missing style: ' + id);
  if (style.supportedColorModes && !style.supportedColorModes.includes(colorMode)) throw new Error('Unsupported color mode for ' + id);
  const project = { style, renderOptions: { colorMode, linesOnly: colorMode === 'line-art' }, characters: [], locations: [] };
  const panel = { visualDescription: scene, shotType: 'establishing-wide', sizeHint: 'full-width', characterIds: [], promptDirection: { cameraAngle: 'eye-level', lighting: 'Soft natural daylight.', effects: [] } };
  const prompt = buildImagePrompt(project, panel);
  writeFileSync(resolve(output, id + '.txt'), prompt);
  manifest.push({ styleId: id, name: style.name, colorMode, promptFile: id + '.txt', promptSha256: createHash('sha256').update(prompt).digest('hex'), styleSnapshot: style, panel, status: 'awaiting-review' });
}
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Built ' + manifest.length + ' exact application prompts in ' + output);
