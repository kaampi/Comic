import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import type { TextRange } from "./manuscriptModel";
import { sceneRange, sceneBeats, patchScene, relinkScene, ensureSceneBeat } from "./manuscriptScenes";

export function ManuscriptSceneList({project,chapterId,locale,selection,busy,onUpdate,onChoose,onAnalyse}:{project:ComicProject;chapterId?:string;locale:Locale;selection:TextRange|null;busy:boolean;onUpdate:(change:(p:ComicProject)=>ComicProject)=>void;onChoose:(id:string)=>void;onAnalyse:(id:string)=>void}){
  const sv=locale==='sv',t=(a:string,b:string)=>sv?a:b;
  const scenes=(project.manuscriptScenes??[]).filter(s=>chapterId?s.chapterId===chapterId:!s.chapterId).sort((a,b)=>(a.start??Infinity)-(b.start??Infinity));
  return <section className="manuscript-scenes" aria-label={t('Manusets scener','Manuscript scenes')}>
    <h3>{t('Scener','Scenes')} · {scenes.length}</h3>
    <p className="quiet">{t('Varje scen är en berättelseenhet. Dess syfte ska representeras i ett eller flera beats. Markera text och högerklicka för att skapa en scen.','Each scene is a story unit whose purpose should be represented in one or more beats. Select text and right-click to create a scene.')}</p>
    {!scenes.length?<p>{t('Inga scener ännu. Du kan skapa dem från markerad manustext, utan AI.','No scenes yet. Create them from selected manuscript text, without AI.')}</p>:null}
    {scenes.map((scene,index)=>{const range=sceneRange(project,scene),beats=sceneBeats(project,scene.id),placeholder=beats.length>0&&beats.every(b=>b.scenePlaceholder);return <details key={scene.id}><summary>{index+1}. {scene.title||t('Namnlös scen','Untitled scene')} · {scene.omitted?t('utelämnad','omitted'):!range?t('textkoppling måste granskas','source needs review'):!beats.length?t('saknar beat','no beat'):placeholder?t('startbeat','starting beat'):`${beats.length} beats`}</summary>
      <fieldset disabled={busy}>
        <p className="quiet">{scene.origin==='storybook'?'StoryBook':t('Skapad i ComicBook','Created in ComicBook')}</p>
        <label>{t('Scennamn','Scene name')}<input value={scene.title} onChange={e=>onUpdate(p=>patchScene(p,scene.id,{title:e.target.value}))}/></label>
        <label>{t('Vad ska scenen åstadkomma?','What should the scene accomplish?')}<textarea rows={3} value={scene.purpose} onChange={e=>onUpdate(p=>patchScene(p,scene.id,{purpose:e.target.value}))}/></label>
        <label>{t('Viktigt att bevara (valfritt)','Important to preserve (optional)')}<textarea rows={2} value={scene.preserve} onChange={e=>onUpdate(p=>patchScene(p,scene.id,{preserve:e.target.value}))}/></label>
        <label><input type="checkbox" checked={scene.omitted} onChange={e=>onUpdate(p=>{const next=patchScene(p,scene.id,{omitted:e.target.checked});return e.target.checked?next:ensureSceneBeat(next,scene.id);})}/>{t('Utelämna scenen från adaptionen','Omit scene from adaptation')}</label>
        {scene.omitted?<p>{t('Scenen är uttryckligen markerad att utelämnas. Befintliga beats, paneler och bilder behålls för manuell hantering.','The scene is explicitly marked for omission. Existing beats, panels and images are retained for manual handling.')}</p>:null}
        {!range?<p role="alert">{t('Texten har ändrats eller kunde inte kopplas säkert. Granska och koppla scenen till aktuell text innan AI används.','The text changed or could not be safely matched. Review and relink the scene before using AI.')}</p>:null}
        <details><summary>{t('Scenens text','Scene text')}</summary><pre>{scene.start!==undefined&&scene.end!==undefined?(project.source.textSnapshot??'').slice(scene.start,scene.end):scene.originalText}</pre></details>
        {scene.origin==='storybook'?<details><summary>{t('Importerad originaltext','Imported original text')}</summary><pre>{scene.originalText}</pre></details>:null}
        <div className="manuscript-scene-actions">
          <button type="button" disabled={!selection} onClick={()=>{if(selection)onUpdate(p=>relinkScene(p,scene.id,selection));}}>{t('Använd markerad text för scenen','Use selection as scene text')}</button>
          {scene.needsReview&&scene.start!==undefined&&scene.end!==undefined?<button type="button" disabled={scene.start===scene.end} onClick={()=>onUpdate(p=>relinkScene(p,scene.id,{start:scene.start!,end:scene.end!}))}>{t('Bekräfta den uppdaterade scenprosan','Confirm updated scene prose')}</button>:null}
          {!scene.omitted&&!beats.length?<button type="button" disabled={!range} onClick={()=>onUpdate(p=>ensureSceneBeat(p,scene.id))}>{t('Skapa startbeat','Create starting beat')}</button>:null}
          <button type="button" disabled={!range||scene.omitted||!scene.title.trim()||!scene.purpose.trim()} onClick={()=>onAnalyse(scene.id)}>{t('Föreslå seriebeats för scenen','Suggest comic beats for scene')}</button>
        </div>
        {placeholder?<p className="quiet">{t('Startbeatet håller plats för scenen. Det är ingen färdig gestaltning och skapar inga paneler förrän du väljer det.','The starting beat reserves a place for the scene. It is not a finished adaptation and creates no panels until you choose to.')}</p>:null}
        {beats.map(beat=><button type="button" className="text-button" key={beat.id} onClick={()=>onChoose(beat.id)}>{beat.order}. {beat.title}{beat.scenePlaceholder?t(' · startbeat',' · starting beat'):''}</button>)}
      </fieldset>
    </details>;})}
  </section>;
}
