import { isOpenAlbum, summarizeAlbum, type AlbumSummary, type LocalAlbum } from "./albumSummary";
import { createAssetPacker, unpackAlbum } from "./albumAssets";
import type { ComicProject } from "./project";

export const ALBUM_DATABASE = "comicbook-ai.album-records";
const MANIFEST = "collection";
const MIGRATION = "migration";
const HISTORY = "history";
const STORES = ["catalog", "albums", "assets"];
type AlbumPointer = Omit<AlbumSummary, "cover"> & { revision: string; cover?: unknown; coverHashes: string[] };
type Manifest = { revision: string; albums: AlbumPointer[] };
type StoredAlbum = { json: string; hashes: string[] };
type Checkpoint = { id: string; savedAt: string; albums: AlbumPointer[] };
type Migration = { fingerprint: string; albums: AlbumPointer[] };
export type AlbumCatalog = Readonly<Manifest>;

export interface AlbumStorage {
  catalog(): Promise<AlbumCatalog | undefined>;
  summaries(catalog: AlbumCatalog): Promise<AlbumSummary[]>;
  openAlbum(album: AlbumPointer): Promise<ComicProject>;
  save(projects: readonly LocalAlbum[], base: AlbumCatalog | undefined, previous: ReadonlyMap<string, ComicProject>): Promise<AlbumCatalog>;
  migrate(projects: readonly ComicProject[], fingerprint: string): Promise<AlbumCatalog>;
  checkpoints(): Promise<Checkpoint[]>;
}

type Transaction = (name: string) => IDBObjectStore;

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pending = factory.open(ALBUM_DATABASE, 1);
    let blocked = false;
    pending.onupgradeneeded = () => {
      for (const name of STORES) pending.result.createObjectStore(name);
    };
    pending.onblocked = () => {
      blocked = true;
      reject(new DOMException("Close other windows and retry", "InvalidStateError"));
    };
    pending.onerror = () => reject(pending.error);
    pending.onsuccess = () => blocked ? pending.result.close() : resolve(pending.result);
  });
}

