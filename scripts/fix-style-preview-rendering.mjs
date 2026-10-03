import fs from "node:fs";

let lib = fs.readFileSync("src/stylesLibrary.ts", "utf8");
lib = lib.replaceAll('"Styles/Franco_Belgian/', '"/Styles/Franco_Belgian/');
fs.writeFileSync("src/stylesLibrary.ts", lib);

let app = fs.readFileSync("src/App.tsx", "utf8");
app = app.replace(
  'const resolvedPreviewImage = previewImage?.startsWith("data:") ? previewImage : previewImage ? new URL(previewImage, window.location.href).toString() : undefined;',
  'const resolvedPreviewImage = previewImage;'
);
app = app.replace(
  '<img src={resolvedPreviewImage} alt="" loading="lazy" decoding="async" />',
  '<img key={resolvedPreviewImage} src={resolvedPreviewImage} alt="" loading="lazy" decoding="async" />'
);
fs.writeFileSync("src/App.tsx", app);

fs.rmSync("scripts/fix-style-preview-rendering.mjs", { force: true });
fs.rmSync(".github/workflows/fix-style-preview-rendering.yml", { force: true });
fs.rmSync(".github/fix-style-preview-rendering.trigger", { force: true });
