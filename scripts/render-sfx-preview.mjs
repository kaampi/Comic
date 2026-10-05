import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = ts.transpileModule(
  fs.readFileSync(path.join(root, "src/sfxShapes.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { SFX_SHAPES, sfxPrimitives } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const width = 900,
  rowHeight = 205,
  height = 145 + Math.ceil(SFX_SHAPES.length / 2) * rowHeight;
let body = `<rect width="${width}" height="${height}" fill="#eee8dc"/><text x="40" y="55" font-family="DejaVu Sans" font-size="34" font-weight="bold" fill="#171411">ComicBook AI · SFX</text><text x="40" y="94" font-family="DejaVu Sans" font-size="21" fill="#675e53">14 val · Redigerbar text och fristående former</text>`;
for (const [i, shape] of SFX_SHAPES.entries()) {
  const x = 30 + (i % 2) * 440,
    y = 125 + Math.floor(i / 2) * rowHeight;
  body += `<rect x="${x}" y="${y}" width="410" height="188" rx="12" fill="#fffdf7" stroke="#d7cdbd"/><g transform="translate(${x + 60} ${y + 13}) scale(2.9 2.05)">`;
  for (const p of sfxPrimitives(shape.id))
    body += `<path d="${p.d}" fill="${p.fill ? "#fffdf7" : "none"}" stroke="#171411" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  if (shape.id === "none")
    body +=
      '<text x="50" y="38" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="23" fill="#171411">BOOM!</text>';
  body += `</g><text x="${x + 205}" y="${y + 165}" text-anchor="middle" font-family="DejaVu Sans" font-size="22" fill="#171411">${shape.sv}</text>`;
}
fs.writeFileSync(
  process.argv[2] ?? path.join(root, "sfx-preview.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`,
);
