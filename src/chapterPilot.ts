import { validateReadingCheck, type ReadingCheck } from "./adaptation/readingCheck";
import type { LocalChatDiagnostics } from "./localAi";
import type { ComicProject } from "./project";
import type { StoryBookImport } from "./storybookImport";
import type { AdaptationBeat } from "./adaptation/types";
import { manuscriptChapters } from "./manuscriptChapters";

export type ReviewedText = { original: string; text: string; approved: boolean };
export type ChapterProfile = {
  fidelity: 'faithful'|'balanced'|'free'; pace: 'concentrated'|'natural'|'reflective';
  focus: Record<'relationships'|'innerDevelopment'|'conflict'|'atmosphere'|'technical', 'low'|'normal'|'high'>;
  instructions: string; protectedMoments: string;
};
export const defaultChapterProfile = (): ChapterProfile => ({fidelity:'balanced',pace:'natural',focus:{relationships:'normal',innerDevelopment:'normal',conflict:'normal',atmosphere:'normal',technical:'normal'},instructions:'',protectedMoments:''});
export type PilotScene = { id:string; order:number; title:string; originalText:string; instructions:ReviewedText; approved:boolean };
export type PilotChapter = { sourceId:string; brief:ReviewedText; scenes:PilotScene[]; profile?:ChapterProfile; approvedCharacters:string[]; approvedLocations:string[] };
export type AdaptationContext = { sourceBookId:string; exportedAt:string; synopsis:ReviewedText; chapters:PilotChapter[] };
export type PilotInputs = { chapterId:string; sceneId:string; source:string; sourceOffset:number; model:string; engine:string; server:string; contextWindow:number; prompt:string; context:unknown };
export type BeatTrial = {
  id:string; variant:'A'|'B'|'C'|'D'; createdAt:string; inputs:PilotInputs; beats:AdaptationBeat[];
  excluded:string[]; applied:string[]; notes:string; diagnostics?:LocalChatDiagnostics; error?:string; readingCheck?:ReadingCheck;
};
const review = (text=''):ReviewedText => ({original:text,text,approved:false});
export function importedAdaptationContext(data:StoryBookImport):AdaptationContext | undefined {
  if(!data.synopsis&&!data.chapters.some(c=>c.brief||c.scenes?.length))return undefined;
  return {sourceBookId:data.sourceBookId,exportedAt:data.exportedAt??'',synopsis:review(data.synopsis),chapters:data.chapters.map(c=>({sourceId:c.id,brief:review(c.brief),scenes:(c.scenes??[]).map((s,i)=>({id:s.id,order:i+1,title:s.title??`Scene ${i+1}`,originalText:s.description,instructions:review(s.instructions),approved:false})),approvedCharacters:[],approvedLocations:[]}))};
}
/** Older albums lack source IDs. Recover them only from unique exact originals. */
export function matchPilotChapters(project:ComicProject,data:StoryBookImport) {
  const chapters=manuscriptChapters(project),used=new Set<string>();
  if(!chapters.length)throw new Error('No manuscript chapters available for matching.');
  return chapters.map(chapter=>{
    const candidates=data.chapters.filter(c=>chapter.sourceId?c.id===chapter.sourceId:c.text===chapter.originalText);
    if(candidates.length!==1||candidates[0].text!==chapter.originalText||used.has(candidates[0].id))
      throw new Error(`Cannot match chapter "${chapter.title}" to the export. The original manuscript must match exactly; use a separate new album to test a revised export.`);
    used.add(candidates[0].id);
    return {...chapter,sourceId:candidates[0].id};
  });
}
export function pilotChapter(project:ComicProject,chapterId:string):PilotChapter | undefined {
  const chapter=manuscriptChapters(project).find(c=>c.id===chapterId);
  return project.adaptationContext?.chapters.find(c=>c.sourceId===chapter?.sourceId);
}
export function updatePilotChapter(project:ComicProject,chapterId:string,change:(chapter:PilotChapter)=>PilotChapter):ComicProject {
  const chapter=pilotChapter(project,chapterId),context=project.adaptationContext;
  return !chapter||!context?project:{...project,adaptationContext:{...context,chapters:context.chapters.map(c=>c===chapter?change(c):c)}};
}
/** Match only exact, ordered manuscript slices. Editing prose invalidates an old scene. */
export function pilotSceneRange(project:ComicProject,chapterId:string,sceneId:string):{start:number;end:number}|undefined {
  const chapter=manuscriptChapters(project).find(c=>c.id===chapterId),context=pilotChapter(project,chapterId);
  if(!chapter||!context)return;
  const prose=(project.source.textSnapshot??'').slice(chapter.start,chapter.end);let cursor=0;
  for(const scene of context.scenes){
    if(!scene.originalText.trim()){if(scene.id===sceneId)return;continue;}
    const at=prose.indexOf(scene.originalText,cursor);
    if(at<0){if(scene.id===sceneId)return;continue;}
    // If repeated prose makes the mapping ambiguous, ask for manual source selection.
    if(scene.id===sceneId){if(prose.indexOf(scene.originalText,at+1)>=0)return;return {start:chapter.start+at,end:chapter.start+at+scene.originalText.length};}
    cursor=at+scene.originalText.length;
  }
}
export function pilotNarrative(project:ComicProject,chapterId:string,sceneId:string) {
  const chapter=pilotChapter(project,chapterId),scene=chapter?.scenes.find(s=>s.id===sceneId),context=project.adaptationContext;
  if(!chapter||!scene||!scene.approved)throw new Error('Review and approve the scene before analysis.');
  return {synopsis:context?.synopsis.approved?context.synopsis.text:'',brief:chapter.brief.approved?chapter.brief.text:'',sceneInstructions:scene.instructions.approved?scene.instructions.text:'',profile:chapter.profile??project.adaptationDefaults??defaultChapterProfile(),
    characterFacts:project.characters.filter(c=>chapter.approvedCharacters.includes(c.id)).map(c=>({id:c.id,name:c.name,description:c.description})),
    locationFacts:project.locations.filter(l=>chapter.approvedLocations.includes(l.id)).map(l=>({id:l.id,name:l.name,description:l.description}))};
}
export function trialIsCurrent(project:ComicProject,trial:BeatTrial):boolean {
  const range=pilotSceneRange(project,trial.inputs.chapterId,trial.inputs.sceneId);
  return !!range&&range.start===trial.inputs.sourceOffset&&(project.source.textSnapshot??'').slice(range.start,range.end)===trial.inputs.source;
}
export function sameTrialSetup(a:BeatTrial,b:BeatTrial):boolean { return JSON.stringify(a.inputs)===JSON.stringify(b.inputs); }

