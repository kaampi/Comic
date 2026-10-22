import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".manuscript-scenes-test-"));
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
  const React=await import('react'),{render,screen,within,fireEvent,waitFor,cleanup}=await import('@testing-library/react'),{default:userEvent}=await import('@testing-library/user-event');
  const local=p=>import(pathToFileURL(join(temporary,p+'.mjs')));
  const {createProject}=await local('project'),{importManuscriptChapters}=await local('manuscriptChapters');
  const scenes=await local('manuscriptScenes'),model=await local('manuscriptModel');
  const {packAlbumBackup,parseAlbumBackup}=await local('albumBackup'),{defaultLocalAiSettings}=await local('localAi'),{ManuscriptWorkspace}=await local('ManuscriptWorkspace');
  const first='Rook left the empty room. A cup remained on the table.',second='Rook reached the bridge. Seren raised a hand.';
  const imported=importManuscriptChapters([{id:'chapter-source-1',title:'Departure',text:first+'\n\n'+second},{id:'chapter-source-2',title:'Later',text:second}]);
  const chapter=imported.chapters[0],chapter2=imported.chapters[1];
  let project=createProject('Scene fixture','storybook');project.source={type:'storybook',textSnapshot:imported.text,chapters:imported.chapters,storyBookId:'fixture'};
  project.adaptationContext={sourceBookId:'fixture',exportedAt:'fixture',synopsis:{original:'A tentative new beginning.',text:'A tentative new beginning.',approved:true},chapters:[{sourceId:'chapter-source-1',brief:{original:'Establish loss and reunion.',text:'Establish loss and reunion.',approved:true},approvedCharacters:[],approvedLocations:[],scenes:[{id:'source-scene-1',order:1,title:'Empty room',originalText:first,instructions:{original:'Establish absence.',text:'Establish absence.',approved:false},approved:false},{id:'source-scene-2',order:2,title:'The bridge',originalText:second,instructions:{original:'Establish a hesitant reunion.',text:'Establish a hesitant reunion.',approved:false},approved:false},{id:'empty',order:3,title:'Empty',originalText:'',instructions:{original:'',text:'',approved:false},approved:false}]}]};
  const original=JSON.stringify(project);
  project=scenes.prepareManuscriptScenes(project);
  assert.equal(project.manuscriptScenes.length,2);assert.equal(project.adaptations[0].beats.length,2);assert.equal(project.adaptations[0].panelPlans.length,0);assert.equal(project.panels.length,0);
  assert.equal(scenes.prepareManuscriptScenes(project),project,'repeat preparation is idempotent');
  assert.equal(project.manuscriptScenes[1].start,first.length+2);
  assert.equal(project.adaptations[0].beats[0].sourceSceneId,'source-scene-1');
  const copy=scenes.createManuscriptScene(project,{start:chapter2.start,end:chapter2.end},'A second meeting','Establish a change in trust.','Keep the raised hand.');
  assert.equal(copy.project.manuscriptScenes.length,3);assert.equal(copy.project.manuscriptScenes[2].chapterId,chapter2.id);assert.equal(copy.project.manuscriptScenes[2].start,chapter2.start,'repeated text uses selected offsets');
  assert.throws(()=>scenes.createManuscriptScene(project,{start:0,end:chapter2.end},'Bad','Crosses chapters'),/one chapter/);
  assert.throws(()=>scenes.createManuscriptScene(project,{start:0,end:5},'','Purpose'),/name/);
  let edited=model.editManuscriptChapter(copy.project,chapter.id,'Prefix. '+first+'\n\n'+second);
  assert.equal(edited.manuscriptScenes[2].start,chapter2.start+8);assert.equal(edited.manuscriptScenes[2].needsReview,undefined);
  edited=model.editManuscriptChapter(project,chapter.id,first.replace('cup','broken cup')+'\n\n'+second);
  assert.equal(edited.manuscriptScenes[0].needsReview,true);assert.equal(scenes.sceneRange(edited,edited.manuscriptScenes[0]),undefined);
  const legacy=model.addManualBeat(JSON.parse(original),{start:0,end:first.length}).project;
  const migrated=scenes.prepareManuscriptScenes(legacy);assert.equal(migrated.adaptations[0].beats.length,2);assert.equal(migrated.adaptations[0].panelPlans.length,1);assert.equal(migrated.adaptations[0].beats.find(b=>!b.scenePlaceholder).sourceSceneId,'source-scene-1');
  const beforeAssets=JSON.stringify(project.pages);
  const omitted=scenes.patchScene(project,'source-scene-1',{omitted:true});assert.equal(scenes.ensureSceneBeat(omitted,'source-scene-1'),omitted);assert.equal(JSON.stringify(omitted.pages),beforeAssets);
  const manual=model.addManualBeat(project,{start:first.length+2,end:chapter.end});assert.equal(manual.project.adaptations[0].beats.find(b=>b.id===manual.beatId).sourceSceneId,'source-scene-2');
  const baseline=project.adaptations[0].beats.find(b=>b.sourceSceneId==='source-scene-1');
  const proposal={...baseline,id:'ai-proposal',scenePlaceholder:undefined,title:'The empty room',summary:'A room left behind.',visualCandidates:[{id:'visual-proposal',description:'An empty room with a cup on its table.'}],origin:'ai-generated'};
  const applied=scenes.applySceneBeats(project,'source-scene-1',[proposal]);assert.equal(applied.adaptations[0].beats.some(b=>b.id===baseline.id),false);assert.equal(applied.adaptations[0].beats.some(b=>b.id===proposal.id),true);assert.equal(applied.adaptations[0].panelPlans.length,1);
  const authored=model.addBeatPanel(project,baseline.id);const kept=scenes.applySceneBeats(authored,'source-scene-1',[proposal]);assert.ok(kept.adaptations[0].beats.some(b=>b.id===baseline.id));assert.ok(kept.adaptations[0].panelPlans.some(p=>p.id===authored.adaptations[0].panelPlans[0].id));
  const authoredPanel=authored.adaptations[0].panelPlans[0];
  const withImage=model.patchBeatPanel(authored,authoredPanel.id,{image:{name:'kept.png',dataUrl:'data:image/png;base64,AA=='}});
  const withImageApplied=scenes.applySceneBeats(withImage,'source-scene-1',[proposal]);assert.equal(withImageApplied.adaptations[0].panelPlans.find(p=>p.id===authoredPanel.id).image.name,'kept.png');
  const overlap=scenes.createManuscriptScene(applied,{start:0,end:first.length},'Another reading','A different scene purpose.');
  const overlapApplied=scenes.applySceneBeats(overlap.project,overlap.sceneId,[{...proposal,id:'overlap-proposal'}]);assert.equal(scenes.sceneBeats(overlapApplied,overlap.sceneId).length,1,'identical proposals for different scenes retain separate scene ownership');
  assert.deepEqual(parseAlbumBackup(packAlbumBackup(copy.project)).manuscriptScenes,copy.project.manuscriptScenes);
  const corrupt=structuredClone(packAlbumBackup(copy.project));corrupt.project.manuscriptScenes[0].end=999999;assert.throws(()=>parseAlbumBackup(corrupt),/invalid-backup/);
  const initial=JSON.parse(original);assert.equal(initial.manuscriptScenes,undefined,'source object is not mutated');
  // The editor creates scenes from an actual DOM text selection, without AI.
  let working=createProject('Local scene fixture','text');working.source={type:'text',textSnapshot:second};
  const settings=defaultLocalAiSettings();settings.servers.ollama.model='fixture';settings.prompts={beats:'LONG_DISCOVERY_PROMPT '.repeat(1000)};
  working.adaptationContext={sourceBookId:'local',exportedAt:'fixture',synopsis:{original:'A story about trust. '.repeat(160),text:'A story about trust. '.repeat(160),approved:true},chapters:[]};
  function Harness(){const [p,set]=React.useState(working);working=p;return React.createElement(ManuscriptWorkspace,{project:p,locale:'en',settings,onSettings:()=>{},onUpdate:fn=>set(prev=>fn(prev))});}
  const user=userEvent.setup({document});render(React.createElement(Harness));
  const editor=screen.getByRole('textbox',{name:'Manus'}),walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT),node=walker.nextNode(),r=document.createRange();r.setStart(node,0);r.setEnd(node,node.textContent.length);window.getSelection().removeAllRanges();window.getSelection().addRange(r);
  fireEvent.mouseUp(editor);fireEvent.contextMenu(editor,{clientX:20,clientY:20});
  await user.click(screen.getByRole('menuitem',{name:'Create scene'}));
  const dialog=screen.getByRole('dialog',{name:'Create scene'});
  await user.type(within(dialog).getByRole('textbox',{name:'Scene name'}),'The reunion');
  await user.type(within(dialog).getByRole('textbox',{name:'What should the scene accomplish?'}),'Show hesitation and a possible reunion.');
  await user.type(within(dialog).getByRole('textbox',{name:'Important to preserve (optional)'}),'The raised hand.');
  await user.click(within(dialog).getByRole('button',{name:'Save scene'}));
  assert.equal(networkRequests,0);assert.equal(working.manuscriptScenes.length,1);assert.equal(working.adaptations[0].beats.length,1);assert.equal(working.adaptations[0].panelPlans.length,0);
  await user.click(within(screen.getByRole('navigation',{name:'Manuscript scenes'})).getByRole('button',{name:/1\. The reunion/}));
  let calls=0,body;
  globalThis.fetch=async(_url,init)=>{calls++;body=JSON.parse(init.body);return new Response(JSON.stringify({message:{content:JSON.stringify({beats:[{from:1,to:2,summary:'Seren greets Rook.',reason:'A hesitant reunion begins.'}]})},done_reason:'stop'}));};
  await user.click(screen.getByRole('button',{name:'Suggest comic beats for scene'}));
  await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Add selected beats'})));
  assert.ok(screen.getByText(/Review selection and source support first/));
  assert.ok(!body.messages[0].content.includes('LONG_DISCOVERY_PROMPT'));assert.ok(settings.prompts.beats.includes('LONG_DISCOVERY_PROMPT'),'saved general prompt is retained');
  assert.equal(body.options.num_ctx,8192);
  assert.equal(calls,1);const payload=JSON.parse(body.messages[1].content);assert.equal(payload.narrativeContext.synopsis,working.adaptationContext.synopsis.text);assert.equal(payload.narrativeContext.sceneInstructions,'Show hesitation and a possible reunion.');assert.equal(payload.narrativeContext.mustPreserve,'The raised hand.');assert.equal(payload.coverageRequirements,undefined);assert.equal(payload.knownCharacters,undefined);assert.equal(payload.knownLocations,undefined);assert.ok(body.messages[0].content.includes('Your ONLY task is selection'));assert.ok(payload.segments.every(s=>second.includes(s.text)));
  assert.equal(working.adaptations[0].beats.length,1,'proposals require explicit application');
  const diagnosticsSummary=screen.getByText(/Show AI diagnostics ·/,{selector:'summary'});
  assert.equal(diagnosticsSummary.parentElement.open,false);
  await user.click(diagnosticsSummary);
  assert.deepEqual(JSON.parse(screen.getByRole('textbox',{name:'Full request (including system instructions and numbered segments)'}).value),body);
  const rawReply=screen.getByRole('textbox',{name:'Raw model reply before processing'}).value;
  assert.equal(JSON.parse(rawReply).beats[0].summary,'Seren greets Rook.');
  assert.equal(calls,1,'opening diagnostics makes no additional request');

  const purposeInput=screen.getByRole('textbox',{name:'What should the scene accomplish?'});
  fireEvent.change(purposeInput,{target:{value:'A changed scene purpose.'}});assert.equal(screen.getByRole('button',{name:'Add selected beats'}).disabled,true);
  fireEvent.change(purposeInput,{target:{value:'Show hesitation and a possible reunion.'}});

  globalThis.fetch=async(_url,init)=>{calls++;body=JSON.parse(init.body);return new Response(JSON.stringify({message:{content:JSON.stringify({beats:[{from:1,to:2,summary:'Seren greets Rook.',reason:'A hesitant reunion begins.'}],coverage:{'1':{beatNumbers:[1],missing:''},'2':{beatNumbers:[1],missing:''}}})},done_reason:'stop'}));};
  await user.click(screen.getByRole('button',{name:'Suggest comic beats for scene'}));
  await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Add selected beats'})));
  assert.equal(calls,2,'each deliberate run makes exactly one request');
  const include=screen.getByRole('checkbox',{name:'Include'});
  await user.click(include);
  assert.ok(screen.getByText(/Review selection and source support first/));
  await user.click(include);
  await user.click(screen.getByRole('button',{name:'Add selected beats'}));
  assert.equal(working.adaptations[0].beats.length,1);assert.equal(working.adaptations[0].beats[0].scenePlaceholder,undefined);assert.equal(working.adaptations[0].panelPlans.length,1);

  assert.deepEqual(working.adaptations[0].beats[0].visualCandidates,[]);assert.deepEqual(working.adaptations[0].beats[0].characterIds,[]);assert.equal(working.adaptations[0].beats[0].locationId,undefined);
  const preserved=JSON.stringify(working.adaptations);
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({message:{content:'{"beats":['},done_reason:'length'}));};
  await user.click(screen.getByRole('button',{name:'Suggest comic beats for scene'}));
  await waitFor(()=>assert.ok(screen.getByText(/Analysis failed/)));
  assert.equal(screen.getByRole('textbox',{name:'Raw model reply before processing'}).value,'{"beats":[');
  assert.ok(screen.getByText(/Finish reason: length/));
  assert.equal(JSON.stringify(working.adaptations),preserved,'failed generation preserves existing work');
  assert.equal(calls,3,'failed generation has no automatic retry');
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({message:{content:JSON.stringify({beats:[{from:1,to:1,summary:'Rook reaches the bridge.',reason:'Arrival.'},{from:2,to:2,summary:'Seren raises a hand.',reason:'A greeting.'}]})},done_reason:'stop'}));};
  await user.click(screen.getByRole('button',{name:'Suggest comic beats for scene'}));
  await waitFor(()=>assert.equal(screen.getAllByRole('checkbox',{name:/Mark for merge:/}).length,2));
  const beforeMerge=JSON.stringify(working.adaptations);
  const marks=screen.getAllByRole('checkbox',{name:/Mark for merge:/});
  await user.click(marks[0]);await user.click(marks[1]);
  assert.ok(screen.getAllByRole('checkbox',{name:'Include'}).every(box=>box.checked),'merge marking is independent of Include');
  await user.click(screen.getByRole('button',{name:'Merge marked proposals'}));
  const preview=screen.getByRole('region',{name:'Review merge'});
  assert.ok(within(preview).getByText(second,{selector:'blockquote'}));
  const mergedSummary=within(preview).getByRole('textbox',{name:'Merged summary'});
  fireEvent.change(mergedSummary,{target:{value:'Rook arrives and Seren greets him.'}});
  fireEvent.change(purposeInput,{target:{value:'A different intention.'}});
  assert.equal(within(preview).getByRole('button',{name:'Save merge'}).disabled,true,'changed scene metadata blocks merge');
  fireEvent.change(purposeInput,{target:{value:'Show hesitation and a possible reunion.'}});

  await user.click(within(preview).getByRole('button',{name:'Cancel merge'}));
  assert.equal(screen.getAllByRole('checkbox',{name:'Include'}).length,2);assert.equal(JSON.stringify(working.adaptations),beforeMerge);
  await user.click(screen.getByRole('button',{name:'Merge marked proposals'}));
  fireEvent.change(screen.getByRole('textbox',{name:'Merged summary'}),{target:{value:'Rook arrives and Seren greets him.'}});
  await user.click(screen.getByRole('button',{name:'Save merge'}));
  assert.equal(screen.getAllByRole('checkbox',{name:'Include'}).length,1);
  await user.click(screen.getByRole('button',{name:'Undo merge'}));
  assert.equal(screen.getAllByRole('checkbox',{name:'Include'}).length,2);
  for(const checkbox of screen.getAllByRole('checkbox',{name:/Mark for merge:/}))await user.click(checkbox);
  await user.click(screen.getByRole('button',{name:'Merge marked proposals'}));
  fireEvent.change(screen.getByRole('textbox',{name:'Merged summary'}),{target:{value:'Rook arrives and Seren greets him.'}});
  await user.click(screen.getByRole('button',{name:'Save merge'}));
  assert.equal(JSON.stringify(working.adaptations),beforeMerge,'merging only edits the proposal draft');
  assert.equal(calls,4,'merge, cancel and undo do not call AI');
  await user.click(screen.getByRole('button',{name:'Add selected beats'}));
  const appliedMerge=working.adaptations[0].beats.find(b=>b.summary==='Rook arrives and Seren greets him.');
  assert.equal(appliedMerge.sourceTextExcerpt,second);assert.equal(appliedMerge.sourceStart,0);assert.equal(appliedMerge.sourceEnd,second.length);
  assert.equal(working.adaptations[0].beats.length,2,'earlier authored beat is preserved');
  const {readSceneCoverage,suggestAiBeats,parseAiBeats}=await import(pathToFileURL(join(temporary,'adaptation/aiBeats.mjs')));
  const source='A door opens. A hand rises.';
  const raw=[{from:2,to:2,title:'Hand'},{from:1,to:1,title:'Door'}];
  const mapped=[{id:'door',title:'Door',sourceStart:10,sourceEnd:23},{id:'hand',title:'Hand',sourceStart:24,sourceEnd:37}];
  const reply=JSON.stringify({beats:raw,coverage:{'1':{beatNumbers:[1],missing:''},'2':{beatNumbers:[],missing:'The loss is not conveyed.'}}});
  const coverage=readSceneCoverage(reply,['Greeting','Loss'],mapped,source,10);
  assert.deepEqual(coverage[0].beatIds,['hand'],'coverage references survive sorting and global offsets');
  assert.equal(coverage[0].verified,true);assert.equal(coverage[1].missing,'The loss is not conveyed.');
  assert.equal(readSceneCoverage(JSON.stringify({beats:raw,coverage:{'1':{beatNumbers:[99],missing:''}}}),['Greeting'],mapped,source,10)[0].verified,false);
  assert.equal(readSceneCoverage(JSON.stringify({beats:raw}),['Greeting'],mapped,source,10)[0].verified,false);
  const selected=parseAiBeats(JSON.stringify({beats:[{from:2,to:2,summary:'A hand rises.',reason:'A greeting.',characterIds:['invented'],locationId:'invented'}]}),source,{characters:[{id:'person',name:'hand'}],locations:[]},10,false,true,true);
  assert.equal(selected[0].sourceTextExcerpt,'A hand rises.');assert.equal(selected[0].sourceStart,24);
  assert.deepEqual(selected[0].visualCandidates,[]);assert.deepEqual(selected[0].characterIds,[]);assert.equal(selected[0].locationId,undefined);
  assert.throws(()=>parseAiBeats(JSON.stringify({beats:[{from:99,summary:'No source.'}]}),source,{characters:[],locations:[]},0,false,true,true),/unknown source segment/);
  assert.throws(()=>parseAiBeats(JSON.stringify({beats:[{from:1,summary:'Same.'},{from:2,summary:'Same.'}]}),source,{characters:[],locations:[]},0,false,true,true),/repeated a selected beat/);
  const {mergeBeatProposals}=await local('mergeBeatProposals');
  const mergeSource='One. Gap. Two. Tail.';
  const candidates=[{...selected[0],id:'one',summary:'One',sourceStart:0,sourceEnd:4,sourceTextExcerpt:'One.'},{...selected[0],id:'two',summary:'Two',sourceStart:10,sourceEnd:14,sourceTextExcerpt:'Two.'},{...selected[0],id:'tail',summary:'Tail',sourceStart:15,sourceEnd:20,sourceTextExcerpt:'Tail.'}];
  const combined=mergeBeatProposals(candidates,['one','two'],mergeSource);
  assert.equal(combined[0].targetPanelCount,1,'a merged beat does not multiply identical panel plans');
  const {panelize}=await local('adaptation/panelize');
  assert.equal(panelize(combined).filter(p=>p.sourceBeatIds.includes(combined[0].id)).length,1);
  assert.equal(combined[0].sourceTextExcerpt,'One. Gap. Two.');assert.equal(combined[0].id,'one');assert.equal(combined[1].id,'tail');assert.equal(candidates.length,3);
  assert.throws(()=>mergeBeatProposals(candidates,['one','tail'],mergeSource),/consecutive/);
  assert.throws(()=>mergeBeatProposals(candidates,['one','missing'],mergeSource),/consecutive/);
  assert.throws(()=>mergeBeatProposals(candidates,['one','two'],mergeSource.replace('One','New')),/current source/);
  assert.throws(()=>mergeBeatProposals(candidates.map(b=>b.id==='two'?{...b,sourceSceneId:'other'}:b),['one','two'],mergeSource),/same scene/);
  // A realistic full scene plus approved synopsis and entity IDs must fit 8192,
  // while genuinely oversized input must still fail before a network request.
  let realisticCalls=0,requestBody;
  const realisticSource=Array.from({length:46},(_,i)=>`Rook considers the quiet room and the familiar doorway while holding a worn canvas bag on evening ${i}.`).join(' ');
  const realisticOptions={source:realisticSource,context:{characters:Array.from({length:8},(_,i)=>({id:`character-00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,name:`Person ${i}`})),locations:Array.from({length:6},(_,i)=>({id:`location-00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,name:`Place ${i}`}))},settings,singleRequest:true,selectionOnly:true,allowUnknownCharacters:true,taskPrompt:scenes.SCENE_ADAPTATION_PROMPT,coverageRequirements:['Establish loss, familiarity and an uncertain return.'],narrativeContext:{synopsis:'A story about loss and trust. '.repeat(125),brief:'Show a hesitant return to a familiar place.',sceneInstructions:'Establish loss, familiarity and an uncertain return.',mustPreserve:''},fetchImpl:async(_url,init)=>{realisticCalls++;requestBody=JSON.parse(init.body);return new Response(JSON.stringify({message:{content:JSON.stringify({beats:[{from:1,to:1,title:'Return',summary:'Rook pauses.',visualDescription:'Rook stands at a doorway, bag hanging from one shoulder.',beatType:'reaction',characterIds:[],locationId:null}],coverage:{'1':{beatNumbers:[1],missing:'Loss remains unrepresented.'}}})},done_reason:'stop'}));}};
  await suggestAiBeats(realisticOptions);
  assert.equal(realisticCalls,1);assert.equal(requestBody.options.num_ctx,8192);assert.equal(requestBody.options.num_predict,2048);
  assert.equal(JSON.parse(requestBody.messages[1].content).narrativeContext.synopsis,realisticOptions.narrativeContext.synopsis);
  assert.ok(requestBody.messages[0].content.length<2600,'scene contract stays compact');
  await assert.rejects(()=>suggestAiBeats({...realisticOptions,source:realisticSource.repeat(10)}),/context budget/);
  assert.equal(realisticCalls,1,'oversized input is rejected before transport');
  const contextCalls=calls,sourceBeforeContext=working.source.textSnapshot;
  await user.click(screen.getByRole('button',{name:'Story context',exact:true}));
  fireEvent.change(screen.getByRole('textbox',{name:'Synopsis'}),{target:{value:'A revised synopsis for review.'}});
  assert.equal(working.adaptationContext.synopsis.approved,false,'editing story context revokes AI approval');
  assert.equal(working.source.textSnapshot,sourceBeforeContext);
  await user.click(screen.getByRole('button',{name:'Source text',exact:true}));
  assert.ok(screen.getByRole('textbox',{name:'Manus'}));assert.equal(calls,contextCalls,'view navigation never calls AI');
  console.log('PASS: scene import and local creation, stable source offsets, explicit omission, starter coverage, one scene request with intent, reviewed application, authored asset preservation and backup validation.');
} finally {globalThis.fetch=nativeFetch;rmSync(temporary,{recursive:true,force:true});dom.window.close();}
