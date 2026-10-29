import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import type { TextRange } from "./manuscriptModel";
import { sceneRange, sceneBeats, patchScene, relinkScene, ensureSceneBeat } from "./manuscriptScenes";

function chapterScenes(project:ComicProject,chapterId?:string){return (project.manuscriptScenes??[]).filter(s=>chapterId?s.chapterId===chapterId:!s.chapterId).sort((a,b)=>(a.start??Infinity)-(b.start??Infinity));}
function sceneStatus(project:ComicProject,scene:NonNullable<ComicProject['manuscriptScenes']>[number],sv:boolean){const beats=sceneBeats(project,scene.id);return scene.omitted?(sv?'utelämnad':'omitted'):!sceneRange(project,scene)?(sv?'granska textkopplingen':'source needs review'):!beats.length?(sv?'saknar beat':'no beat'):beats.every(b=>b.scenePlaceholder)?(sv?'startbeat':'starting beat'):`${beats.length} beats`;}
export function ManuscriptSceneNavigation({project,chapterId,locale,selectedSceneId,onSelect}:{project:ComicProject;chapterId?:string;locale:Locale;selectedSceneId?:string;onSelect:(id:string)=>void}){
  const scenes=chapterScenes(project,chapterId),sv=locale==='sv';
  return <nav className="manuscript-scene-navigation" aria-label={sv?'Manusets scener':'Manuscript scenes'}><h3>{sv?'Scener':'Scenes'} · {scenes.length}</h3>{scenes.map((s,i)=><button key={s.id} type="button" aria-current={s.id===selectedSceneId?'true':undefined} onClick={()=>onSelect(s.id)}><span>{i+1}. {s.title|| (sv?'Namnlös scen':'Untitled scene')}</span><small>{sceneStatus(project,s,sv)}</small></button>)}{!scenes.length?<p className="quiet">{sv?'Markera manustext för att skapa en scen.':'Select manuscript text to create a scene.'}</p>:null}</nav>;
}
export function ManuscriptSceneList({project,chapterId,selectedSceneId,locale,selection,busy,onUpdate,onChoose,onAnalyse}:{project:ComicProject;chapterId?:string;selectedSceneId?:string;locale:Locale;selection:TextRange|null;busy:boolean;onUpdate:(change:(p:ComicProject)=>ComicProject)=>void;onChoose:(id:string)=>void;onAnalyse:(id:string)=>void}){
  const sv=locale==='sv',t=(a:string,b:string)=>sv?a:b;
  const scene=chapterScenes(project,chapterId).find(s=>s.id===selectedSceneId);
  if(!scene)return <p className="quiet">{t('Välj en scen till vänster eller skapa en från markerad manustext.','Choose a scene on the left or create one from selected manuscript text.')}</p>;
  const range=sceneRange(project,scene),beats=sceneBeats(project,scene.id),placeholder=beats.length>0&&beats.every(b=>b.scenePlaceholder);
  return <section className="manuscript-scenes" aria-label={t('Scenens egenskaper','Scene properties')}><h3>{t('Scenens egenskaper','Scene properties')}</h3><p className="quiet">{scene.origin==='storybook'?'StoryBook':t('Skapad i kaampi Comic','Created in kaampi Comic')} · {sceneStatus(project,scene,sv)}</p><fieldset disabled={busy}>
    <section className="scene-property-group"><h4>{t('Berättelse','Story')}</h4>
      <label>{t('Scennamn','Scene name')}<input value={scene.title} onChange={e=>onUpdate(p=>patchScene(p,scene.id,{title:e.target.value}))}/></label>
      <label>{t('Vad ska scenen åstadkomma?','What should the scene accomplish?')}<textarea rows={4} value={scene.purpose} onChange={e=>onUpdate(p=>patchScene(p,scene.id,{purpose:e.target.value}))}/></label>
      <label>{t('Viktigt att bevara (valfritt)','Important to preserve (optional)')}<textarea rows={3} value={scene.preserve} onChange={e=>onUpdate(p=>patchScene(p,scene.id,{preserve:e.target.value}))}/></label>
    </section>
    <details className="scene-property-group"><summary>{t('Underlag & textkoppling','Source & link')}</summary>
      {!range?<p role="alert">{t('Texten har ändrats eller kunde inte kopplas säkert. Granska och koppla scenen till aktuell text innan AI används.','The text changed or could not be safely matched. Review and relink the scene before using AI.')}</p>:null}
      <details><summary>{t('Scenens text','Scene text')}</summary><pre>{scene.start!==undefined&&scene.end!==undefined?(project.source.textSnapshot??'').slice(scene.start,scene.end):scene.originalText}</pre></details>
      {scene.origin==='storybook'?<details><summary>{t('Importerad originaltext','Imported original text')}</summary><pre>{scene.originalText}</pre></details>:null}
      <button type="button" disabled={!selection} onClick={()=>{if(selection)onUpdate(p=>relinkScene(p,scene.id,selection));}}>{t('Använd markerad text för scenen','Use selection as scene text')}</button>
      {scene.needsReview&&scene.start!==undefined&&scene.end!==undefined?<button type="button" disabled={scene.start===scene.end} onClick={()=>onUpdate(p=>relinkScene(p,scene.id,{start:scene.start!,end:scene.end!}))}>{t('Bekräfta den uppdaterade scenprosan','Confirm updated scene prose')}</button>:null}
    </details>
    <section className="scene-property-group"><h4>{t('Adaption','Adaptation')}</h4>

      <label className="scene-omit-toggle"><input type="checkbox" checked={scene.omitted} onChange={e=>onUpdate(p=>{const next=patchScene(p,scene.id,{omitted:e.target.checked});return e.target.checked?next:ensureSceneBeat(next,scene.id);})}/>{t('Utelämna scenen från adaptionen','Omit scene from adaptation')}</label>
      {scene.omitted?<p>{t('Befintliga beats, paneler och bilder behålls för manuell hantering.','Existing beats, panels and images are retained for manual handling.')}</p>:null}
      {!scene.omitted&&!beats.length?<button type="button" disabled={!range} onClick={()=>onUpdate(p=>ensureSceneBeat(p,scene.id))}>{t('Skapa startbeat','Create starting beat')}</button>:null}
      {placeholder?<p className="quiet">{t('Startbeatet håller plats för scenen. Det är ingen färdig gestaltning.','The starting beat reserves a place for the scene. It is not a finished adaptation.')}</p>:null}
    </section>
    <details className="scene-property-group"><summary>Beats · {beats.length}</summary><div className="scene-linked-beats">{beats.map(b=><button type="button" className="text-button" key={b.id} onClick={()=>onChoose(b.id)}>{b.order}. {b.title}</button>)}</div></details>
  </fieldset></section>;
}
