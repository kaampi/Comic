import fs from "node:fs";

function mustReplace(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Could not patch ${label}`);
  return source.replace(before, after);
}

let app = fs.readFileSync("src/App.tsx", "utf8");

app = mustReplace(
  app,
  'import { BUILTIN_STYLES, STYLE_GENRES, createCustomStyleId, readCustomStyles, saveCustomStyles, type IllustrationStyle } from "./stylesLibrary";',
  'import { BUILTIN_STYLES, createCustomStyleId, readCustomStyles, saveCustomStyles, type IllustrationStyle } from "./stylesLibrary";\nimport { optimizeStylePreview } from "./stylePreview";',
  "style imports"
);

app = mustReplace(
  app,
  'type StyleDraft = { id?: string; name: string; genre: string; promptText: string };',
  'type StyleDraft = { id?: string; name: string; genre: string; promptText: string; previewImage?: string; linePreviewImage?: string };',
  "StyleDraft"
);

app = mustReplace(
  app,
  `  const saveDraft = () => {\n    if (!styleDraft || !styleDraft.name.trim() || !styleDraft.promptText.trim()) return;\n    const style: IllustrationStyle = { id: styleDraft.id ?? createCustomStyleId(), name: styleDraft.name.trim(), genre: styleDraft.genre.trim() || "Custom", promptText: styleDraft.promptText.trim() };\n    persistCustomStyles(styleDraft.id ? customStyles.map((item) => item.id === styleDraft.id ? style : item) : [...customStyles, style]);\n    setStyleDraft(null);\n  };\n  const duplicateStyle = (style: IllustrationStyle) => setStyleDraft({ name: style.name + " – kopia", genre: style.genre, promptText: style.promptText });`,
  `  const saveDraft = () => {\n    if (!styleDraft || !styleDraft.name.trim() || !styleDraft.promptText.trim()) return;\n    const style: IllustrationStyle = {\n      id: styleDraft.id ?? createCustomStyleId(),\n      name: styleDraft.name.trim(),\n      genre: styleDraft.genre.trim() || "Custom",\n      promptText: styleDraft.promptText.trim(),\n      previewImage: styleDraft.previewImage,\n      linePreviewImage: styleDraft.linePreviewImage\n    };\n    persistCustomStyles(styleDraft.id ? customStyles.map((item) => item.id === styleDraft.id ? style : item) : [...customStyles, style]);\n    setStyleDraft(null);\n  };\n  const duplicateStyle = (style: IllustrationStyle) => setStyleDraft({\n    name: style.name + " – kopia",\n    genre: style.genre,\n    promptText: style.promptText,\n    previewImage: style.previewImage,\n    linePreviewImage: style.linePreviewImage\n  });`,
  "style save/duplicate"
);

app = mustReplace(
  app,
  `  const applyStyleToActiveProject = (style: IllustrationStyle) => {\n    updateActiveProject((project) => ({ ...project, style: { ...style } }));\n  };`,
  `  const updateStyleDraftImage = async (field: "previewImage" | "linePreviewImage", file?: File) => {\n    if (!file) return;\n    try {\n      const dataUrl = await optimizeStylePreview(file);\n      setStyleDraft((current) => current ? { ...current, [field]: dataUrl } : current);\n    } catch {}\n  };\n  const setLinesOnly = (linesOnly: boolean) => {\n    updateActiveProject((project) => ({ ...project, renderOptions: { ...project.renderOptions, linesOnly } }));\n  };\n  const applyStyleToActiveProject = (style: IllustrationStyle) => {\n    updateActiveProject((project) => ({ ...project, style: { ...style } }));\n  };`,
  "style helpers"
);

app = mustReplace(
  app,
  'setStyleDraft(source ? { name: source.name + " – kopia", genre: source.genre, promptText: source.promptText } : { name: "", genre: "Custom", promptText: "" });',
  'setStyleDraft(source ? { name: source.name + " – kopia", genre: source.genre, promptText: source.promptText, previewImage: source.previewImage, linePreviewImage: source.linePreviewImage } : { name: "", genre: "Custom", promptText: "" });',
  "save active style"
);

app = mustReplace(
  app,
  `                <button className="text-button" type="button" onClick={() => {\n                  const source = activeProject?.style;\n                  setStyleDraft(source ? { name: source.name + " – kopia", genre: source.genre, promptText: source.promptText, previewImage: source.previewImage, linePreviewImage: source.linePreviewImage } : { name: "", genre: "Custom", promptText: "" });\n                }}>{tr("saveCurrentStyleAsNew")}</button>`,
  `                <div className="style-library-head-actions">\n                  {activeProject ? <label className="style-render-toggle"><input type="checkbox" checked={activeProject.renderOptions?.linesOnly ?? false} onChange={(e)=>setLinesOnly(e.target.checked)} /><span>Lines only, no colors</span></label> : null}\n                  <button className="text-button" type="button" onClick={() => {\n                    const source = activeProject?.style;\n                    setStyleDraft(source ? { name: source.name + " – kopia", genre: source.genre, promptText: source.promptText, previewImage: source.previewImage, linePreviewImage: source.linePreviewImage } : { name: "", genre: "Custom", promptText: "" });\n                  }}>{tr("saveCurrentStyleAsNew")}</button>\n                </div>`,
  "lines only header control"
);

app = mustReplace(
  app,
  `                    <label>{tr("prompt")}<textarea rows={6} value={styleDraft.promptText} onChange={(e) => setStyleDraft({ ...styleDraft, promptText: e.target.value })} /></label>\n                    <div className="style-editor-actions"><button className="text-button" type="button" onClick={() => setStyleDraft(null)}>{tr("cancel")}</button><button className="primary-button" type="button" onClick={saveDraft}>{tr("save")}</button></div>`,
  `                    <label>{tr("prompt")}<textarea rows={6} value={styleDraft.promptText} onChange={(e) => setStyleDraft({ ...styleDraft, promptText: e.target.value })} /></label>\n                    <div className="style-editor-images">\n                      <div className="style-editor-image-slot"><span>Color preview</span>{styleDraft.previewImage?<div className="style-editor-image-preview"><img src={styleDraft.previewImage} alt="" /></div>:<div className="style-editor-image-empty">{tr("noImage")}</div>}<div className="style-editor-image-actions"><label className="text-button style-image-upload">{styleDraft.previewImage?tr("changeImage"):tr("uploadImage")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>{const file=e.target.files?.[0];if(file)void updateStyleDraftImage("previewImage",file);e.currentTarget.value="";}} /></label>{styleDraft.previewImage?<button className="text-button danger-button" type="button" onClick={()=>setStyleDraft({...styleDraft,previewImage:undefined})}>{tr("deleteImage")}</button>:null}</div></div>\n                      <div className="style-editor-image-slot"><span>Lines only preview</span>{styleDraft.linePreviewImage?<div className="style-editor-image-preview"><img src={styleDraft.linePreviewImage} alt="" /></div>:<div className="style-editor-image-empty">{tr("noImage")}</div>}<div className="style-editor-image-actions"><label className="text-button style-image-upload">{styleDraft.linePreviewImage?tr("changeImage"):tr("uploadImage")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>{const file=e.target.files?.[0];if(file)void updateStyleDraftImage("linePreviewImage",file);e.currentTarget.value="";}} /></label>{styleDraft.linePreviewImage?<button className="text-button danger-button" type="button" onClick={()=>setStyleDraft({...styleDraft,linePreviewImage:undefined})}>{tr("deleteImage")}</button>:null}</div></div>\n                    </div>\n                    <div className="style-editor-actions"><button className="text-button" type="button" onClick={() => setStyleDraft(null)}>{tr("cancel")}</button><button className="primary-button" type="button" onClick={saveDraft}>{tr("save")}</button></div>`,
  "style preview editor"
);

app = mustReplace(
  app,
  `                    const custom = style.id.startsWith("custom-");\n                    const active = activeProject?.style.id===style.id;\n                    return <article className={active?"style-card is-active":"style-card"} key={style.id} onClick={()=>activeProject&&applyStyleToActiveProject(style)}>\n                      <div className="style-card-preview" aria-hidden="true"></div>`,
  `                    const custom = style.id.startsWith("custom-");\n                    const active = activeProject?.style.id===style.id;\n                    const linesOnly = activeProject?.renderOptions?.linesOnly ?? false;\n                    const previewImage = linesOnly ? (style.linePreviewImage ?? style.previewImage) : style.previewImage;\n                    const lineFallback = linesOnly && !style.linePreviewImage && Boolean(style.previewImage);\n                    return <article className={active?"style-card is-active":"style-card"} key={style.id} onClick={()=>activeProject&&applyStyleToActiveProject(style)}>\n                      <div className={lineFallback?"style-card-preview is-line-fallback":"style-card-preview"}>{previewImage?<img src={previewImage} alt="" loading="lazy" decoding="async" />:<span>{tr("noImage")}</span>}{linesOnly?<span className="style-preview-mode-badge">LINES ONLY</span>:null}</div>`,
  "style card previews"
);

fs.writeFileSync("src/App.tsx", app);

let styles = fs.readFileSync("src/styles.css", "utf8");
if (!styles.includes("/* Enhanced style preview controls */")) {
  styles += `\n\n/* Enhanced style preview controls */\n.style-library-head-actions{display:flex;align-items:center;gap:12px}.style-render-toggle{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-dim);white-space:nowrap}.style-render-toggle input{accent-color:var(--ink)}.style-card-preview{position:relative;overflow:hidden;display:grid;place-items:center;color:var(--text-faint);font-size:11px}.style-card-preview img{width:100%;height:100%;object-fit:cover;display:block}.style-card-preview.is-line-fallback img{filter:grayscale(1) contrast(1.15)}.style-preview-mode-badge{position:absolute;left:8px;bottom:8px;padding:3px 6px;border-radius:3px;background:rgb(42 34 24 / .76);color:#fff;font-size:9px;font-weight:700;letter-spacing:.08em}.style-editor-images{display:grid;grid-template-columns:1fr 1fr;gap:12px;grid-column:1/-1}.style-editor-image-slot{display:grid;gap:7px;padding:10px;border:1px solid var(--border-soft);border-radius:6px}.style-editor-image-slot>span{font-size:11px;font-weight:600}.style-editor-image-preview,.style-editor-image-empty{width:100%;aspect-ratio:16/9;border-radius:4px;overflow:hidden;background:var(--raised)}.style-editor-image-preview img{width:100%;height:100%;object-fit:cover;display:block}.style-editor-image-empty{display:grid;place-items:center;color:var(--text-faint);font-size:11px}.style-editor-image-actions{display:flex;gap:8px;align-items:center}.style-image-upload{position:relative;overflow:hidden;cursor:pointer}.style-image-upload input{position:absolute;inset:0;opacity:0;cursor:pointer}@media(max-width:760px){.style-library-head-actions{align-items:flex-start;flex-direction:column}.style-editor-images{grid-template-columns:1fr}}\n`;
}
fs.writeFileSync("src/styles.css", styles);

