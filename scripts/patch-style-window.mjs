import fs from "node:fs";

function replaceOrThrow(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Could not patch ${label}`);
  return source.replace(before, after);
}

let app = fs.readFileSync("src/App.tsx", "utf8");
app = replaceOrThrow(
  app,
  'const previewImage = linesOnly ? (style.linePreviewImage ?? style.previewImage) : style.previewImage;\n                    const lineFallback = linesOnly && !style.linePreviewImage && Boolean(style.previewImage);',
  'const previewImage = linesOnly ? (style.linePreviewImage ?? style.previewImage) : style.previewImage;\n                    const resolvedPreviewImage = previewImage?.startsWith("data:") ? previewImage : previewImage ? new URL(previewImage, window.location.href).toString() : undefined;\n                    const lineFallback = linesOnly && !style.linePreviewImage && Boolean(style.previewImage);',
  "resolved style preview url"
);
app = replaceOrThrow(
  app,
  '>{previewImage?<img src={previewImage} alt="" loading="lazy" decoding="async" />:<span>{tr("noImage")}</span>}',
  '>{resolvedPreviewImage?<img src={resolvedPreviewImage} alt="" loading="lazy" decoding="async" />:<span>{tr("noImage")}</span>}',
  "style preview image"
);
fs.writeFileSync("src/App.tsx", app);

let css = fs.readFileSync("src/styles.css", "utf8");
css = replaceOrThrow(
  css,
  '  height:min(660px,calc(100vh - 28px));',
  '  height:min(820px,calc(100vh - 12px));',
  "style library height"
);
css = replaceOrThrow(
  css,
  '  max-height:none;\n  padding:0;',
  '  max-height:calc(100vh - 12px);\n  padding:0;',
  "style library max height"
);
css = replaceOrThrow(
  css,
  '  min-height:264px;',
  '  min-height:248px;',
  "style card minimum height"
);
css = replaceOrThrow(
  css,
  '  height:144px;',
  '  height:132px;',
  "style preview height"
);
fs.writeFileSync("src/styles.css", css);

let lib = fs.readFileSync("src/stylesLibrary.ts", "utf8");
lib = lib.replaceAll('"/Styles/Franco_Belgian/', '"Styles/Franco_Belgian/');
fs.writeFileSync("src/stylesLibrary.ts", lib);

fs.rmSync("scripts/patch-style-window.mjs", { force: true });
fs.rmSync(".github/workflows/patch-style-window.yml", { force: true });
fs.rmSync(".github/patch-style-window.trigger", { force: true });
