import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/mediaValidation.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { isRasterDataUrl, isPortableRasterUrl, validatedFont } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=";
assert.equal(isRasterDataUrl(png), true);
for (const url of [
  png.replace("image/png", "image/jpeg"),
  png.replace("iVBOR", "/////"),
  png.replace("base64,", "base64, "),
  "data:image/png;base64,PHN2Zz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
  "https://example.com/example.png",
]) assert.equal(isRasterDataUrl(url), false, url);
assert.equal(isPortableRasterUrl("data:image/png;base64,AAAA"), true);
assert.equal(isPortableRasterUrl("data:image/svg+xml;base64,AAAA"), false);
assert.equal(isPortableRasterUrl("//example.com/cover.png"), false);

for (const [file, mime] of [["comicneue-400.woff", "font/woff"], ["figtree-variable.woff2", "font/woff2"]]) {
  const bytes = readFileSync(new URL("../public/fonts/" + file, import.meta.url));
  assert.equal((await validatedFont(new Blob([bytes]))).type, mime);
  await assert.rejects(validatedFont(new Blob([bytes.subarray(0, 50)])), /font-load-failed/);
}
await assert.rejects(validatedFont(new Blob(["<html>Not a font</html>"], { type: "font/woff2" })), /font-load-failed/);
console.log("PASS: raster type must match its bytes, portable media stays local, and font containers must match their declared length.");
