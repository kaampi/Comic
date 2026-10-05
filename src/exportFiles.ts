const encoder = new TextEncoder();
const bytes = (s: string) => encoder.encode(s);
export function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of data) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function header(size: number) { const b = new Uint8Array(size); return { b, v: new DataView(b.buffer) }; }
// ZIP STORE: no dependency or compression needed for already compressed images.
export function imageArchive(files: { name: string; bytes: Uint8Array }[]): Blob {
  if (files.length > 65535) throw new Error("export-too-large");
  const parts: BlobPart[] = [], central: BlobPart[] = [];
  let offset = 0, centralSize = 0;
  for (const file of files) {
    const name = bytes(file.name), crc = crc32(file.bytes), local = header(30), dir = header(46);
    local.v.setUint32(0, 0x04034b50, true); local.v.setUint16(4, 20, true); local.v.setUint16(6, 0x800, true);
    local.v.setUint16(12, 33, true); local.v.setUint32(14, crc, true); local.v.setUint32(18, file.bytes.length, true); local.v.setUint32(22, file.bytes.length, true); local.v.setUint16(26, name.length, true);
    dir.v.setUint32(0, 0x02014b50, true); dir.v.setUint16(4, 20, true); dir.v.setUint16(6, 20, true); dir.v.setUint16(8, 0x800, true); dir.v.setUint16(14, 33, true);
    dir.v.setUint32(16, crc, true); dir.v.setUint32(20, file.bytes.length, true); dir.v.setUint32(24, file.bytes.length, true); dir.v.setUint16(28, name.length, true); dir.v.setUint32(42, offset, true);
    parts.push(local.b, name, file.bytes as BlobPart); central.push(dir.b, name);
    offset += 30 + name.length + file.bytes.length; centralSize += 46 + name.length;
    if (offset + centralSize > 0xffffffff) throw new Error("export-too-large");
  }
  const end = header(22); end.v.setUint32(0, 0x06054b50, true); end.v.setUint16(8, files.length, true); end.v.setUint16(10, files.length, true); end.v.setUint32(12, centralSize, true); end.v.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.b], {type:"application/zip"});
}
export type PdfRasterPage = { bytes: Uint8Array; width: number; height: number };
// Each finished page is a JPEG XObject. MediaBox is in physical PDF points.
export function rasterPdf(pages: PdfRasterPage[], widthMm: number, heightMm: number): Blob {
  const w = widthMm * 72 / 25.4, h = heightMm * 72 / 25.4;
  const parts: BlobPart[] = [], offsets = [0]; let length = 0;
  function append(value: string | Uint8Array) { const data = typeof value === "string" ? bytes(value) : value; parts.push(data as BlobPart); length += data.length; }
  function object(id: number, body: string | (string | Uint8Array)[]) { offsets[id] = length; append(`${id} 0 obj\n`); for (const p of Array.isArray(body) ? body : [body]) append(p); append("\nendobj\n"); }
  append("%PDF-1.4\n%ComicBook\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`);
  pages.forEach((page, i) => {
    const id = 3 + i * 3, content = `q\n${w.toFixed(5)} 0 0 ${h.toFixed(5)} 0 0 cm\n/Im0 Do\nQ\n`;
    object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w.toFixed(5)} ${h.toFixed(5)}] /Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`);
    object(id + 1, [`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`, page.bytes, "\nendstream"]);
    object(id + 2, `<< /Length ${bytes(content).length} >>\nstream\n${content}endstream`);
  });
  const xref = length;
  append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (const n of offsets.slice(1)) append(`${String(n).padStart(10, "0")} 00000 n \n`);
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, {type:"application/pdf"});
}
export function imageDensity(data: Uint8Array, mime: string, dpi: number): Uint8Array {
  if (mime === "image/jpeg") {
    const segment = new Uint8Array([0xff,0xe0,0,16,74,70,73,70,0,1,1,1,dpi >> 8,dpi & 255,dpi >> 8,dpi & 255,0,0]);
    // Replace the encoder's JFIF density rather than adding conflicting headers.
    const skip = data[2] === 255 && data[3] === 224 ? 4 + ((data[4] << 8) | data[5]) : 2;
    const result = new Uint8Array(2 + segment.length + data.length - skip); result.set(data.subarray(0,2)); result.set(segment,2); result.set(data.subarray(skip),20); return result;
  }
  const chunk = header(21), ppm = Math.round(dpi / .0254);
  chunk.v.setUint32(0,9); chunk.b.set(bytes("pHYs"),4); chunk.v.setUint32(8,ppm); chunk.v.setUint32(12,ppm); chunk.b[16] = 1; chunk.v.setUint32(17,crc32(chunk.b.subarray(4,17)));
  // Browser PNG encoders may already emit pHYs. Remove it first.
  const parts = [data.subarray(0,33),chunk.b]; let offset = 33;
  while (offset < data.length) { const size = new DataView(data.buffer,data.byteOffset + offset,4).getUint32(0) + 12; if (new TextDecoder().decode(data.subarray(offset+4,offset+8)) !== "pHYs") parts.push(data.subarray(offset,offset+size)); offset += size; }
  const result = new Uint8Array(parts.reduce((n,p)=>n+p.length,0)); offset=0; for(const p of parts){ result.set(p,offset); offset+=p.length; } return result;
}
