import type { ComicProject } from "./project";
import { pageLayers } from "./pageBackground";
export const BACKUP_WORK_MS=30*60_000, BACKUP_NEW_ITEMS=10;
const KEY="comicbook-ai.backup-reminders";
export type BackupReminderState={version:1;revision:string;backupRevision?:string;known:string[];added:number;workedMs:number};
// A bounded sample avoids hashing megabytes of image data on every text edit.
function imageKey(data:string){let hash=2166136261;const step=Math.max(1,Math.floor(data.length/128));for(let i=0;i<data.length;i+=step)hash=Math.imul(hash^data.charCodeAt(i),16777619);return `image:${data.length}:${hash>>>0}`;}
export function backupResources(project:ComicProject){
  const ids=new Set<string>(),planPanels=new Map(project.panels.filter(panel=>panel.adaptationPanelPlanId).map(panel=>[panel.adaptationPanelPlanId!,panel.id]));
  const image=(data?:string)=>{if(data)ids.add(imageKey(data));};
  project.panels.forEach(panel=>{ids.add(`panel:${panel.id}`);image(panel.image?.dataUrl);});
  project.adaptations.forEach(adaptation=>adaptation.panelPlans.forEach(plan=>{if(!planPanels.has(plan.id))ids.add(`panel:${plan.id}`);image(plan.image?.dataUrl);plan.imageVersions?.forEach(version=>image(version.dataUrl));}));
  const layer=(item:ComicProject["pages"][number]["placements"][number],isPanel:boolean)=>{if(isPanel)ids.add(`panel:${item.panelId??(item.adaptationPanelPlanId?(planPanels.get(item.adaptationPanelPlanId)??item.adaptationPanelPlanId):item.id)}`);image(item.image?.dataUrl);};
  project.pages.forEach(page=>{const panels=new Set(page.placements.map(panel=>panel.id));pageLayers(page).forEach(item=>layer(item,panels.has(item.id)));});
  project.unplacedPanels?.forEach(item=>layer(item.layer,true));
  image(project.cover?.dataUrl);Object.values(project.references?.characterPortraits??{}).forEach(image);
  return [...ids];
}
export function readBackupReminder(id:string):BackupReminderState|undefined {
  try{const value=JSON.parse(localStorage.getItem(KEY)??"{}")[id];if(value?.version===1&&typeof value.revision==="string"&&(value.backupRevision===undefined||typeof value.backupRevision==="string")&&Array.isArray(value.known)&&value.known.every((key:unknown)=>typeof key==="string")&&Number.isFinite(value.added)&&value.added>=0&&Number.isFinite(value.workedMs)&&value.workedMs>=0)return value;}catch{}return undefined;
}
export function saveBackupReminder(id:string,state:BackupReminderState){
  try{let values:Record<string,BackupReminderState>={};try{const parsed=JSON.parse(localStorage.getItem(KEY)??"{}");if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))values=parsed;}catch{}delete values[id];localStorage.setItem(KEY,JSON.stringify(Object.fromEntries([...Object.entries(values),[id,state]].slice(-60))));}catch{/* A reminder preference must not block album saving or backup creation. */}
}
export function observeBackupReminder(previous:BackupReminderState|undefined,project:ComicProject):BackupReminderState {
  const state=previous??{version:1,revision:project.updatedAt,known:[],added:0,workedMs:0};
  const known=new Set(state.known),resources=backupResources(project);let added=0;
  for(const resource of resources)if(!known.has(resource)){known.add(resource);added++;}
  return {...state,revision:project.updatedAt,known:[...known],added:state.added+added};
}
export function advanceBackupWork(state:BackupReminderState,ms:number):BackupReminderState {
  return state.revision!==state.backupRevision?{...state,workedMs:state.workedMs+Math.max(0,Math.min(15_000,ms))}:state;
}
export function backupReminderDue(state:BackupReminderState){return state.revision!==state.backupRevision&&(state.added>=BACKUP_NEW_ITEMS||state.workedMs>=BACKUP_WORK_MS);}
export function createdBackupState(project:ComicProject):BackupReminderState {
  return {version:1,revision:project.updatedAt,backupRevision:project.updatedAt,known:backupResources(project),added:0,workedMs:0};
}
export function markBackupCreated(project:ComicProject){const state=createdBackupState(project);saveBackupReminder(project.id,state);return state;}
