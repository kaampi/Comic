import { normalizeStoredProjects, readProjects, saveProjects, type ComicProject } from "./project";
import { classifyProjectSaveError, getProjectSaveFailure, type ProjectSaveFailure } from "./projectSaveStatus";

const DATABASE = 'comicbook-ai.albums';
const STORE = 'snapshots';
const KEY = 'collection';
const LEGACY_KEY = 'comicbook-ai.projects';
let writes: Promise<unknown> = Promise.resolve();
export function hasProjectDatabase(): boolean { return typeof indexedDB !== 'undefined'; }
export class ProjectStorageError extends Error {
  constructor(public readonly failure: ProjectSaveFailure) { super(failure.errorName); this.name = 'ProjectStorageError'; }
}
function queue<T>(work: () => Promise<T>): Promise<T> {
  const result = writes.then(work, work);
  writes = result.catch(() => undefined);
  return result;
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onsuccess = () => { if (settled) request.result.close(); else { settled = true; resolve(request.result); } };
    request.onerror = () => { settled = true; reject(request.error); };
    request.onblocked = () => { settled = true; reject(new DOMException('Close other app tabs and retry', 'InvalidStateError')); };
  });
}
async function read(): Promise<string | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(KEY);
    let value: unknown;
    request.onsuccess = () => { value = request.result; };
    tx.oncomplete = () => { db.close(); typeof value === 'string' || value === undefined ? resolve(value) : reject(new TypeError('Invalid saved collection')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? request.error ?? new DOMException('Read aborted', 'AbortError')); };
  });
}
async function write(serialized: string, onlyIfMissing = false): Promise<string> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let chosen = serialized;
    if (onlyIfMissing) {
      const request = store.get(KEY);
      request.onsuccess = () => {
        if (request.result === undefined) store.put(serialized, KEY);
        else if (typeof request.result === 'string') chosen = request.result;
        else tx.abort();
      };
    } else store.put(serialized, KEY);
    // Request success is not sufficient: wait for the atomic transaction to commit.
    tx.oncomplete = () => { db.close(); resolve(chosen); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new DOMException('Save aborted', 'AbortError')); };
  });
}
function decode(serialized: string): ComicProject[] {
  const data: unknown = JSON.parse(serialized);
  if (!Array.isArray(data) || data.some(p => !p || p.format !== 1 || typeof p.id !== 'string' || !p.style || typeof p.style.promptText !== 'string')) throw new TypeError('Invalid project collection');
  return normalizeStoredProjects(data);
}

export async function loadProjectCollection(): Promise<ComicProject[]> {
  if (!hasProjectDatabase()) return readProjects();
  try {
    await writes;
    const existing = await read();
    if (existing !== undefined) return decode(existing);
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === null) return [];
    // Validate before migration; malformed data must never become an empty collection.
    decode(legacy);
    const migrated = await queue(() => write(legacy, true));
    const projects = decode(migrated);
    // Release the small text quota only after a committed copy has been read back.
    if (migrated === legacy && await read() === legacy) {
      try { if (localStorage.getItem(LEGACY_KEY) === legacy) localStorage.removeItem(LEGACY_KEY); } catch { /* The durable copy is still valid. */ }
    }
    return projects;
  } catch (error) { throw new ProjectStorageError(classifyProjectSaveError(error, 'storage', 'indexedDB')); }
}

export function saveProjectCollection(projects: ComicProject[]): Promise<void> {
  if (!hasProjectDatabase()) {
    return saveProjects(projects) ? Promise.resolve() : Promise.reject(new ProjectStorageError(getProjectSaveFailure()!));
  }
  let serialized: string;
  try { serialized = JSON.stringify(projects); }
  catch (error) { return Promise.reject(new ProjectStorageError(classifyProjectSaveError(error, 'serialization', 'indexedDB'))); }
  // Capture this revision before awaiting; later in-memory edits cannot change it.
  return queue(() => write(serialized)).then(() => undefined, error => { throw new ProjectStorageError(classifyProjectSaveError(error, 'storage', 'indexedDB', serialized.length * 2)); });
}
