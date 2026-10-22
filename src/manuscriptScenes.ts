import type { ComicProject } from "./project";
import type { ManuscriptScene } from "./manuscriptSceneTypes";
import type { AdaptationBeat } from "./adaptation/types";
import { manuscriptChapters, chapterForRange } from "./manuscriptChapters";
import { pilotSceneRange } from "./chapterPilot";
import { activeManuscriptAdaptation, withAdaptation, appendAiBeats, type TextRange } from "./manuscriptModel";

export function sceneRange(project:ComicProject,scene:ManuscriptScene):TextRange|undefined {
  const text=project.source.textSnapshot??'';
  if(scene.start===undefined||scene.end===undefined||scene.needsReview||scene.start<0||scene.end>text.length||!text.slice(scene.start,scene.end).trim())return;
  if(scene.chapterId){const c=manuscriptChapters(project).find(c=>c.id===scene.chapterId);if(!c||scene.start<c.start||scene.end>c.end)return;}
  return {start:scene.start,end:scene.end};
}
export function sceneBeats(project:ComicProject,id:string){return activeManuscriptAdaptation(project).beats.filter(b=>b.sourceSceneId===id&&b.status!=='discarded');}
export function ensureSceneBeat(project:ComicProject,id:string):ComicProject {
  const scene=project.manuscriptScenes?.find(s=>s.id===id);if(!scene||scene.omitted||sceneBeats(project,id).length)return project;
  const range=sceneRange(project,scene);if(!range)return project;
  const beat:AdaptationBeat={id:'beat-'+crypto.randomUUID(),order:1,title:scene.title,summary:scene.purpose,beatType:'transition',sourceSceneId:scene.id,chapterId:scene.chapterId,sourceTextExcerpt:(project.source.textSnapshot??'').slice(range.start,range.end),sourceStart:range.start,sourceEnd:range.end,scenePlaceholder:true,
    characterIds:[],dialogueCandidates:[],captionCandidates:[],visualCandidates:[],importance:'medium',visualPriority:'high',density:'normal',targetPanelCount:1,status:'suggested',origin:'heuristic'};
  const a=activeManuscriptAdaptation(project);
  return withAdaptation(project,{...a,beats:[...a.beats,beat].sort((x,y)=>(x.sourceStart??Infinity)-(y.sourceStart??Infinity)).map((b,i)=>({...b,order:i+1}))});
}
/** Copy StoryBook scene plans locally once, without replacing authored work. */
export function prepareManuscriptScenes(project:ComicProject):ComicProject {
  const scenes=[...(project.manuscriptScenes??[])],created:ManuscriptScene[]=[];
  for(const chapter of manuscriptChapters(project)){
    const context=project.adaptationContext?.chapters.find(c=>c.sourceId===chapter.sourceId);if(!context)continue;
    for(const imported of context.scenes){
      if(!imported.originalText.trim()||scenes.some(s=>s.id===imported.id))continue;
      const range=pilotSceneRange(project,chapter.id,imported.id);
      const scene:ManuscriptScene={id:imported.id,chapterId:chapter.id,sourceChapterId:context.sourceId,origin:'storybook',title:imported.title.replace(/\*\*/g,'').trim(),purpose:imported.instructions.text,preserve:'',originalText:imported.originalText,start:range?.start,end:range?.end,needsReview:!range,omitted:false};
      scenes.push(scene);created.push(scene);
    }
  }
  if(!created.length)return project;
  let next:ComicProject={...project,manuscriptScenes:scenes};
  const a=activeManuscriptAdaptation(next);
  const beats=a.beats.map(b=>{
    if(b.sourceSceneId)return b;
    const owners=scenes.filter(s=>!s.omitted&&s.start!==undefined&&s.end!==undefined&&b.sourceStart!==undefined&&b.sourceEnd!==undefined&&b.sourceStart>=s.start&&b.sourceEnd<=s.end);
    return owners.length===1?{...b,sourceSceneId:owners[0].id}:b;
  });
  if(beats.some((b,i)=>b!==a.beats[i]))next=withAdaptation(next,{...a,beats});
  for(const s of created)next=ensureSceneBeat(next,s.id);
  return next;
}
export function createManuscriptScene(project:ComicProject,range:TextRange,title:string,purpose:string,preserve=''):{project:ComicProject;sceneId:string}{
  const text=project.source.textSnapshot??'',chapter=chapterForRange(project,range.start,range.end);
  if(!title.trim()||!purpose.trim())throw new Error('A scene needs a name and a purpose.');
  if(!Number.isInteger(range.start)||!Number.isInteger(range.end)||range.start<0||range.end>text.length||!text.slice(range.start,range.end).trim()||range.end<=range.start||(manuscriptChapters(project).length&&!chapter))throw new Error('Select text within one chapter.');
  const scene:ManuscriptScene={id:'manuscript-scene-'+crypto.randomUUID(),chapterId:chapter?.id,origin:'manual',title:title.trim(),purpose:purpose.trim(),preserve:preserve.trim(),originalText:text.slice(range.start,range.end),...range,omitted:false};
  const next=ensureSceneBeat({...project,manuscriptScenes:[...(project.manuscriptScenes??[]),scene]},scene.id);
  return {project:next,sceneId:scene.id};
}
export function patchScene(project:ComicProject,id:string,change:Partial<Pick<ManuscriptScene,'title'|'purpose'|'preserve'|'omitted'>>):ComicProject {
  const next={...project,manuscriptScenes:project.manuscriptScenes?.map(s=>s.id===id?{...s,...change}:s)};
  return {...next,adaptations:next.adaptations.map(a=>({...a,beats:a.beats.map(b=>b.sourceSceneId===id&&b.scenePlaceholder?{...b,title:change.title??b.title,summary:change.purpose??b.summary}:b)}))};
}
export function relinkScene(project:ComicProject,id:string,range:TextRange):ComicProject {
  const scene=project.manuscriptScenes?.find(s=>s.id===id),text=project.source.textSnapshot??'',chapter=chapterForRange(project,range.start,range.end);
  if(!scene||!Number.isInteger(range.start)||!Number.isInteger(range.end)||range.start<0||range.end<=range.start||range.end>text.length||!text.slice(range.start,range.end).trim()||(scene.chapterId&&chapter?.id!==scene.chapterId))throw new Error('Select scene text within its chapter.');
  return {...project,manuscriptScenes:project.manuscriptScenes?.map(s=>s.id===id?{...s,...range,needsReview:false}:s),adaptations:project.adaptations.map(a=>({...a,beats:a.beats.map(b=>b.sourceSceneId===id?{...b,sourceNeedsReview:true}:b),panelPlans:a.panelPlans.map(p=>a.beats.some(b=>b.sourceSceneId===id&&p.sourceBeatIds.includes(b.id))?{...p,sourceNeedsReview:true}:p)}))};
}
export function applySceneBeats(project:ComicProject,id:string,beats:AdaptationBeat[]):ComicProject {
  const scene=project.manuscriptScenes?.find(s=>s.id===id),range=scene&&sceneRange(project,scene);if(!scene||scene.omitted||!range||!beats.length)return project;
  if(beats.some(b=>b.sourceStart===undefined||b.sourceEnd===undefined||b.sourceStart<range.start||b.sourceEnd>range.end||(project.source.textSnapshot??'').slice(b.sourceStart,b.sourceEnd)!==b.sourceTextExcerpt))throw new Error('Scene proposals no longer match the manuscript.');
  const a=activeManuscriptAdaptation(project);
  const removable=new Set(a.beats.filter(b=>b.sourceSceneId===id&&b.scenePlaceholder&&!a.panelPlans.some(p=>p.sourceBeatIds.includes(b.id))&&!project.panels.some(p=>p.sourceBeatIds?.includes(b.id))&&!project.pages.some(page=>page.placements.some(p=>p.sourceBeatIds?.includes(b.id)))).map(b=>b.id));
  return appendAiBeats({...project,adaptations:[{...a,beats:a.beats.filter(b=>!removable.has(b.id))},...project.adaptations.filter(x=>x.id!==a.id)]},beats.map(b=>({...b,sourceSceneId:id,chapterId:scene.chapterId})));
}
