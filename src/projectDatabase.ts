import { recordDiagnostic, diagnosticErrorName } from "./diagnostics";
import { normalizeStoredProjects, readProjects, saveProjects, type ComicProject } from "./project";
import { classifyProjectSaveError, getProjectSaveFailure, type ProjectSaveFailure } from "./projectSaveStatus";

const DATABASE = 'comicbook-ai.albums';
const STORE = 'snapshots';
const KEY = 'collection';
const LEGACY_KEY = 'comicbook-ai.projects';
const RECOVERY_KEY = 'recovery-snapshots';
export type RecoveryPoint = { id: string; savedAt: string; albums: number };
type RecoverySnapshot = RecoveryPoint & { serialized: string };
type Session = { known: boolean; snapshot?: string; ids: string[]; checkpointAt: number };
const sessions = new WeakMap<object, Session>();
function session(): Session {
  let value=sessions.get(indexedDB);
  if(!value){value={known:false,ids:[],checkpointAt:0};sessions.set(indexedDB,value);}
  return value;
}
function remember(snapshot: string | undefined, projects: ComicProject[]) {
  Object.assign(session(),{known:true,snapshot,ids:projects.map(project=>project.id)});
}
function recoveryList(value: unknown): RecoverySnapshot[] {
  return Array.isArray(value)?value.filter(item=>item&&typeof item.id==='string'&&typeof item.savedAt==='string'&&typeof item.serialized==='string'&&typeof item.albums==='number').slice(0,3):[];
}
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
async function write(serialized: string, onlyIfMissing = false, ids: string[] = []): Promise<string> {
  const state=session(),db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite'),store=tx.objectStore(STORE);
    let chosen=serialized, failure: Error | undefined, checkpointAt=state.checkpointAt;
    const request=store.get(KEY);
    request.onsuccess=()=>{
      const current=request.result;
      if(current!==undefined&&typeof current!=='string'){failure=new TypeError('Invalid saved collection');tx.abort();return;}
      if(onlyIfMissing&&current!==undefined){chosen=current;return;}
      if(!onlyIfMissing&&((state.known&&current!==state.snapshot)||(!state.known&&current!==undefined))){
        failure=new DOMException('Saved collection changed; reload before writing','CollectionConflictError');tx.abort();return;
      }
      const removed=state.ids.some(id=>!ids.includes(id));
      const shouldCheckpoint=onlyIfMissing||!!current&&(removed||Date.now()-state.checkpointAt>=120_000);
      if(shouldCheckpoint){
        const previous=onlyIfMissing?serialized:current;
        let albums=onlyIfMissing?JSON.parse(serialized).length:state.ids.length;
        if(previous&&albums){
          const history=store.get(RECOVERY_KEY);
          history.onsuccess=()=>{
            const old=recoveryList(history.result);
            if(old[0]?.serialized!==previous)store.put([{id:crypto.randomUUID(),savedAt:new Date().toISOString(),albums,serialized:previous},...old].slice(0,3),RECOVERY_KEY);
          };
          checkpointAt=Date.now();
        }
      }
      store.put(serialized,KEY);
    };
    // Compare, checkpoint and replace within one transaction, including across tabs.
    tx.oncomplete=()=>{db.close();state.known=true;state.snapshot=chosen;state.checkpointAt=checkpointAt;if(!onlyIfMissing)state.ids=ids;resolve(chosen);};
    tx.onabort=()=>{db.close();reject(failure??tx.error??new DOMException('Save aborted','AbortError'));};
  });
}
export async function listRecoveryPoints(): Promise<RecoveryPoint[]> {
  let snapshots:RecoverySnapshot[]=[], readFailure:unknown;
  if(hasProjectDatabase())try{
    const db=await open();
    snapshots=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(RECOVERY_KEY);tx.oncomplete=()=>{db.close();resolve(recoveryList(request.result));};tx.onabort=()=>{db.close();reject(tx.error);};});
  }catch(error){readFailure=error;}
  try{const raw=localStorage.getItem(LEGACY_KEY);if(raw){const projects=decode(raw);if(projects.length)snapshots.push({id:'legacy-localStorage',savedAt:'',albums:projects.length,serialized:raw});}}catch{/* Malformed legacy data is retained, never overwritten. */}
  if(!snapshots.length&&readFailure)throw readFailure;
  return snapshots.map(({serialized,...point})=>point);
}
export async function readRecoveryPoint(id:string): Promise<ComicProject[]> {
  if(id==='legacy-localStorage'){const raw=localStorage.getItem(LEGACY_KEY);if(!raw)throw new Error('recovery-missing');return decode(raw);}
  const db=await open();
  const snapshots:RecoverySnapshot[]=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(RECOVERY_KEY);tx.oncomplete=()=>{db.close();resolve(recoveryList(request.result));};tx.onabort=()=>{db.close();reject(tx.error);};});
  const snapshot=snapshots.find(item=>item.id===id);if(!snapshot)throw new Error('recovery-missing');return decode(snapshot.serialized);
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
    if (existing !== undefined) {const projects=decode(existing);remember(existing,projects);recordDiagnostic('storage-loaded',{albums:projects.length,bytes:existing.length*2,backend:'indexedDB'});return projects;}
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === null) {remember(undefined,[]);recordDiagnostic("storage-empty",{backend:"indexedDB"});return [];}
    // Validate before migration; malformed data must never become an empty collection.
    decode(legacy);
    const migrated = await queue(() => write(legacy, true));
    const projects = decode(migrated);remember(migrated,projects);
    // Release the small text quota only after a committed copy has been read back.
    if (migrated === legacy && await read() === legacy) {
      try { if (localStorage.getItem(LEGACY_KEY) === legacy) localStorage.removeItem(LEGACY_KEY); } catch { /* The durable copy is still valid. */ }
    }
    return projects;
  } catch (error) { throw new ProjectStorageError(classifyProjectSaveError(error, 'storage', 'indexedDB')); }
}

