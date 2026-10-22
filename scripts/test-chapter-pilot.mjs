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
  const oldParsed={...raw,chapters:raw.chapters.map(({scenes,...chapter})=>chapter)};
  const oldParserModule=readFileSync(join(temporary,'storybookImport.mjs'),'utf8').replace(/import \{[^;]+from "@ocedo-apps\/storycore";/,`class ManuscriptExportError extends Error {}\nconst parseManuscriptExport = () => (${JSON.stringify(oldParsed)});`);
  writeFileSync(join(temporary,'storybookImport-old.mjs'),oldParserModule);
  const oldImporter=await local('storybookImport-old');
  assert.throws(()=>oldImporter.parseStoryBookExport(rawSnapshot),/npm install/,'stale StoryCore installations get actionable instructions instead of a map crash');
  assert.throws(()=>parseStoryBookExport(JSON.stringify({...raw,chapters:[{...raw.chapters[0],scenes:[raw.chapters[0].scenes[0],raw.chapters[0].scenes[0]]}]})),/Duplicate/);
  let project=createProject('Pilot fixture','storybook');project.source={type:'storybook',storyBookId:raw.sourceBookId,textSnapshot:source.text,chapters:source.chapters};project.characters=[{id:'rook',sourceId:'source-rook',name:'Rook',description:'A cautious captain.',visualIdentity:''}];
  project.adaptationContext=pilot.importedAdaptationContext(data);
  const legacyProject={...project,source:{...project.source,chapters:source.chapters.map(({sourceId,...c})=>c)}};
  const beforeLegacy=JSON.stringify(legacyProject);
  const matched=pilot.matchPilotChapters(legacyProject,data);
  assert.equal(matched[0].sourceId,data.chapters[0].id);
  assert.equal(matched[0].id,source.chapters[0].id);
  assert.equal(JSON.stringify(legacyProject),beforeLegacy,'matching does not mutate album');
  assert.throws(()=>pilot.matchPilotChapters(legacyProject,{...data,chapters:[...data.chapters,...data.chapters]}),/Cannot match/);
  assert.throws(()=>pilot.matchPilotChapters(project,{...data,chapters:data.chapters.map(c=>({...c,text:c.text+'changed'}))}),/Cannot match/);
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
  const reply={beats:[{from:1,to:2,title:'The hesitant greeting',summary:'Rook meets Seren on the bridge.',visualDescription:'At the doorway, Rook pauses opposite Seren, whose palm is raised.',reason:'Their hesitant greeting establishes fragile trust.',characterIds:['rook','unknown-seren'],unresolvedCharacters:['Seren'],locationId:null}]};
  assert.throws(()=>parseAiBeats(JSON.stringify(reply),first,{characters:[{id:'rook',name:'Rook'}],locations:[]},0,true),/unknown character/,'existing strict callers remain strict');
  const typeFixture={...reply,beats:reply.beats.map(b=>({...b,characterIds:[],unresolvedCharacters:undefined}))};
  for(const [label,expected] of [[' Reaction ','reaction'],['Establishing Shot','establishing'],['introspection','reaction'],['dialogue','dialogue']]) {
    const candidate={beats:typeFixture.beats.map(b=>({...b,beatType:label}))};
    assert.equal(parseAiBeats(JSON.stringify(candidate),first,{characters:[],locations:[]},0,true)[0].beatType,expected);
  }
  for(const value of ['unrecognized-category',12]) {
    assert.throws(()=>parseAiBeats(JSON.stringify({beats:typeFixture.beats.map(b=>({...b,beatType:value}))}),first,{characters:[],locations:[]},0,true),/Invalid AI beat type in beat 1.*Allowed types/);
  }
  for(const value of [undefined,null,'']) {
    const candidate={beats:typeFixture.beats.map(b=>({...b,beatType:value}))};
    const recovered=parseAiBeats(JSON.stringify(candidate),first,{characters:[],locations:[]},0,true,true)[0];
    assert.equal(recovered.beatType,'action');
    assert.match(recovered.adaptationReason,/placeholder/);
    assert.equal(recovered.sourceTextExcerpt,first.slice(recovered.sourceStart,recovered.sourceEnd));
    assert.throws(()=>parseAiBeats(JSON.stringify(candidate),first,{characters:[],locations:[]},0,true),/Invalid AI beat type/,'ordinary strict parsing remains strict');
  }
  const sourceOrderFixture={beats:[
    {...typeFixture.beats[0],from:'2',to:'2',title:'Later',beatType:'action'},
    {...typeFixture.beats[0],from:1,to:2,title:'Wide',beatType:'action'},
    {...typeFixture.beats[0],from:1,to:1,title:'Earlier',beatType:'action'},
    {...typeFixture.beats[0],from:1,to:1,title:'Same passage',beatType:'action'}
  ]};
  const sorted=parseAiBeats(JSON.stringify(sourceOrderFixture),first,{characters:[],locations:[]},20,true,true);
  assert.deepEqual(sorted.map(b=>b.title),['Earlier','Same passage','Wide','Later']);
  assert.deepEqual(sorted.map(b=>b.order),[1,2,3,4]);
  for(const b of sorted)assert.equal(b.sourceTextExcerpt,first.slice(b.sourceStart-20,b.sourceEnd-20));
  assert.throws(()=>parseAiBeats(JSON.stringify(sourceOrderFixture),first,{characters:[],locations:[]},0,true),/out of order/);
  for(const [from,to] of [[2,1],[0,1],[1,999],['bad',2]]) {
    assert.throws(()=>parseAiBeats(JSON.stringify({beats:[{...typeFixture.beats[0],from,to}]}),first,{characters:[],locations:[]},0,true,true),/source range|unknown source segment/);
  }
  const bodies=[];globalThis.fetch=async(_url,init)=>{networkRequests++;bodies.push(JSON.parse(init.body));return new Response(JSON.stringify({message:{content:JSON.stringify(reply)},done_reason:'stop'}));};
  await user.click(runA());await waitFor(()=>assert.equal(working.beatTrials?.length,1));
  assert.deepEqual(JSON.parse(working.beatTrials[0].diagnostics.requestBody),bodies[0]);
  assert.equal(working.beatTrials[0].diagnostics.rawReply,JSON.stringify(reply));
  assert.equal(working.beatTrials[0].diagnostics.finishReason,'stop');
  assert.equal(working.beatTrials[0].diagnostics.maxOutputTokens,2048);
  assert.equal(bodies.length,1,'one scene trial makes one request');assert.equal(JSON.parse(bodies[0].messages[1].content).narrativeContext,undefined);
  assert.deepEqual(working.adaptations[0].beats,originalBeats);assert.deepEqual(working.pages,originalPages);
  await user.click(runB());await waitFor(()=>assert.equal(working.beatTrials.length,2));
  const olderCard=screen.getByText(/A · pilot-test/).closest('.pilot-trial');
  const newestCard=screen.getByText(/B · pilot-test/).closest('.pilot-trial');
  assert.equal(olderCard.open,false);assert.equal(newestCard.open,true);
  await user.click(olderCard.querySelector('summary'));assert.equal(olderCard.open,true);
  await user.click(olderCard.querySelector('summary'));assert.equal(olderCard.open,false);
  const payload=JSON.parse(bodies[1].messages[1].content);assert.equal(payload.narrativeContext.synopsis,raw.synopsis);assert.equal(payload.narrativeContext.brief,raw.chapters[0].brief);assert.equal(payload.narrativeContext.sceneInstructions,raw.chapters[0].scenes[0].instructions);assert.deepEqual(payload.narrativeContext.characterFacts,[],'unapproved facts are not sent');
  assert.equal(bodies[0].model,bodies[1].model);assert.equal(bodies[0].options.num_ctx,bodies[1].options.num_ctx);
  assert.ok(pilot.sameTrialSetup(working.beatTrials[0],working.beatTrials[1]));assert.ok(screen.getByText('Latest A and B use the same test setup.'));
  assert.ok(working.beatTrials[1].beats[0].unresolvedCharacters.includes('Seren'));assert.equal(working.beatTrials[1].beats[0].sourceSceneId,'scene-1');
  const backup=parseAlbumBackup(packAlbumBackup(working));assert.deepEqual(backup.beatTrials,working.beatTrials);assert.deepEqual(backup.adaptationContext,working.adaptationContext);assert.deepEqual(normalizeStoredProjects([JSON.parse(JSON.stringify(working))])[0].beatTrials,JSON.parse(JSON.stringify(working.beatTrials)));
  const broken=structuredClone(packAlbumBackup(working));broken.project.adaptationContext.synopsis.approved='yes';assert.throws(()=>parseAlbumBackup(broken),/invalid-backup/);
  const corrupt=structuredClone(packAlbumBackup(working));corrupt.project.beatTrials[0].beats[0].sourceEnd=99999;assert.throws(()=>parseAlbumBackup(corrupt),/invalid-backup/);
  await user.click(within(newestCard).getByRole('button',{name:'Add selected beats to album'}));assert.equal(working.adaptations[0].beats.length,originalBeats.length+1);assert.deepEqual(working.pages,originalPages);assert.equal(working.beatTrials[1].applied.length,1);
  // A late result after cancellation cannot replace or append earlier trials.
  let finish;globalThis.fetch=()=>new Promise(resolve=>{finish=resolve;});await user.click(runA());await screen.findByRole('dialog');await user.click(screen.getByRole('button',{name:'Cancel',exact:true}));
  await act(async()=>finish(new Response(JSON.stringify({message:{content:JSON.stringify(reply)},done_reason:'stop'}))));assert.equal(working.beatTrials.length,2);
  // Failed replies retain the exact request and unprocessed reply without adding beats.
  for(const [content,reason] of [['{"beats":[','length'],['not JSON','stop']]) {
    let count=0;globalThis.fetch=async()=>{count++;return new Response(JSON.stringify({message:{content},done_reason:reason,eval_count:17}));};
    const before=working.beatTrials.length,album=JSON.stringify(working.adaptations);
    await user.click(runB());await waitFor(()=>assert.equal(working.beatTrials.length,before+1));
    const failed=working.beatTrials.at(-1);assert.ok(failed.error);assert.equal(failed.beats.length,0);
    assert.equal(failed.diagnostics.rawReply,content);assert.equal(failed.diagnostics.finishReason,reason);
    assert.equal(count,1);assert.equal(JSON.stringify(working.adaptations),album);
    assert.deepEqual(parseAlbumBackup(packAlbumBackup(working)).beatTrials,working.beatTrials);
  }
  const badDiagnostic=structuredClone(packAlbumBackup(working));badDiagnostic.project.beatTrials[0].diagnostics.requestBody='broken';
  assert.throws(()=>parseAlbumBackup(badDiagnostic),/invalid-backup/);
  const {completeLocalChat}=await local('localAi');let openTrace;
  const openSettings={...settings,engine:'openai-compatible',servers:{...settings.servers,'openai-compatible':{model:'fixture',baseUrl:'http://localhost:1234'}}};
  await assert.rejects(completeLocalChat(openSettings,[{role:'user',content:'fixture'}],undefined,async()=>new Response(JSON.stringify({choices:[{message:{content:'partial'},finish_reason:'length'}],usage:{completion_tokens:2048}})),d=>{openTrace=d;}),/truncated/);
  assert.equal(openTrace.rawReply,'partial');assert.equal(openTrace.finishReason,'length');
  assert.equal(JSON.parse(openTrace.requestBody).max_tokens,2048);
  assert.equal(JSON.parse(openTrace.responseBody).usage.completion_tokens,2048);
  assert.ok(screen.getAllByText('Show AI diagnostics',{selector:'summary'}).length>=4);
  const {parseBeatSelection}=await local('adaptation/beatSelection');
  const selectionReply={beats:[{from:2,to:2,summary:'Seren greets Rook.',reason:'Their meeting establishes a relationship.'},{from:1,to:1,summary:'Rook arrives.',reason:'Establish the scene.'}]};
  const inventoryReply={passages:selectionReply.beats};
  const purposeReply={purposes:[{purpose:'Establish a hesitant greeting',passages:selectionReply.beats,missing:null},{purpose:'An unresolved promise',passages:[],missing:'No explicit promise occurs in the source.'}]};
  const chosen=parseBeatSelection(JSON.stringify(selectionReply),first,37);
  assert.deepEqual(chosen.map(b=>b.summary),['Rook arrives.','Seren greets Rook.']);
  for(const b of chosen){assert.equal(b.sourceTextExcerpt,first.slice(b.sourceStart-37,b.sourceEnd-37));assert.deepEqual(b.visualCandidates,[]);assert.deepEqual(b.characterIds,[]);}
  for(const beats of [[],[{from:0,to:1,summary:'X',reason:'Y'}],[{from:2,to:1,summary:'X',reason:'Y'}],[{from:1,to:1,summary:'X'}]])assert.throws(()=>parseBeatSelection(JSON.stringify({beats}),first));
  let selectionCalls=0,selectionBody;
  globalThis.fetch=async(_url,init)=>{selectionCalls++;selectionBody=JSON.parse(init.body);return new Response(JSON.stringify({message:{content:JSON.stringify(purposeReply)},done_reason:'stop'}));};
  const beforeSelection=working.beatTrials.length,albumBeforeSelection=JSON.stringify(working.adaptations);
  await user.click(screen.getByRole('button',{name:'Run C – find evidence for scene purposes'}));
  await waitFor(()=>assert.equal(working.beatTrials.length,beforeSelection+1));
  const selectionTrial=working.beatTrials.at(-1);assert.equal(selectionTrial.variant,'C');assert.equal(selectionCalls,1);
  const selectionUser=JSON.parse(selectionBody.messages[1].content);
  assert.equal(selectionUser.knownCharacters,undefined);assert.equal(selectionUser.knownLocations,undefined);
  assert.equal(selectionUser.narrativeContext.brief,raw.chapters[0].brief);assert.equal(selectionUser.narrativeContext.synopsis,raw.synopsis);assert.ok(screen.getByText('Synopsis is included in the inventory.'));
  assert.ok(selectionUser.segments.length>0);assert.equal(selectionBody.options.num_ctx,settings.contextWindow);
  assert.ok(!selectionBody.messages[0].content.includes('"visualDescription"'));
  assert.equal(JSON.stringify(working.adaptations),albumBeforeSelection);
  assert.deepEqual(parseAlbumBackup(packAlbumBackup(working)).beatTrials,working.beatTrials);
  const selectionCard=screen.getByText(/C · pilot-test/).closest('.pilot-trial');
  assert.equal(within(selectionCard).queryByRole('button',{name:'Add selected beats to album'}),null);
  assert.ok(within(selectionCard).getByText('Inventory before beat selection – no visual proposals or panels are created.'));
  const {parsePassageInventory}=await local('adaptation/beatSelection');
  assert.equal(selectionTrial.inputs.selectionTask,'scene-purpose');
  assert.deepEqual(selectionTrial.purposeResults,purposeReply.purposes);
  assert.ok(within(selectionCard).getByText('Establish a hesitant greeting'));
  assert.ok(within(selectionCard).getByText(/Missing or incomplete source support/));
  assert.ok(selectionBody.messages[0].content.includes('chapter brief describes a broader chapter'));
  assert.equal(selectionBody.format.properties.purposes.maxItems,4);
  assert.deepEqual(selectionBody.format.properties.purposes.items.properties.passages.items.properties.from.enum,[1,2,3]);
  assert.ok(selectionBody.messages[0].content.includes('"purposes"'));
  assert.ok(!selectionBody.messages[0].content.includes('"beats"'));
  const many=Array.from({length:10},(_,i)=>({from:1,to:1,summary:'Distinct source observation '+i,reason:'A source-supported contribution.'}));
  assert.equal(parsePassageInventory(JSON.stringify({passages:many}),first).length,10,'inventory is not restricted to the old eight-beat cap');
  for(const value of [{beats:many},{passages:[]},{passages:Array(13).fill(many[0])},{passages:[{...many[0],from:999}]}])assert.throws(()=>parsePassageInventory(JSON.stringify(value),first));
  const oldTrialBackup=structuredClone(packAlbumBackup(working));delete oldTrialBackup.project.beatTrials.at(-1).inputs.selectionTask;delete oldTrialBackup.project.beatTrials.at(-1).purposeResults;
  assert.equal(parseAlbumBackup(oldTrialBackup).beatTrials.at(-1).variant,'C','historical C trials remain valid without inventory marker');
  const {parsePurposeResults,findScenePurposeEvidence,scenePurposeSchema}=await local('adaptation/scenePurpose');
  const gapOnly={purposes:[{purpose:'A future plan',passages:[],missing:'There is no source evidence for this plan.'}]};
  assert.deepEqual(parsePurposeResults(JSON.stringify(gapOnly),first).beats,[]);
  for(const bad of [
    {purposes:Array(5).fill(purposeReply.purposes[0])},
    {purposes:[{...purposeReply.purposes[0],passages:Array(4).fill(selectionReply.beats[0])}]},
    {purposes:[{...purposeReply.purposes[0],passages:[{...selectionReply.beats[0],to:999}]}]},
    {purposes:[{purpose:'X',passages:[],missing:null}]}])assert.throws(()=>parsePurposeResults(JSON.stringify(bad),first));
  const supported=parsePurposeResults(JSON.stringify(purposeReply),first,91);for(const b of supported.beats)assert.equal(b.sourceTextExcerpt,first.slice(b.sourceStart-91,b.sourceEnd-91));
  await assert.rejects(findScenePurposeEvidence({source:first,sourceOffset:0,narrativeContext:{sceneInstructions:''},settings}),/approve the scene instructions/);
  assert.equal(selectionCalls,1,'missing scene instructions make no extra request');
  let schemaBody;
  await completeLocalChat(openSettings,[{role:'user',content:'fixture'}],undefined,async(_url,init)=>{schemaBody=JSON.parse(init.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(purposeReply)},finish_reason:'stop'}]}));},undefined,scenePurposeSchema(first));
  assert.equal(schemaBody.response_format.type,'json_schema');assert.equal(schemaBody.response_format.json_schema.strict,true);
  assert.deepEqual(schemaBody.response_format.json_schema.schema,selectionBody.format);
  let refusedSchemaCalls=0;
  globalThis.fetch=async()=>{refusedSchemaCalls++;return new Response('{}',{status:400,statusText:'Unsupported schema'});};
  await assert.rejects(findScenePurposeEvidence({source:first,sourceOffset:0,narrativeContext:{sceneInstructions:'Establish a hesitant greeting.'},settings}),/HTTP 400/);
  assert.equal(refusedSchemaCalls,1,'unsupported schema is not retried with a weaker contract');
  const badPurposeBackup=structuredClone(packAlbumBackup(working));badPurposeBackup.project.beatTrials.at(-1).purposeResults[0].passages[0].to=999;assert.throws(()=>parseAlbumBackup(badPurposeBackup),/invalid-backup/);
  const {parseReadingCheck,runReadingCheck}=await local('adaptation/readingCheck');
  const readingReply={currentSituation:{answer:'Rook is on the bridge.',evidence:[1,2]},pastEvents:{answer:'No earlier events are stated.',evidence:[]},change:{answer:'Seren signals for Rook to wait.',evidence:[2]}};
  assert.deepEqual(parseReadingCheck(JSON.stringify(readingReply),first),readingReply);
  for(const broken of [{...readingReply,currentSituation:{answer:'X',evidence:[999]}},{...readingReply,change:undefined},{...readingReply,pastEvents:{answer:'',evidence:[]}}])assert.throws(()=>parseReadingCheck(JSON.stringify(broken),first));
  let readingCalls=0,readingBody;
  globalThis.fetch=async(_url,init)=>{readingCalls++;readingBody=JSON.parse(init.body);return new Response(JSON.stringify({message:{content:JSON.stringify(readingReply)},done_reason:'stop'}));};
  const beforeReading=working.beatTrials.length;
  await user.click(screen.getByRole('button',{name:'Run D – reading comprehension'}));
  await waitFor(()=>assert.equal(working.beatTrials.length,beforeReading+1));
  const readingTrial=working.beatTrials.at(-1);assert.equal(readingTrial.variant,'D');assert.deepEqual(readingTrial.readingCheck,readingReply);assert.deepEqual(readingTrial.beats,[]);
  assert.equal(readingCalls,1);assert.deepEqual(Object.keys(JSON.parse(readingBody.messages[1].content)),['segments']);
  assert.equal(readingBody.options.num_ctx,settings.contextWindow);assert.equal(readingTrial.diagnostics.rawReply,JSON.stringify(readingReply));
  assert.equal(JSON.stringify(working.adaptations),albumBeforeSelection);
  const readingCard=screen.getByText(/D · pilot-test/).closest('.pilot-trial');
  assert.ok(within(readingCard).getByText('Where is the character during the present action?'));
  assert.ok(within(readingCard).getByText('Rook is on the bridge.',{selector:'p'}));
  assert.equal(within(readingCard).queryByRole('button',{name:'Add selected beats to album'}),null);
  assert.deepEqual(parseAlbumBackup(packAlbumBackup(working)).beatTrials,working.beatTrials);
  const brokenReading=structuredClone(packAlbumBackup(working));brokenReading.project.beatTrials.at(-1).readingCheck.change.evidence=[999];assert.throws(()=>parseAlbumBackup(brokenReading),/invalid-backup/);
  await assert.rejects(runReadingCheck({source:'Long source. '.repeat(2000),settings:{...settings,contextWindow:1024}}),/context budget/);assert.equal(readingCalls,1);
  let completeReading;globalThis.fetch=()=>new Promise(resolve=>{completeReading=resolve;});
  await user.click(screen.getByRole('button',{name:'Run D – reading comprehension'}));await screen.findByRole('dialog');await user.click(screen.getByRole('button',{name:'Cancel',exact:true}));
  await act(async()=>completeReading(new Response(JSON.stringify({message:{content:JSON.stringify(readingReply)},done_reason:'stop'}))));assert.equal(working.beatTrials.length,beforeReading+1);
  // A reviewed D snapshot guides a separate C request; editing invalidates approval.
  const reviewedButton=within(readingCard).getByRole('button',{name:'Find scene evidence with this review'});
  assert.equal(reviewedButton.disabled,true);
  await user.click(within(readingCard).getByText('Review and correct understanding',{selector:'summary'}));
  const presentEditor=within(readingCard).getByRole('textbox',{name:'Present location and movement',exact:true});
  fireEvent.change(presentEditor,{target:{value:'Rook reaches the bridge and meets Seren.'}});
  await user.click(within(readingCard).getByRole('button',{name:'Save and approve review'}));
  assert.equal(reviewedButton.disabled,false);
  assert.equal(working.beatTrials.find(t=>t.id===readingTrial.id).readingCheck.currentSituation.answer,readingReply.currentSituation.answer,'original D answer retained');
  assert.equal(working.beatTrials.find(t=>t.id===readingTrial.id).diagnostics.rawReply,JSON.stringify(readingReply));
  let guidedCalls=0,guidedBody;
  globalThis.fetch=async(_url,init)=>{guidedCalls++;guidedBody=JSON.parse(init.body);return new Response(JSON.stringify({message:{content:JSON.stringify(purposeReply)},done_reason:'stop'}));};
  const beforeGuided=working.beatTrials.length;
  await user.click(reviewedButton);await waitFor(()=>assert.equal(working.beatTrials.length,beforeGuided+1));
  const guided=working.beatTrials.at(-1),guidedPayload=JSON.parse(guidedBody.messages[1].content);
  assert.equal(guidedCalls,1);assert.equal(guided.variant,'C');
  assert.equal(guidedPayload.reviewedUnderstanding.currentSituation.answer,'Rook reaches the bridge and meets Seren.');
  assert.equal(guided.inputs.context.readingTrialId,readingTrial.id);
  assert.deepEqual(guidedPayload.reviewedUnderstanding,guided.inputs.context.reviewedUnderstanding);
  assert.equal(JSON.stringify(working.adaptations),albumBeforeSelection);
  assert.deepEqual(parseAlbumBackup(packAlbumBackup(working)).beatTrials,working.beatTrials);
  const snapshot=JSON.stringify(guided.inputs.context.reviewedUnderstanding);
  await user.click(readingCard.querySelector('summary'));
  fireEvent.change(presentEditor,{target:{value:'An edited interpretation.'}});assert.equal(reviewedButton.disabled,true);
  assert.throws(()=>pilot.reviewedReading(working,chapterId,'scene-1',readingTrial.id),/approve/);
  await user.click(within(readingCard).getByRole('button',{name:'Save and approve review'}));
  assert.throws(()=>pilot.reviewedReading(working,chapterId,'scene-2',readingTrial.id),/approve/);
  assert.equal(JSON.stringify(guided.inputs.context.reviewedUnderstanding),snapshot);
  const badReview=structuredClone(packAlbumBackup(working));badReview.project.beatTrials.find(t=>t.id===readingTrial.id).readingReview.answers.change.evidence=[999];assert.throws(()=>parseAlbumBackup(badReview),/invalid-backup/);
  let budgetCalls=0;await assert.rejects(suggestAiBeats({source:first,context:{characters:[],locations:[]},settings:{...settings,contextWindow:1024},singleRequest:true,narrativeContext:{synopsis:'x'.repeat(12000)},fetchImpl:async()=>{budgetCalls++;throw new Error('must not call');}}),/context budget/);assert.equal(budgetCalls,0);
  await user.click(screen.getByRole('button',{name:'Edit source for test'}));assert.equal(pilot.trialIsCurrent(working,working.beatTrials[0]),false);await user.click(olderCard.querySelector('summary'));assert.ok(screen.getAllByRole('button',{name:'Add selected beats to album'}).every(b=>b.disabled));
  assert.throws(()=>pilot.reviewedReading(working,chapterId,'scene-1',readingTrial.id),/approve/);
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