export function createAlbumStorage(factory: IDBFactory): AlbumStorage {
  const pack = createAssetPacker();

  async function transact<T>(stores: string[], mode: IDBTransactionMode, run: (store: Transaction) => Promise<T>): Promise<T> {
    const db = await openDatabase(factory);
    try {
      const tx = db.transaction(stores, mode);
      const done = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new DOMException("Transaction aborted", "AbortError"));
      });
      // Handle request and transaction failures even if one rejects before the other.
      const result = run(name => tx.objectStore(name)).catch(error => {
        try { tx.abort(); } catch { /* Already ended. */ }
        throw error;
      });
      const [value] = await Promise.all([result, done]);
      return value;
    } finally {
      db.close();
    }
  }

  async function prepare(project: ComicProject) {
    const packed = await pack(project);
    const { cover: _cover, ...summary } = summarizeAlbum(project);
    const cover = JSON.parse(packed.json).cover;
    const coverHash = cover?.dataUrl?.$comicBinary;
    const pointer: AlbumPointer = {
      ...summary, revision: crypto.randomUUID(), cover, coverHashes: coverHash ? [coverHash] : [],
    };
    return { pointer, packed };
  }

  async function storeAlbum(store: Transaction, { pointer, packed }: Awaited<ReturnType<typeof prepare>>) {
    for (const { hash, blob } of packed.assets) {
      const assets = store("assets");
      if (await request(assets.getKey(hash)) === undefined) await request(assets.put(blob, hash));
    }
    const record: StoredAlbum = { json: packed.json, hashes: packed.hashes };
    await request(store("albums").put(record, pointer.revision));
  }

  const catalog = () => transact(["catalog"], "readonly", async store => {
    const manifest: Manifest | undefined = await request(store("catalog").get(MANIFEST));
    if (manifest !== undefined && (!Array.isArray(manifest.albums) || typeof manifest.revision !== "string")) {
      throw new TypeError("Invalid album catalog");
    }
    return manifest;
  });

  const openAlbum: AlbumStorage["openAlbum"] = async album => {
    const { record, assets } = await transact(["albums", "assets"], "readonly", async store => {
      const record: StoredAlbum | undefined = await request(store("albums").get(album.revision));
      if (!record) throw new Error("Missing album revision");
      const assets = new Map(await Promise.all(record.hashes.map(async hash =>
        [hash, await request<Blob | undefined>(store("assets").get(hash))] as const)));
      return { record, assets };
    });
    const project = await unpackAlbum(record.json, record.hashes, async hash => assets.get(hash));
    if (project.id !== album.id) throw new Error("Invalid album revision");
    return project;
  };

  const conflict = () => new DOMException("Local albums changed in another window", "CollectionConflictError");

  return {
    catalog,
    openAlbum,
    async summaries(catalog) {
      const assets = await transact(["assets"], "readonly", async store => {
        const hashes = new Set(catalog.albums.flatMap(album => album.coverHashes));
        return new Map(await Promise.all([...hashes].map(async hash =>
          [hash, await request<Blob | undefined>(store("assets").get(hash))] as const)));
      });
      return Promise.all(catalog.albums.map(async ({ revision: _revision, cover, coverHashes, ...summary }) => {
        try {
          const preview = await unpackAlbum(JSON.stringify({ cover }), coverHashes, async hash => assets.get(hash));
          return { ...summary, cover: preview.cover };
        } catch {
          // A missing thumbnail must not hide its album or prevent access to recovery.
          return summary;
        }
      }));
    },
    checkpoints: () => transact(["catalog"], "readonly", async store => await request(store("catalog").get(HISTORY)) ?? []),
    async save(projects, base, previous) {
      const old = new Map(base?.albums.map(album => [album.id, album]));
      const changes: Awaited<ReturnType<typeof prepare>>[] = [];
      const albums: AlbumPointer[] = [];
      for (const project of projects) {
        const pointer = old.get(project.id);
        if (pointer && (!isOpenAlbum(project) || previous.get(project.id) === project)) {
          albums.push(pointer);
          continue;
        }
        if (!isOpenAlbum(project)) throw conflict();
        const prepared = await prepare(project);
        changes.push(prepared);
        albums.push(prepared.pointer);
      }
      return transact(STORES, "readwrite", async store => {
        const metadata = store("catalog");
        const current: Manifest | undefined = await request(metadata.get(MANIFEST));
        if (current?.revision !== base?.revision || (!current && await request(metadata.get(MIGRATION)))) throw conflict();
        if (current && current.albums.length === albums.length && current.albums.every((album, i) => album.revision === albums[i].revision)) return current;
        const history: Checkpoint[] = await request(metadata.get(HISTORY)) ?? [];
        const ids = new Set(albums.map(album => album.id));
        const removed = current?.albums.some(album => !ids.has(album.id));
        const savePoint = removed || !history.length || Date.now() - Date.parse(history[0].savedAt) >= 120_000;
        for (const change of changes) await storeAlbum(store, change);
        if (savePoint && (current?.albums.length || albums.length)) {
          const point = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), albums: current?.albums.length ? current.albums : albums };
          await request(metadata.put([point, ...history].slice(0, 3), HISTORY));
        }
        const next = { revision: crypto.randomUUID(), albums };
        await request(metadata.put(next, MANIFEST));
        return next;
      });
    },
    async migrate(projects, fingerprint) {
      // Stage each album separately. The original remains the recovery source until a complete manifest is published.
      if (new Set(projects.map(project => project.id)).size !== projects.length) throw new Error("Duplicate legacy album IDs");
      const initial = await catalog();
      if (initial) return initial;

      for (const [index, project] of projects.entries()) {
        const status = await transact(["catalog"], "readonly", async store => {
          const metadata = store("catalog");
          return {
            published: await request<Manifest | undefined>(metadata.get(MANIFEST)),
            stage: await request<Migration | undefined>(metadata.get(MIGRATION)),
          };
        });
        if (status.published) return status.published;
        if (status.stage && status.stage.fingerprint !== fingerprint) throw conflict();
        if (status.stage?.albums[index]) continue;
        const album = await prepare(project);
        const published = await transact(STORES, "readwrite", async store => {
          const metadata = store("catalog");
          const current: Manifest | undefined = await request(metadata.get(MANIFEST));
          if (current) return current;
          const stage: Migration = await request(metadata.get(MIGRATION)) ?? { fingerprint, albums: [] };
          if (stage.fingerprint !== fingerprint) throw conflict();
          if (stage.albums[index]) return;
          if (stage.albums.length !== index) throw new Error("Invalid migration progress");
          await storeAlbum(store, album);
          stage.albums.push(album.pointer);
          await request(metadata.put(stage, MIGRATION));
        });
        if (published) return published;
      }

      const staged: Migration | undefined = await transact(["catalog"], "readonly", store => request(store("catalog").get(MIGRATION)));
      const albums = staged?.albums ?? [];
      if ((staged && staged.fingerprint !== fingerprint) || albums.length !== projects.length) throw conflict();
      for (const [index, album] of albums.entries()) {
        const restored = await openAlbum(album);
        const expected = projects[index];
        if (JSON.stringify(restored) !== JSON.stringify(expected)) throw new Error("Album migration verification failed");
      }

      return transact(["catalog"], "readwrite", async store => {
        const metadata = store("catalog");
        const current: Manifest | undefined = await request(metadata.get(MANIFEST));
        if (current) return current;
        const stage: Migration | undefined = await request(metadata.get(MIGRATION));
        if (stage && (stage.fingerprint !== fingerprint || stage.albums.length !== albums.length)) throw conflict();
        const manifest = { revision: crypto.randomUUID(), albums };
        await request(metadata.put(manifest, MANIFEST));
        if (albums.length) {
          const point = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), albums };
          await request(metadata.put([point], HISTORY));
        }
        await request(metadata.delete(MIGRATION));
        return manifest;
      });
    },
  };
}
