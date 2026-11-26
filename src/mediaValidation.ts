export const RASTER_LIMIT = 32 * 1024 * 1024;
const FONT_LIMIT = 8 * 1024 * 1024;
type RasterMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

function rasterMime(header: string): RasterMime | undefined {
  if (header.startsWith("\x89PNG\r\n\x1a\n") && header.slice(12, 16) === "IHDR") return "image/png";
  if (header.startsWith("\xff\xd8\xff")) return "image/jpeg";
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(header.slice(12, 16))) return "image/webp";
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) return "image/gif";
}

function validBase64(value: string, maxBytes: number) {
  if (!value.length || value.length % 4 || value.length > Math.ceil(maxBytes / 3) * 4) return false;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return value.length / 4 * 3 - padding <= maxBytes && !/[^A-Za-z0-9+/]/.test(value.slice(0, value.length - padding));
}

export function isRasterDataUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const comma = url.indexOf(",");
  if (comma < 0 || comma > 32) return false;
  const type = /^data:(image\/(?:png|jpeg|webp|gif));base64$/i.exec(url.slice(0, comma))?.[1].toLowerCase();
  const payload = url.slice(comma + 1);
  return Boolean(type && validBase64(payload, RASTER_LIMIT) && rasterMime(atob(payload.slice(0, 24))) === type);
}

export function readBlobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("invalid-media"));
    reader.onerror = () => reject(reader.error ?? new Error("invalid-media"));
    reader.readAsDataURL(blob);
  });
}

export async function readRasterFile(file: File): Promise<string> {
  if (file.size > RASTER_LIMIT || !/^image\/(?:png|jpeg|webp|gif)$/.test(file.type)) throw new Error("invalid-image");
  const dataUrl = await readBlobDataUrl(file);
  if (!isRasterDataUrl(dataUrl)) throw new Error("invalid-image");
  return dataUrl;
}

export async function validatedFont(blob: Blob): Promise<Blob> {
  if (blob.size < 12 || blob.size > FONT_LIMIT) throw new Error("font-load-failed");
  const bytes = new Uint8Array(await blob.slice(0, 48).arrayBuffer());
  const header = String.fromCharCode(...bytes.subarray(0, 4));
  const view = new DataView(bytes.buffer);
  const mime = { wOFF: "font/woff", wOF2: "font/woff2", OTTO: "font/otf", "\x00\x01\x00\x00": "font/ttf" }[header];
  if (!mime) throw new Error("font-load-failed");
  if (header === "wOFF" || header === "wOF2") {
    const minHeader = header === "wOFF" ? 44 : 48;
    if (bytes.length < minHeader || view.getUint32(8) !== blob.size || view.getUint16(12) === 0) throw new Error("font-load-failed");
  } else {
    const tables = view.getUint16(4);
    if (!tables || 12 + tables * 16 > blob.size) throw new Error("font-load-failed");
  }
  return new Blob([blob], { type: mime });
}
