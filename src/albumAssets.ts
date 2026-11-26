import type { ComicProject } from "./project";

type BinaryAsset = { hash: string; blob: Blob };
type PackedAlbum = { json: string; hashes: string[]; assets: BinaryAsset[] };
const MEDIA = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/i;
const KEY = "$comicBinary";
type AssetRef = { [KEY]: string; prefix: string };

async function hashBytes(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

export function createAssetPacker() {
  // The editor reuses image strings between revisions. Retain only the most recent pack's cache.
  let previous = new Map<string, Promise<BinaryAsset | undefined>>();
  return async function pack(project: ComicProject): Promise<PackedAlbum> {
    const current = new Map<string, Promise<BinaryAsset | undefined>>();
    const assetPaths: Array<{ container: Record<string, unknown>; key: string; url: string }> = [];
    function copy(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(copy);
      if (!value || typeof value !== "object") return value;
      const result: Record<string, unknown> = Object.create(null);
      for (const [key, child] of Object.entries(value)) {
        result[key] = copy(child);
        if (typeof child !== "string" || !child.startsWith("data:image/")) continue;
        if (!current.has(child)) current.set(child, previous.get(child) ?? decodeAsset(child));
        assetPaths.push({ container: result, key, url: child });
      }
      return result;
    }

    const detached = copy(project);
    const assets = new Map<string, BinaryAsset>();
    for (const { container, key, url } of assetPaths) {
      const asset = await current.get(url);
      if (!asset) continue;
      const ref: AssetRef = { [KEY]: asset.hash, prefix: url.slice(0, url.indexOf(",") + 1) };
      container[key] = ref;
      assets.set(asset.hash, asset);
    }
    previous = current;
    return { json: JSON.stringify(detached), hashes: [...assets.keys()], assets: [...assets.values()] };
  };
}

async function decodeAsset(url: string): Promise<BinaryAsset | undefined> {
  const match = MEDIA.exec(url);
  if (!match) return;
  try {
    const bytes = Uint8Array.from(atob(match[2]), character => character.charCodeAt(0));
    if (base64(bytes) !== match[2]) return;
    return { hash: await hashBytes(bytes), blob: new Blob([bytes]) };
  } catch (error) {
    if (error instanceof DOMException && error.name === "InvalidCharacterError") return;
    throw error;
  }
}

export async function unpackAlbum(
  json: string,
  hashes: readonly string[],
  read: (hash: string) => Promise<Blob | undefined>,
): Promise<ComicProject> {
  const assets = new Map(await Promise.all(hashes.map(async hash => {
    const blob = await read(hash);
    if (!blob) throw new Error("Missing album asset");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (await hashBytes(bytes) !== hash) throw new Error("Invalid album asset digest");
    return [hash, base64(bytes)] as const;
  })));

  return JSON.parse(json, (_key, value: unknown) => {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, KEY)) return value;
    const ref = value as AssetRef;
    const data = assets.get(ref[KEY]);
    if (!data || !/^data:image\/(?:png|jpeg|webp|gif);base64,$/i.test(ref.prefix)) {
      throw new Error("Invalid album asset reference");
    }
    return ref.prefix + data;
  });
}
