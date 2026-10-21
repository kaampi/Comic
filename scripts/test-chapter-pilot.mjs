import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".chapter-pilot-test-"));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:5176/" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent", "FileReader", "File", "HTMLInputElement", "SVGElement", "NodeFilter", "HTMLTextAreaElement"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.PointerEvent=dom.window.MouseEvent;
Object.defineProperty(globalThis,"PointerEvent",{value:dom.window.MouseEvent,configurable:true});
dom.window.confirm=()=>true;
let networkRequests = 0;
const nativeFetch=globalThis.fetch;
globalThis.fetch = async url => { if(String(url).startsWith('data:'))return nativeFetch(url); networkRequests++; throw new Error("offline"); };
symlinkSync(join(root, "node_modules"), join(temporary, "node_modules"), process.platform === "win32" ? "junction" : "dir");

function compile(directory = "") {
  for (const entry of readdirSync(join(root, "src", directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { compile(path); continue; }
    if (!/\.tsx?$/.test(entry.name) || entry.name === "main.tsx") continue;
    const output = ts.transpileModule(readFileSync(join(root, "src", path), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText.replace(/import "[^"\n]+\.css";?/g, "").replace(/from "(\.[^"]+)"/g, (_, imported) => {
      if (imported.endsWith(".json")) return 'from "' + pathToFileURL(resolve(root, "src", dirname(path), imported)) + '" with { type: "json" }';
      return 'from "' + imported + '.mjs"';
    });
    mkdirSync(join(temporary, directory), { recursive: true });
    writeFileSync(join(temporary, path.replace(/\.tsx?$/, ".mjs")), output.replace(/import\("(\.[^"]+)"\)/g,'import("$1.mjs")'));
  }
}

try {
  compile();
  const React=await import('react'),{render,screen,within,fireEvent,waitFor,cleanup,act}=await import('@testing-library/react');
  const {default:userEvent}=await import('@testing-library/user-event');
  const local=p=>import(pathToFileURL(join(temporary,p+'.mjs')));
  const {parseStoryBookExport}=await local('storybookImport'),pilot=await local('chapterPilot'),{importManuscriptChapters}=await local('manuscriptChapters'),{createProject,normalizeStoredProjects}=await local('project');
  const {packAlbumBackup,parseAlbumBackup}=await local('albumBackup'),{ChapterBeatPilot}=await local('ChapterBeatPilot'),{defaultLocalAiSettings}=await local('localAi'),{parseAiBeats,suggestAiBeats}=await local('adaptation/aiBeats'),{addManualBeat,editManuscriptChapter}=await local('manuscriptModel');
  const first='Rook reached the bridge. Seren raised a hand. “Wait,” she said.',second='Rook examined the sealed crate.';
  const raw={kind:'storycore.manuscript-export',format:2,exportedAt:'2026-10-22T10:00:00Z',sourceApp:'storybook-ai',sourceBookId:'book-fixture',title:'Pilot fixture',illustrationStyle:'',synopsis:'Rook must learn to trust his crew. The crate becomes important later.',bible:[],chapters:[{id:'source-chapter',sequence_index:0,title:'Return',prose:first+'\n\n'+second,brief:'Establish trust and introduce the crate.',scenes:[{id:'scene-1',sequence_index:0,title:'The bridge',description:first,instructions:'Preserve the hesitant greeting.'},{id:'scene-2',sequence_index:1,title:'The crate',description:second},{id:'empty-scene',sequence_index:2,description:''}]}]};
  const rawSnapshot=JSON.stringify(raw),data=parseStoryBookExport(rawSnapshot),source=importManuscriptChapters(data.chapters);
  assert.equal(JSON.stringify(raw),rawSnapshot);assert.equal(data.synopsis,raw.synopsis);assert.equal(data.chapters[0].scenes.length,3);
  const legacy=parseStoryBookExport(JSON.stringify({...raw,format:1,synopsis:undefined,chapters:[{...raw.chapters[0],brief:undefined,scenes:undefined}]}));assert.equal(pilot.importedAdaptationContext(legacy),undefined,'old exports remain supported');
  assert.throws(()=>parseStoryBookExport(JSON.stringify({...raw,chapters:[{...raw.chapters[0],scenes:[raw.chapters[0].scenes[0],raw.chapters[0].scenes[0]]}]})),/Duplicate/);
  let project=createProject('Pilot fixture','storybook');project.source={type:'storybook',storyBookId:raw.sourceBookId,textSnapshot:source.text,chapters:source.chapters};project.characters=[{id:'rook',sourceId:'source-rook',name:'Rook',description:'A cautious captain.',visualIdentity:''}];
  project.adaptationContext=pilot.importedAdaptationContext(data);
  const chapterId=source.chapters[0].id;
  assert.deepEqual(pilot.pilotSceneRange(project,chapterId,'scene-1'),{start:0,end:first.length});assert.equal(pilot.pilotSceneRange(project,chapterId,'empty-scene'),undefined);
  const repeated={...project,source:{...project.source,textSnapshot:first+'\n\n'+first,chapters:[{...source.chapters[0],end:first.length*2+2}]}};assert.equal(pilot.pilotSceneRange(repeated,chapterId,'scene-1'),undefined,'ambiguous matches are rejected');
  project=addManualBeat(project,{start:0,end:23}).project;
  project.pages=[{id:'existing-page',number:1,gridColumns:3,gridRows:5,placements:[]}];
  const originalBeats=structuredClone(project.adaptations[0].beats),originalPages=structuredClone(project.pages);
  const settings=defaultLocalAiSettings();settings.servers.ollama.model='pilot-test';
  let working=project;const user=userEvent.setup({document});
  function Harness(){const [p,set]=React.useState(project);working=p;return React.createElement(React.Fragment,null,React.createElement(ChapterBeatPilot,{project:p,chapterId,locale:'en',settings,onUpdate:change=>set(prev=>change(prev))}),React.createElement('button',{onClick:()=>set(prev=>editManuscriptChapter(prev,chapterId,'Changed '+prev.source.textSnapshot))},'Edit source for test'));}
  render(React.createElement(Harness));await user.click(screen.getByText('Chapter pilot – context and beat suggestions',{selector:'summary'}));
  assert.equal(networkRequests,0);
  const runA=()=>screen.getByRole('button',{name:'Run A – without story context'}),runB=()=>screen.getByRole('button',{name:'Run B – with approved context'});
  assert.equal(runA().disabled,true);
  await user.click(screen.getByText('Review story context',{selector:'summary'}));
  const approve=label=>within(screen.getByRole('textbox',{name:label,exact:true}).closest('.pilot-review-text')).getByRole('checkbox');
  await user.click(approve('Synopsis'));await user.click(approve('Chapter Brief'));await user.click(approve('Scene instructions'));await user.click(screen.getByRole('checkbox',{name:'Scene prose reviewed'}));
  assert.equal(runA().disabled,false);
  const reply={beats:[{from:1,to:2,title:'The hesitant greeting',summary:'Rook meets Seren on the bridge.',visualDescription:'At the doorway, Rook pauses opposite Seren, whose palm is raised.',reason:'Their hesitant greeting establishes fragile trust.',beatType:'reaction',characterIds:['rook','unknown-seren'],unresolvedCharacters:['Seren'],locationId:null}]};
  assert.throws(()=>parseAiBeats(JSON.stringify(reply),first,{characters:[{id:'rook',name:'Rook'}],locations:[]},0,true),/unknown character/,'existing strict callers remain strict');
  const bodies=[];globalThis.fetch=async(_url,init)=>{networkRequests++;bodies.push(JSON.parse(init.body));return new Response(JSON.stringify({message:{content:JSON.stringify(reply)},done_reason:'stop'}));};
  await user.click(runA());await waitFor(()=>assert.equal(working.beatTrials?.length,1));
  assert.equal(bodies.length,1,'one scene trial makes one request');assert.equal(JSON.parse(bodies[0].messages[1].content).narrativeContext,undefined);
  assert.deepEqual(working.adaptations[0].beats,originalBeats);assert.deepEqual(working.pages,originalPages);
  await user.click(runB());await waitFor(()=>assert.equal(working.beatTrials.length,2));
  const payload=JSON.parse(bodies[1].messages[1].content);assert.equal(payload.narrativeContext.synopsis,raw.synopsis);assert.equal(payload.narrativeContext.brief,raw.chapters[0].brief);assert.equal(payload.narrativeContext.sceneInstructions,raw.chapters[0].scenes[0].instructions);assert.deepEqual(payload.narrativeContext.characterFacts,[],'unapproved facts are not sent');
  assert.equal(bodies[0].model,bodies[1].model);assert.equal(bodies[0].options.num_ctx,bodies[1].options.num_ctx);
  assert.ok(pilot.sameTrialSetup(working.beatTrials[0],working.beatTrials[1]));assert.ok(screen.getByText('Latest A and B use the same test setup.'));
  assert.ok(working.beatTrials[1].beats[0].unresolvedCharacters.includes('Seren'));assert.equal(working.beatTrials[1].beats[0].sourceSceneId,'scene-1');
  const backup=parseAlbumBackup(packAlbumBackup(working));assert.deepEqual(backup.beatTrials,working.beatTrials);assert.deepEqual(backup.adaptationContext,working.adaptationContext);assert.deepEqual(normalizeStoredProjects([JSON.parse(JSON.stringify(working))])[0].beatTrials,JSON.parse(JSON.stringify(working.beatTrials)));
  const broken=structuredClone(packAlbumBackup(working));broken.project.adaptationContext.synopsis.approved='yes';assert.throws(()=>parseAlbumBackup(broken),/invalid-backup/);
  const corrupt=structuredClone(packAlbumBackup(working));corrupt.project.beatTrials[0].beats[0].sourceEnd=99999;assert.throws(()=>parseAlbumBackup(corrupt),/invalid-backup/);
  await user.click(screen.getAllByRole('button',{name:'Add selected beats to album'})[1]);assert.equal(working.adaptations[0].beats.length,originalBeats.length+1);assert.deepEqual(working.pages,originalPages);assert.equal(working.beatTrials[1].applied.length,1);
  // A late result after cancellation cannot replace or append earlier trials.
  let finish;globalThis.fetch=()=>new Promise(resolve=>{finish=resolve;});await user.click(runA());await screen.findByRole('dialog');await user.click(screen.getByRole('button',{name:'Cancel',exact:true}));
  await act(async()=>finish(new Response(JSON.stringify({message:{content:JSON.stringify(reply)},done_reason:'stop'}))));assert.equal(working.beatTrials.length,2);
  let budgetCalls=0;await assert.rejects(suggestAiBeats({source:first,context:{characters:[],locations:[]},settings:{...settings,contextWindow:1024},singleRequest:true,narrativeContext:{synopsis:'x'.repeat(12000)},fetchImpl:async()=>{budgetCalls++;throw new Error('must not call');}}),/context budget/);assert.equal(budgetCalls,0);
  await user.click(screen.getByRole('button',{name:'Edit source for test'}));assert.equal(pilot.trialIsCurrent(working,working.beatTrials[0]),false);assert.ok(screen.getAllByRole('button',{name:'Add selected beats to album'}).every(b=>b.disabled));
  cleanup();
  // Attach expanded context to an existing album without changing authored assets.
  const oldProject={...project,adaptationContext:undefined};let attached=oldProject;
  function AttachHarness(){const [p,set]=React.useState(oldProject);attached=p;return React.createElement(ChapterBeatPilot,{project:p,chapterId,locale:'en',settings,onUpdate:change=>set(prev=>change(prev))});}
  render(React.createElement(AttachHarness));await user.click(screen.getByText('Chapter pilot – context and beat suggestions',{selector:'summary'}));
  fireEvent.change(screen.getByLabelText('Load pilot context'),{target:{files:[{text:async()=>rawSnapshot}]}});await screen.findByRole('button',{name:'Add context to album'});await user.click(screen.getByRole('button',{name:'Add context to album'}));assert.ok(attached.adaptationContext);assert.deepEqual(attached.adaptations,oldProject.adaptations);assert.deepEqual(attached.source,oldProject.source);
  cleanup();
  if(process.env.PILOT_EXPORT){
    const real=parseStoryBookExport(readFileSync(process.env.PILOT_EXPORT,'utf8')),chapters=importManuscriptChapters(real.chapters);
    const book={...createProject('Local export check','storybook'),source:{type:'storybook',storyBookId:real.sourceBookId,textSnapshot:chapters.text,chapters:chapters.chapters},characters:real.characters.map(c=>({...c,visualIdentity:''})),locations:real.locations.map(l=>({...l,visualIdentity:''})),adaptationContext:pilot.importedAdaptationContext(real)};
    const cid=chapters.chapters[0].id,context=book.adaptationContext,chapter=pilot.pilotChapter(book,cid),scene=chapter.scenes.find(s=>s.originalText.trim());
    context.synopsis.approved=true;chapter.brief.approved=true;scene.approved=true;scene.instructions.approved=true;
    const span=pilot.pilotSceneRange(book,cid,scene.id);assert.ok(span);let calls=0;
    await assert.rejects(suggestAiBeats({source:book.source.textSnapshot.slice(span.start,span.end),sourceOffset:span.start,context:{characters:book.characters.map(c=>({id:c.id,name:c.name})),locations:book.locations.map(l=>({id:l.id,name:l.name}))},settings,singleRequest:true,allowUnknownCharacters:true,narrativeContext:pilot.pilotNarrative(book,cid,scene.id),fetchImpl:async()=>{calls++;throw new Error('OFFLINE-PREFLIGHT');}}),/OFFLINE-PREFLIGHT/);
    assert.equal(calls,1);console.log('PASS: supplied export chapter 1 scene mapping and estimated 8192-token input budget, checked offline.');
  }
  console.log('PASS: v1/v2 context import, immutable originals, scene ranges/ambiguity, approvals, A/B request isolation, one request, unknown character warnings, exact sources, persistent trials/backup, explicit apply, cancellation/stale rejection, budget guard and attachment to existing albums.');
}finally{globalThis.fetch=nativeFetch;rmSync(temporary,{recursive:true,force:true});dom.window.close();}
