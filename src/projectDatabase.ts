import { isOpenAlbum, type LocalAlbum } from "./albumSummary";
import { createAlbumStorage, type AlbumCatalog, type AlbumStorage } from "./albumStorage";
import { recordDiagnostic, diagnosticErrorName } from "./diagnostics";
import { normalizeStoredProjects, readProjects, saveProjects, type ComicProject } from "./project";
import { classifyProjectSaveError, getProjectSaveFailure, type ProjectSaveFailure } from "./projectSaveStatus";

const LEGACY_DATABASE = "comicbook-ai.albums";
const LEGACY_KEY = "comicbook-ai.projects";
export type RecoveryPoint = { id: string; savedAt: string; albums: number };
type RecoverySnapshot = RecoveryPoint & { serialized: string };

type CapturedProject = { project: LocalAlbum; snapshot: LocalAlbum };
type PendingSave = { captured: CapturedProject[]; promise: Promise<void>; superseded: number };
type Session = {
  storage: AlbumStorage;
  catalog?: AlbumCatalog;
  known?: boolean;
  projects: Map<string, ComicProject>;
  writes: Promise<unknown>;
  pending?: PendingSave;
};

const sessions = new WeakMap<IDBFactory, Session>();

function session(): Session {
  let value = sessions.get(indexedDB);
  if (!value) {
    value = { storage: createAlbumStorage(indexedDB), projects: new Map(), writes: Promise.resolve() };
    sessions.set(indexedDB, value);
  }
  return value;
}

export function hasProjectDatabase(): boolean {
  return typeof indexedDB !== "undefined";
}

export class ProjectStorageError extends Error {
  constructor(public readonly failure: ProjectSaveFailure) {
    super(failure.errorName);
    this.name = "ProjectStorageError";
  }
}

function queue<T>(state: Session, work: () => Promise<T>): Promise<T> {
  const result = state.writes.then(work, work);
  state.writes = result.catch(() => undefined);
  return result;
}

function readLegacyDatabase(): Promise<{ collection?: string; checkpoints: RecoverySnapshot[] }> {
  return new Promise((resolve, reject) => {
    const pending = indexedDB.open(LEGACY_DATABASE, 1);
    let missing = false;
    let blocked = false;
    pending.onupgradeneeded = event => {
      if (event.oldVersion === 0) {
        missing = true;
        pending.transaction?.abort();
      }
    };
    pending.onblocked = () => {
      blocked = true;
      reject(new DOMException("Close other windows and retry", "InvalidStateError"));
    };
    pending.onerror = () => missing ? resolve({ checkpoints: [] }) : reject(pending.error);
    pending.onsuccess = () => {
      const db = pending.result;
      if (blocked) {
        db.close();
        return;
      }
      const tx = db.transaction("snapshots", "readonly");
      const store = tx.objectStore("snapshots");
      const collection = store.get("collection");
      const checkpoints = store.get("recovery-snapshots");
      tx.onabort = () => { db.close(); reject(tx.error); };
      tx.oncomplete = () => {
        db.close();
        const value: unknown = collection.result;
        if (value !== undefined && typeof value !== "string") {
          reject(new TypeError("Invalid legacy collection"));
          return;
        }
        const history = Array.isArray(checkpoints.result) ? checkpoints.result.filter(item =>
          item && typeof item.id === "string" && typeof item.savedAt === "string" &&
          typeof item.serialized === "string" && typeof item.albums === "number") : [];
        resolve({ collection: value, checkpoints: history });
      };
    };
  });
}

function decode(serialized: string): ComicProject[] {
  const data: unknown = JSON.parse(serialized);
  if (!Array.isArray(data) || data.some(p => !p || p.format !== 1 || typeof p.id !== "string" || !p.style || typeof p.style.promptText !== "string")) {
    throw new TypeError("Invalid project collection");
  }
  return normalizeStoredProjects(data);
}

async function migrateLegacy(state: Session): Promise<AlbumCatalog | undefined> {
  const { collection } = await readLegacyDatabase();
  const raw = collection ?? localStorage.getItem(LEGACY_KEY);
  if (raw === null) return;
  const projects = decode(raw);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return state.storage.migrate(projects, fingerprint);
}

export async function loadProjectCollection(): Promise<ComicProject[]> {
  if (!hasProjectDatabase()) return readProjects();
  const state = session();
  try {
    return await queue(state, async () => {
      const catalog = await state.storage.catalog() ?? await migrateLegacy(state);
      const projects = normalizeStoredProjects(await Promise.all(
        (catalog?.albums ?? []).map(album => state.storage.openAlbum(album)),
      ));
      state.catalog = catalog;
      state.known = true;
      state.projects = new Map(projects.map(project => [project.id, project]));
      recordDiagnostic("storage-loaded", { albums: projects.length, backend: "indexedDB" });
      return projects;
    });
  } catch (error) {
    throw new ProjectStorageError(classifyProjectSaveError(error, "storage", "indexedDB"));
  }
}

