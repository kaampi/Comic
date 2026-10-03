import fs from "node:fs";
import path from "node:path";

const sourceDir = "scripts/style-preview-data";
const targetDir = "public/style-previews";
fs.mkdirSync(targetDir, { recursive: true });

for (const name of fs.readdirSync(sourceDir)) {
  const sourcePath = path.join(sourceDir, name);
  if (name.endsWith(".b64")) {
    const base64 = fs.readFileSync(sourcePath, "utf8").trim();
    fs.writeFileSync(path.join(targetDir, name.replace(/\.b64$/, ".webp")), Buffer.from(base64, "base64"));
  }
  if (name.endsWith(".json")) {
    const assets = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    for (const [assetName, base64] of Object.entries(assets)) {
      fs.writeFileSync(path.join(targetDir, assetName), Buffer.from(base64, "base64"));
    }
  }
}

fs.rmSync(sourceDir, { recursive: true, force: true });
fs.rmSync("scripts/install-style-assets.mjs", { force: true });