let library = fs.readFileSync("src/stylesLibrary.ts", "utf8");
library = library.replaceAll("/style-previews/fb-1.svg", "/style-previews/fb-1.webp")
  .replaceAll("/style-previews/fb-2.svg", "/style-previews/fb-2.webp")
  .replaceAll("/style-previews/fb-3.svg", "/style-previews/fb-3.webp")
  .replaceAll("/style-previews/fb-4.svg", "/style-previews/fb-4.webp")
  .replaceAll("/style-previews/anchor-1.svg", "/style-previews/anchor-1.webp")
  .replaceAll("/style-previews/er-1.svg", "/style-previews/er-1.webp")
  .replaceAll("/style-previews/er-2.svg", "/style-previews/er-2.webp")
  .replaceAll("/style-previews/er-4.svg", "/style-previews/er-4.webp")
  .replaceAll("/style-previews/adv-1.svg", "/style-previews/adv-1.webp")
  .replaceAll("/style-previews/adv-2.svg", "/style-previews/adv-2.webp")
  .replaceAll("/style-previews/adv-3.svg", "/style-previews/adv-3.webp");
library = mustReplace(
  library,
  '].map(([id,name,genre,promptText,previewImage]) => ({ id, name, genre, promptText, previewImage }));',
  '].map(([id,name,genre,promptText,previewImage,linePreviewImage]) => ({ id, name, genre, promptText, previewImage, linePreviewImage }));',
  "style preview tuple mapping"
);
fs.writeFileSync("src/stylesLibrary.ts", library);

for (const path of ["public/style-previews/fb-1.svg", ".github/style-library-finalize.trigger", "scripts/finalize-style-library.mjs", ".github/workflows/finalize-style-library.yml"]) {
  try { fs.rmSync(path); } catch {}
}
