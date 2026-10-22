import { useEffect, useRef, useState } from "react";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import type { LocalAiSettings, LocalChatDiagnostics } from "./localAi";
import { beatPrompt } from "./aiPrompts";
import { BEAT_SELECTION_PROMPT, suggestBeatSelection } from "./adaptation/beatSelection";
import { suggestAiBeats } from "./adaptation/aiBeats";
import { appendAiBeats } from "./manuscriptModel";
import type { ManuscriptChapter } from "./manuscriptChapters";
import { parseStoryBookExport } from "./storybookImport";
import { BeatAnalysisDialog } from "./BeatAnalysisDialog";
import { defaultChapterProfile, matchPilotChapters, importedAdaptationContext, pilotChapter, pilotNarrative, pilotSceneRange, sameTrialSetup, trialIsCurrent, updatePilotChapter, type AdaptationContext, type BeatTrial, type ChapterProfile, type ReviewedText } from "./chapterPilot";
import "./chapterPilot.css";

function ReviewText({label,value,onChange,sv}:{label:string;value:ReviewedText;onChange:(value:ReviewedText)=>void;sv:boolean}) {
  return <div className="pilot-review-text"><label>{label}<textarea rows={4} value={value.text} onChange={e=>onChange({...value,text:e.target.value,approved:false})}/></label>
    <label className="pilot-check"><input type="checkbox" checked={value.approved} onChange={e=>onChange({...value,approved:e.target.checked})}/>{sv?'Godkänt för AI-underlag':'Approved for AI context'}</label>
    <details><summary>{sv?'Visa importerad originaltext':'Show imported original'}</summary><pre>{value.original||'—'}</pre></details>
  </div>;
}
export function ChapterBeatPilot({project,chapterId,locale,settings,onUpdate}:{project:ComicProject;chapterId:string;locale:Locale;settings:LocalAiSettings;onUpdate:(change:(p:ComicProject)=>ComicProject)=>void}) {
  const sv=locale==='sv',t=(se:string,en:string)=>sv?se:en,chapter=pilotChapter(project,chapterId);
  const [sceneId,setSceneId]=useState(chapter?.scenes.find(s=>s.originalText.trim())?.id??''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[pending,setPending]=useState<{context:AdaptationContext;chapters:ManuscriptChapter[]}>();
  const controller=useRef<AbortController>(),revision=useRef(0),latest=useRef(project),fileRevision=useRef(0);latest.current=project;
  const source=project.source.textSnapshot??'';
  useEffect(()=>{setSceneId(chapter?.scenes.find(s=>s.originalText.trim())?.id??'');setMessage('');setPending(undefined);fileRevision.current++;},[chapterId,project.adaptationContext?.exportedAt]);
  useEffect(()=>{revision.current++;controller.current?.abort();setBusy(false);return()=>{revision.current++;fileRevision.current++;controller.current?.abort();};},[project.id,chapterId,source]);
  const scene=chapter?.scenes.find(s=>s.id===sceneId),range=scene?pilotSceneRange(project,chapterId,scene.id):undefined;
  const profile=chapter?.profile??project.adaptationDefaults??defaultChapterProfile();
  const patchChapter=(change:Parameters<typeof updatePilotChapter>[2])=>onUpdate(p=>updatePilotChapter(p,chapterId,change));
  const patchProfile=(change:Partial<ChapterProfile>)=>patchChapter(c=>({...c,profile:{...profile,...change}}));
  const trials=(project.beatTrials??[]).filter(r=>r.inputs.chapterId===chapterId&&r.inputs.sceneId===sceneId);
  const run=async(variant:'A'|'B'|'C')=>{
    if(!scene||!range||!chapter)return;
    if(!settings.servers[settings.engine].model.trim()){setMessage(t('Välj en textmodell i Settings först.','Select a text model in Settings first.'));return;}
    const token=++revision.current,abort=new AbortController();controller.current=abort;
    const narrative=pilotNarrative(project,chapterId,sceneId);
    const known={characters:project.characters.map(c=>({id:c.id,name:c.name})),locations:project.locations.map(l=>({id:l.id,name:l.name}))};
    const selectionNarrative={...narrative,characterFacts:narrative.characterFacts.map(({name,description})=>({name,description})),locationFacts:narrative.locationFacts.map(({name,description})=>({name,description}))};
    const inputs={chapterId,sceneId,source:source.slice(range.start,range.end),sourceOffset:range.start,model:settings.servers[settings.engine].model,engine:settings.engine,server:settings.servers[settings.engine].baseUrl,contextWindow:settings.contextWindow,prompt:variant==='C'?BEAT_SELECTION_PROMPT:beatPrompt(settings),context:variant==='C'?{narrative:selectionNarrative}:{narrative,known}};
    let diagnostics:LocalChatDiagnostics|undefined;
    setBusy(true);setMessage('');const timer=window.setTimeout(()=>abort.abort(),300000);
    try{
      const beats=variant==='C'?await suggestBeatSelection({source:inputs.source,sourceOffset:range.start,narrativeContext:selectionNarrative,settings,signal:abort.signal,onDiagnostics:value=>{diagnostics=value;}}):await suggestAiBeats({source:inputs.source,sourceOffset:range.start,context:known,settings,signal:abort.signal,singleRequest:true,onDiagnostics:value=>{diagnostics=value;},allowUnknownCharacters:true,taskPrompt:inputs.prompt,...(variant==='B'?{narrativeContext:narrative}:{})});
      if(token!==revision.current||abort.signal.aborted)return;
      const trial:BeatTrial={id:'beat-trial-'+crypto.randomUUID(),variant,createdAt:new Date().toISOString(),inputs,diagnostics,beats:beats.map(b=>({...b,chapterId,sourceSceneId:sceneId})),excluded:[],applied:[],notes:''};
      if(!trialIsCurrent(latest.current,trial))return;
      onUpdate(p=>({...p,beatTrials:[...(p.beatTrials??[]),trial]}));
      setMessage(t(`Test ${variant} sparat. Inga beats har lagts till i albumet.`,`Test ${variant} saved. No beats have been added to the album.`));
    }catch(error){if(token===revision.current){
      const detail=String(error instanceof Error?error.message:error);
      setMessage(abort.signal.aborted?t('Analysen avbröts. Tidigare resultat finns kvar.','Analysis cancelled. Previous results are preserved.'):detail);
      if(!abort.signal.aborted&&diagnostics){
        const failed:BeatTrial={id:'beat-trial-'+crypto.randomUUID(),variant,createdAt:new Date().toISOString(),inputs,diagnostics,error:detail,beats:[],excluded:[],applied:[],notes:''};
        if(trialIsCurrent(latest.current,failed))onUpdate(p=>({...p,beatTrials:[...(p.beatTrials??[]),failed]}));
      }
    }}
    finally{window.clearTimeout(timer);if(token===revision.current)setBusy(false);}
  };
  const patchTrial=(id:string,change:Partial<BeatTrial>)=>onUpdate(p=>({...p,beatTrials:p.beatTrials?.map(r=>r.id===id?{...r,...change}:r)}));
  const attach=async(file:File)=>{
    const token=++fileRevision.current;
    try{const data=parseStoryBookExport(await file.text());if(token!==fileRevision.current)return;
      const current=latest.current;
      if(!current.source.storyBookId||data.sourceBookId!==current.source.storyBookId)throw new Error(t('Exporten hör till en annan bok.','The export belongs to a different book.'));
      const chapters=matchPilotChapters(current,data);
      const context=importedAdaptationContext(data);if(!context)throw new Error(t('Filen saknar synopsis, Briefs och scener.','The file has no synopsis, Briefs or scenes.'));setPending({context,chapters});setMessage('');
    }catch(error){if(token===fileRevision.current)setMessage(error instanceof Error?error.message:String(error));}
  };
  return <details className="chapter-pilot"><summary>{t('Kapitelpilot – underlag och beatförslag','Chapter pilot – context and beat suggestions')}</summary>
    <p>{t('Granska underlaget och välj en scen. A använder scenprosan och namn/ID. B lägger till godkänt berättelseunderlag och dina prioriteringar. Testerna körs var för sig, med ett anrop per test.','Review the context and choose a scene. A uses scene prose and names/IDs. B adds approved story context and chapter priorities. Run tests separately, with one request per test.')}</p>
    {!chapter?<><p>{t('Detta album saknar importerat scenunderlag. Läs in den nya exporten för samma bok. Manus, bilder och befintliga beats behålls.','This album has no imported scene context. Load the new export for the same book. Manuscript, images and existing beats are retained.')}</p><label>{t('Läs in pilotunderlag','Load pilot context')}<input type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)void attach(f);e.currentTarget.value='';}}/></label>
      {pending?<><p>{t('Underlaget är inläst för granskning. Det används inte av AI ännu.','Context loaded for review. It is not approved for AI use yet.')}</p><button type="button" onClick={()=>{onUpdate(p=>({...p,source:{...p.source,chapters:pending.chapters},adaptationContext:pending.context}));setPending(undefined);}}>{t('Lägg till underlaget i albumet','Add context to album')}</button></>:null}</>:<fieldset disabled={busy}>
      <details><summary>{t('Granska berättelseunderlag','Review story context')}</summary>
        <ReviewText sv={sv} label="Synopsis" value={project.adaptationContext!.synopsis} onChange={value=>onUpdate(p=>({...p,adaptationContext:{...p.adaptationContext!,synopsis:value}}))}/>
        <ReviewText sv={sv} label={t('Kapitlets Brief','Chapter Brief')} value={chapter.brief} onChange={brief=>patchChapter(c=>({...c,brief}))}/>
      </details>
      <label>{t('Scen','Scene')}<select value={sceneId} onChange={e=>setSceneId(e.target.value)}>{chapter.scenes.map(s=><option key={s.id} value={s.id} disabled={!s.originalText.trim()}>{s.order}. {s.title.replace(/\*\*/g,'').trim()}{!s.originalText.trim()?t(' (tom)',' (empty)'):''}</option>)}</select></label>
      {scene?<details open><summary>{t('Granska vald scen','Review selected scene')}</summary>
        <p className="quiet">{t('Scenprosan måste motsvara en entydig passage i manusets arbetskopia.','Scene prose must match an unambiguous passage in the manuscript working copy.')}</p><pre className="pilot-scene-source">{scene.originalText}</pre>
        <label className="pilot-check"><input type="checkbox" checked={scene.approved} disabled={!range} onChange={e=>patchChapter(c=>({...c,scenes:c.scenes.map(s=>s.id===sceneId?{...s,approved:e.target.checked}:s)}))}/>{t('Scenprosan är granskad','Scene prose reviewed')}</label>
        {!range?<p role="alert">{t('Scenen är tom, ändrad eller kan inte kopplas entydigt till manuset. Återställ/justera arbetskopian innan scenen testas.','The scene is empty, edited or cannot be mapped unambiguously to the manuscript. Review the working copy before testing this scene.')}</p>:null}
        <ReviewText sv={sv} label={t('Scenens instruktion','Scene instructions')} value={scene.instructions} onChange={instructions=>patchChapter(c=>({...c,scenes:c.scenes.map(s=>s.id===sceneId?{...s,instructions}:s)}))}/>
      </details>:null}
      <details><summary>{t('Adaption för kapitlet','Chapter adaptation')}</summary>
        <label className="pilot-check"><input type="checkbox" checked={!chapter.profile} onChange={e=>patchChapter(c=>({...c,profile:e.target.checked?undefined:structuredClone(profile)}))}/>{t('Använd albumets standard','Use album defaults')}</label>
        <label>{t('Manustrohet','Fidelity')}<select value={profile.fidelity} onChange={e=>patchProfile({fidelity:e.target.value as ChapterProfile['fidelity']})}><option value="faithful">{t('Trogen','Faithful')}</option><option value="balanced">{t('Balanserad','Balanced')}</option><option value="free">{t('Fri komprimering','Freer compression')}</option></select></label>
        <label>{t('Berättartempo','Pacing')}<select value={profile.pace} onChange={e=>patchProfile({pace:e.target.value as ChapterProfile['pace']})}><option value="concentrated">{t('Koncentrerat','Concentrated')}</option><option value="natural">{t('Naturligt','Natural')}</option><option value="reflective">{t('Eftertänksamt','Reflective')}</option></select></label>
        <div className="pilot-focus">{Object.entries(profile.focus).map(([key,value])=><label key={key}>{({relationships:t('Relationer och närhet','Relationships'),innerDevelopment:t('Inre utveckling','Inner development'),conflict:t('Konflikt och spänning','Conflict'),atmosphere:t('Miljö och atmosfär','Atmosphere'),technical:t('Tekniska detaljer','Technical details')} as Record<string,string>)[key]}<select value={value} onChange={e=>patchProfile({focus:{...profile.focus,[key]:e.target.value}})}><option value="low">{t('Låg','Low')}</option><option value="normal">Normal</option><option value="high">{t('Hög','High')}</option></select></label>)}</div>
        <label>{t('Kapitelinstruktion','Chapter instructions')}<textarea rows={3} value={profile.instructions} onChange={e=>patchProfile({instructions:e.target.value})}/></label>
        <label>{t('Måste bevaras / bedömningsunderlag','Must preserve / evaluation criteria')}<textarea rows={3} value={profile.protectedMoments} onChange={e=>patchProfile({protectedMoments:e.target.value})}/></label>
        <button type="button" onClick={()=>onUpdate(p=>({...p,adaptationDefaults:structuredClone(profile)}))}>{t('Använd dessa val som albumstandard','Use these choices as album defaults')}</button>
        <p className="quiet">{t('Prioriteringar är instruktioner, inte garantier. AI:n får inte hitta på händelser eller skriva om källtexten.','Priorities are instructions, not guarantees. AI must not invent events or rewrite source text.')}</p>
      </details>
      <details><summary>{t('Granska relevanta karaktärs- och platsfakta','Review relevant character and location facts')}</summary>
        <p className="quiet">{t('Markera bara fakta som är relevanta och gäller vid denna punkt i berättelsen. Namn och ID skickas i båda testen; markerade fakta skickas bara i B.','Approve only relevant facts that apply at this point in the story. Both tests receive names and IDs; only B receives approved facts.')}</p>
        {(['characters','locations'] as const).map(kind=>project[kind].map(entity=>{const key=kind==='characters'?'approvedCharacters':'approvedLocations';return <details key={entity.id}><summary>{entity.name}</summary><p>{entity.description||t('Fakta saknas.','No facts available.')}</p><label className="pilot-check"><input type="checkbox" checked={chapter[key].includes(entity.id)} disabled={!entity.description.trim()} onChange={e=>patchChapter(c=>({...c,[key]:e.target.checked?[...c[key],entity.id]:c[key].filter(id=>id!==entity.id)}))}/>{t('Godkänn dessa fakta för kapitlet','Approve these facts for this chapter')}</label></details>;}))}
      </details>
      <div className="pilot-actions"><button type="button" disabled={!scene?.approved||!range} onClick={()=>void run('A')}>{t('Kör A – utan berättelseunderlag','Run A – without story context')}</button><button type="button" className="primary-button" disabled={!scene?.approved||!range} onClick={()=>void run('B')}>{t('Kör B – med godkänt underlag','Run B – with approved context')}</button></div>
      <button type="button" disabled={!scene?.approved||!range} onClick={()=>void run('C')}>{t('Kör C – enbart urval med godkänt underlag','Run C – selection only with approved context')}</button>
      <p className="quiet">{t('C använder en separat kort urvalsprompt och godkänt underlag. Inga bilder, typer eller karaktärs-/plats-ID:n begärs. Ett anrop; resultatet är endast för granskning.','C uses a separate short selection prompt and approved context. No images, types or character/location IDs are requested. One request; results are for review only.')}</p>
      <p className="quiet">{t('Använd samma modell, prompt och prioriteringar i A och B. Ändrar du dem, kör båda testen igen. Förslag läggs inte till automatiskt.','Use the same model, prompt and priorities for A and B. If you change them, rerun both tests. Suggestions are never added automatically.')}</p>
    </fieldset>}
    {message?<p role="status">{message}</p>:null}
    {trials.length>1?<p className="pilot-comparison">{(()=>{const a=trials.filter(r=>r.variant==='A').at(-1),b=trials.filter(r=>r.variant==='B').at(-1);return a&&b?(sameTrialSetup(a,b)?t('Senaste A och B har samma testförutsättningar.','Latest A and B use the same test setup.'):t('Senaste A och B har olika testförutsättningar. Kör om båda innan du jämför.','Latest A and B have different setups. Rerun both before comparing.')):'';})()}</p>:null}
    <div className="pilot-results">{trials.map(trial=>{
      const current=trialIsCurrent(project,trial),selected=trial.beats.filter(b=>!trial.excluded.includes(b.id)&&!trial.applied.includes(b.id));
      return <details key={trial.id} open className="pilot-trial"><summary>{trial.variant} · {trial.inputs.model} · {new Date(trial.createdAt).toLocaleString()} · {trial.beats.length} beats{trial.variant==='C'?t(' · enbart urval',' · selection only'):''}</summary>
        {trial.error?<p role="alert">{t('Testet misslyckades: ','Test failed: ')}{trial.error}</p>:null}
        {trial.diagnostics?<details><summary>{t('Visa AI-diagnostik','Show AI diagnostics')}</summary>
          <p>{t('Svarsgräns','Output limit')}: {trial.diagnostics.maxOutputTokens} tokens · {t('Kontext','Context')}: {trial.diagnostics.contextWindow} · {t('Avslutsorsak','Finish reason')}: {trial.diagnostics.finishReason??'—'}</p>
          <p className="quiet">{t('Det faktiska anropet och svaret sparas med testet. Inga extra AI-anrop görs.','The actual request and response are saved with the trial. No additional AI requests are made.')}</p>
          <label>{t('Hela anropet (inklusive systeminstruktioner och numrerade segment)','Full request (including system instructions and numbered segments)')}<textarea readOnly rows={12} value={JSON.stringify(JSON.parse(trial.diagnostics.requestBody),null,2)}/></label>
          <label>{t('Modellens råsvar före bearbetning','Raw model reply before processing')}<textarea readOnly rows={10} value={trial.diagnostics.rawReply??t('Inget textsvar mottaget.','No text reply received.')}/></label>
          <details><summary>{t('Hela serversvaret och metadata','Full server response and metadata')}</summary><textarea readOnly rows={10} value={trial.diagnostics.responseBody??t('Inget serversvar mottaget.','No server response received.')}/></details>
        </details>:<p className="quiet">{t('AI-diagnostik saknas för detta äldre test.','AI diagnostics are unavailable for this older trial.')}</p>}
        {!current?<p role="alert">{t('Källtexten har ändrats. Resultatet kan granskas men inte läggas till.','Source text changed. You can review this result but cannot apply it.')}</p>:null}
        {trial.beats.map(b=><article key={b.id}><label className="pilot-check"><input type="checkbox" disabled={!current||trial.applied.includes(b.id)||busy} checked={!trial.excluded.includes(b.id)} onChange={e=>patchTrial(trial.id,{excluded:e.target.checked?trial.excluded.filter(id=>id!==b.id):[...trial.excluded,b.id]})}/><strong>{b.title}</strong>{trial.applied.includes(b.id)?t(' · tillagt',' · added'):''}</label><p>{b.summary}</p>{b.adaptationReason?<p className="quiet">{b.adaptationReason}</p>:null}<p><em>{b.visualCandidates[0]?.description}</em></p>{b.unresolvedCharacters?.length?<p className="pilot-warning">{t('Karaktärsreferenser att komplettera: ','Character references to review: ')}{b.unresolvedCharacters.join(', ')}</p>:null}{b.unresolvedLocation?<p className="pilot-warning">{t('Plats att komplettera: ','Location to review: ')}{b.unresolvedLocation}</p>:null}<blockquote>{b.sourceTextExcerpt}</blockquote></article>)}
        <label>{t('Bedömning: urval, uppdelning, känslor, källtrogenhet och luckor','Evaluation: selection, splitting, emotion, source fidelity and omissions')}<textarea rows={3} value={trial.notes} onChange={e=>patchTrial(trial.id,{notes:e.target.value})}/></label>
        <details><summary>{t('Visa testets underlag','Show test inputs')}</summary><pre>{JSON.stringify(trial.inputs,null,2)}</pre></details>
        {trial.variant==='C'?<p className="quiet">{t('Enbart urval – inga bildförslag eller paneler skapas från detta test.','Selection only – this trial does not create visual proposals or panels.')}</p>:<button type="button" className="primary-button" disabled={!current||!selected.length||busy} onClick={()=>onUpdate(p=>{
          const saved=p.beatTrials?.find(r=>r.id===trial.id);if(!saved||saved.variant==='C'||!trialIsCurrent(p,saved))return p;
          const picked=saved.beats.filter(b=>!saved.excluded.includes(b.id)&&!saved.applied.includes(b.id));
          const next=appendAiBeats(p,picked);return {...next,beatTrials:next.beatTrials?.map(r=>r.id===saved.id?{...r,applied:[...r.applied,...picked.map(b=>b.id)]}:r)};
        })}>{t('Lägg till valda beats i albumet','Add selected beats to album')}</button>}
      </details>;
    })}</div>
    {busy?<BeatAnalysisDialog locale={locale} progress={t('Kapitelpilot · ett anrop','Chapter pilot · one request')} onCancel={()=>{revision.current++;controller.current?.abort();setBusy(false);setMessage(t('Analysen avbröts.','Analysis cancelled.'));}}/>:null}
  </details>;
}
