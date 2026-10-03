export async function optimizeStylePreview(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Unsupported image file");

  const bitmap = await createImageBitmap(file);
  const maxWidth = 960;
  const maxHeight = 640;
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not prepare style preview");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.82);
}