// Validate optional additions independently so old backups remain valid.
export function validatePilotData(project:any):void {
  const fail=()=>{throw new Error('invalid-backup');};
  const obj=(v:any)=>{if(!v||typeof v!=='object'||Array.isArray(v))fail();};
  const str=(v:any)=>{if(typeof v!=='string')fail();};
  const strings=(v:any)=>{if(!Array.isArray(v)||v.some((x:any)=>typeof x!=='string'))fail();};
  const text=(v:any)=>{if(!v||typeof v.approved!=='boolean')fail();str(v.original);str(v.text);};
  const profile=(v:any)=>{if(!v||!['faithful','balanced','free'].includes(v.fidelity)||!['concentrated','natural','reflective'].includes(v.pace))fail();str(v.instructions);str(v.protectedMoments);for(const k of Object.keys(defaultChapterProfile().focus))if(!['low','normal','high'].includes(v.focus?.[k]))fail();};
  if(project.adaptationDefaults!==undefined)profile(project.adaptationDefaults);
  const c=project.adaptationContext;
  if(c!==undefined){str(c?.sourceBookId);str(c?.exportedAt);text(c.synopsis);if(!Array.isArray(c.chapters))fail();const chapters=new Set(),scenes=new Set();
    for(const chapter of c.chapters){obj(chapter);str(chapter.sourceId);if(chapters.has(chapter.sourceId))fail();chapters.add(chapter.sourceId);text(chapter.brief);strings(chapter.approvedCharacters);strings(chapter.approvedLocations);if(chapter.profile)profile(chapter.profile);if(!Array.isArray(chapter.scenes))fail();
      for(const s of chapter.scenes){obj(s);str(s.id);str(s.title);str(s.originalText);text(s.instructions);if(scenes.has(s.id)||!Number.isInteger(s.order)||s.order<1||typeof s.approved!=='boolean')fail();scenes.add(s.id);}
    }
  }
  if(project.beatTrials!==undefined){if(!Array.isArray(project.beatTrials))fail();const ids=new Set();
    for(const r of project.beatTrials){obj(r);if(r.error!==undefined)str(r.error);
      if(r.diagnostics!==undefined){const d=r.diagnostics;obj(d);str(d.requestBody);try{obj(JSON.parse(d.requestBody));}catch{fail();}for(const k of ['responseBody','rawReply','finishReason'])if(d[k]!==undefined)str(d[k]);if(!Number.isInteger(d.maxOutputTokens)||d.maxOutputTokens<1||!Number.isInteger(d.contextWindow)||d.contextWindow<1024)fail();}
      str(r.id);str(r.createdAt);str(r.notes);if(ids.has(r.id)||!['A','B','C','D'].includes(r.variant))fail();ids.add(r.id);strings(r.excluded);strings(r.applied);const i=r.inputs;obj(i);for(const k of ['chapterId','sceneId','source','model','engine','server','prompt'])str(i[k]);if(!Number.isInteger(i.sourceOffset)||i.sourceOffset<0||!Number.isInteger(i.contextWindow)||i.contextWindow<1024)fail();if(!Array.isArray(r.beats))fail();if(r.readingCheck!==undefined){if(r.variant!=='D'||r.beats.length)fail();try{validateReadingCheck(r.readingCheck,i.source);}catch{fail();}}if(r.variant==='D'&&(r.beats.length||r.applied.length))fail();
      for(const b of r.beats){obj(b);if(!['establishing','introduction','action','dialogue','reaction','transition','atmosphere','climax','resolution'].includes(b.beatType)||!Number.isInteger(b.targetPanelCount)||b.targetPanelCount<1||b.targetPanelCount>12)fail();for(const k of ['id','title','summary','sourceTextExcerpt','beatType'])str(b[k]);for(const k of ['sourceSceneId','adaptationReason','unresolvedLocation'])if(b[k]!==undefined)str(b[k]);strings(b.characterIds);if(b.unresolvedCharacters!==undefined)strings(b.unresolvedCharacters);if(!Number.isInteger(b.sourceStart)||!Number.isInteger(b.sourceEnd)||b.sourceStart<i.sourceOffset||b.sourceEnd>i.sourceOffset+i.source.length||b.sourceEnd<=b.sourceStart||i.source.slice(b.sourceStart-i.sourceOffset,b.sourceEnd-i.sourceOffset)!==b.sourceTextExcerpt)fail();for(const k of ['dialogueCandidates','captionCandidates','visualCandidates'])if(!Array.isArray(b[k]))fail();for(const v of b.visualCandidates){obj(v);str(v.id);str(v.description);}for(const t of [...b.dialogueCandidates,...b.captionCandidates]){obj(t);str(t.id);str(t.text);}}
    }
  }
}