type PendingSave = { serialized: string; ids: string[]; promise: Promise<void>; superseded: number };
let pendingSave: PendingSave | undefined;

export function saveProjectCollection(projects: ComicProject[]): Promise<void> {
  if (!hasProjectDatabase()) {
    return saveProjects(projects) ? Promise.resolve() : Promise.reject(new ProjectStorageError(getProjectSaveFailure()!));
  }
  let serialized: string;
  const started = performance.now();
  try { serialized = JSON.stringify(projects); }
  catch (error) { recordDiagnostic('serialization-error', { name: diagnosticErrorName(error) }); return Promise.reject(new ProjectStorageError(classifyProjectSaveError(error, 'serialization', 'indexedDB'))); }
  recordDiagnostic('save-serialize', { durationMs: Math.round(performance.now() - started), bytes: serialized.length * 2, albums: projects.length });
  // Keep at most one active snapshot and one pending snapshot. All callers in a
  // pending batch settle only when its newest revision has atomically committed.
  // Capture as text now so later in-memory mutation cannot change the snapshot.
  if (pendingSave) {
    pendingSave.serialized = serialized;pendingSave.ids=projects.map(project=>project.id);
    pendingSave.superseded++;
    return pendingSave.promise;
  }
  const batch: PendingSave = { serialized, ids:projects.map(project=>project.id), superseded: 0, promise: Promise.resolve() };
  pendingSave = batch;
  batch.promise = queue(async () => {
    pendingSave = undefined;
    const snapshot = batch.serialized;
    batch.serialized = '';
    const bytes = snapshot.length * 2;
    const start = performance.now();
    recordDiagnostic('save-start', { bytes, superseded: batch.superseded });
    try {
      await write(snapshot,false,batch.ids);
      recordDiagnostic('save-complete', { bytes, durationMs: Math.round(performance.now() - start) });
    } catch (error) {
      recordDiagnostic('save-error', { name: diagnosticErrorName(error), bytes, durationMs: Math.round(performance.now() - start) });
      throw new ProjectStorageError(classifyProjectSaveError(error, 'storage', 'indexedDB', bytes));
    }
  });
  return batch.promise;
}