export async function loadProjectCatalog(): Promise<LocalAlbum[]> {
  if (!hasProjectDatabase()) return readProjects();
  const state = session();
  try {
    return await queue(state, async () => {
      const catalog = await state.storage.catalog() ?? await migrateLegacy(state);
      const summaries = catalog ? await state.storage.summaries(catalog) : [];
      state.catalog = catalog;
      state.known = true;
      state.projects.clear();
      return summaries;
    });
  } catch (error) {
    throw new ProjectStorageError(classifyProjectSaveError(error, "storage", "indexedDB"));
  }
}

export async function loadCatalogAlbum(id: string): Promise<ComicProject> {
  const state = session();
  return queue(state, async () => {
    const album = state.catalog?.albums.find(album => album.id === id);
    if (!album) throw new Error("Album no longer exists");
    const [project] = normalizeStoredProjects([await state.storage.openAlbum(album)]);
    state.projects.set(id, project);
    return project;
  });
}

export async function listRecoveryPoints(): Promise<RecoveryPoint[]> {
  const points: RecoveryPoint[] = [];
  let readFailure: unknown;
  if (hasProjectDatabase()) {
    try {
      for (const point of await session().storage.checkpoints()) {
        points.push({ ...point, albums: point.albums.length });
      }
    } catch (error) { readFailure = error; }
    try {
      const old = await readLegacyDatabase();
      for (const { serialized: _serialized, ...point } of old.checkpoints) points.push(point);
      if (old.collection) {
        const projects = decode(old.collection);
        if (projects.length) points.push({ id: "legacy-indexedDB", savedAt: "", albums: projects.length });
      }
    } catch (error) { readFailure ??= error; }
  }
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    const projects = raw ? decode(raw) : [];
    if (projects.length) points.push({ id: "legacy-localStorage", savedAt: "", albums: projects.length });
  } catch { /* Keep the original text even when it is not readable. */ }
  if (!points.length && readFailure) throw readFailure;
  return points;
}

export async function readRecoveryPoint(id: string): Promise<ComicProject[]> {
  if (id === "legacy-localStorage") {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw === null) throw new Error("recovery-missing");
    return decode(raw);
  }
  const { storage } = session();
  const current = (await storage.checkpoints().catch(() => [])).find(point => point.id === id);
  if (current) return normalizeStoredProjects(await Promise.all(current.albums.map(storage.openAlbum)));
  const old = await readLegacyDatabase();
  const raw = id === "legacy-indexedDB" ? old.collection : old.checkpoints.find(point => point.id === id)?.serialized;
  if (raw === undefined) throw new Error("recovery-missing");
  return decode(raw);
}

export function saveProjectCollection(projects: LocalAlbum[]): Promise<void> {
  if (!hasProjectDatabase()) {
    return saveProjects(projects.filter(isOpenAlbum)) ? Promise.resolve() : Promise.reject(new ProjectStorageError(getProjectSaveFailure()!));
  }
  const state = session();
  const captured = projects.map(project => ({ project, snapshot: { ...project } }));
  if (state.pending) {
    state.pending.captured = captured;
    state.pending.superseded++;
    return state.pending.promise;
  }

  const batch: PendingSave = { captured, superseded: 0, promise: Promise.resolve() };
  state.pending = batch;
  batch.promise = queue(state, async () => {
    state.pending = undefined;
    const start = performance.now();
    recordDiagnostic("save-start", { albums: batch.captured.length, superseded: batch.superseded });
    try {
      if (!state.known && !await state.storage.catalog()) {
        const old = await readLegacyDatabase();
        if (old.collection !== undefined || localStorage.getItem(LEGACY_KEY) !== null) {
          throw new DOMException("Load older albums before saving", "CollectionConflictError");
        }
      }
      const input = batch.captured.map(({ project, snapshot }) =>
        state.projects.get(project.id) === project ? project : snapshot);
      state.catalog = await state.storage.save(input, state.catalog, state.projects);
      state.known = true;
      state.projects = new Map(batch.captured.map(({ project }) => project).filter(isOpenAlbum).map(project => [project.id, project]));
      recordDiagnostic("save-complete", { durationMs: Math.round(performance.now() - start) });
    } catch (error) {
      recordDiagnostic("save-error", { name: diagnosticErrorName(error), durationMs: Math.round(performance.now() - start) });
      throw new ProjectStorageError(classifyProjectSaveError(error, "storage", "indexedDB"));
    }
  });
  return batch.promise;
}
