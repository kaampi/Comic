export type StoryBookImport = {
  kind: "storybook-ai.manuscript";
  format: 1;
  sourceBookId: string;
  title: string;
  text: string;
  illustrationStyle: string;
  chapters: Array<{ id: string; title: string; text: string }>;
  characters: Array<{ id: string; name: string; description: string; pronoun?: string; approximateAge?: number }>;
  locations: Array<{ id: string; name: string; description: string }>;
};

export type StoryBookCard = {
  id: string; name: string; personality: string; appearance: string; pronoun?: string;
  approximateAge?: number; portraitDataUrl?: string;
};
export type StoryBookCardsImport = { kind: "ai-sandbox-library"; format: 1; characters: StoryBookCard[] };

const array=(value:unknown):any[]=>Array.isArray(value)?value:[];
const str=(value:unknown):string=>typeof value==="string"?value:"";
const num=(value:unknown):number|undefined=>typeof value==="number"&&Number.isFinite(value)?value:undefined;

function entityName(item:any):string { return str(item?.name ?? item?.title ?? item?.label); }
function entityDescription(item:any):string {
  return str(item?.description ?? item?.summary ?? item?.profile ?? item?.notes ?? item?.personality ?? item?.looks);
}

export function parseStoryBookExport(raw:string):StoryBookImport {
  let data:any; try{data=JSON.parse(raw)}catch{throw new Error("Filen är inte giltig JSON.")}
  if(data?.kind!=="storybook-ai.manuscript"||data?.format!==1) throw new Error("Filen är inte en StoryBook AI-backup i format 1.");
  const book=data.book ?? data.manuscript ?? data;
  const chapters=array(data.chapters ?? book.chapters).map((item)=>({
    id:str(item?.id), title:str(item?.title ?? item?.name)||"Kapitel",
    text:str(item?.prose ?? item?.text ?? item?.content ?? item?.body)
  })).filter((item)=>item.text||item.title);

  const rawEntities=array(data.entities ?? book.entities);
  const facts=array(data.facts ?? book.facts);
  const profiles=array(data.profiles ?? book.profiles);
  const kinds=new Map(array(data.entity_kinds ?? book.entity_kinds).map((x)=>[str(x?.entity_ref),str(x?.kind)]));
  const profileByRef=new Map(profiles.map((x)=>[str(x?.entity_ref),x]));
  const charsSource=array(data.characters ?? book.characters);
  const locSource=array(data.locations ?? data.places ?? book.locations ?? book.places);
  const factRefs=new Map<string,{id:string;name:string;description:string}>();
  for(const fact of facts){
    const ref=str(fact?.entity_ref); if(!ref) continue;
    const current=factRefs.get(ref)??{id:ref,name:str(fact?.entity_label)||ref,description:""};
    if(!fact?.superseded_by && str(fact?.value)) current.description=[current.description,str(fact.value)].filter(Boolean).join("\n");
    factRefs.set(ref,current);
  }
  const inferredChars=rawEntities.filter((x)=>["characters","character","people","person"].includes(kinds.get(str(x?.id ?? x?.ref ?? x?.entity_ref))??str(x?.kind)));
  const inferredLocs=rawEntities.filter((x)=>["locations","location","places","place"].includes(kinds.get(str(x?.id ?? x?.ref ?? x?.entity_ref))??str(x?.kind)));
  const locationRefs=new Set(inferredLocs.map((x)=>str(x?.id ?? x?.ref ?? x?.entity_ref)));
  for(const [ref,kind] of kinds) if(["locations","location","places","place"].includes(kind)) locationRefs.add(ref);
  const profileRefs=new Set(profiles.map((x)=>str(x?.entity_ref)).filter(Boolean));
  const factCharacters=[...factRefs.values()].filter((x)=>profileRefs.has(x.id)&&!locationRefs.has(x.id));
  const factLocations=[...factRefs.values()].filter((x)=>locationRefs.has(x.id));

  const characterSource=charsSource.length?charsSource:(inferredChars.length?inferredChars:factCharacters);
  const characters=characterSource.map((item)=>{
    const ref=str(item?.entity_ref ?? item?.ref ?? item?.id); const p=profileByRef.get(ref) as any;
    return {id:ref,name:entityName(item)||str(p?.name)||ref,description:entityDescription(item)||str((item as any)?.description)||str(p?.personality ?? p?.looks),pronoun:str(item?.pronoun ?? p?.pronoun)||undefined,approximateAge:num(item?.approximateAge ?? p?.approximateAge)};
  }).filter((x)=>x.name);
  const locationSource=locSource.length?locSource:(inferredLocs.length?inferredLocs:factLocations);
  const locations=locationSource.map((item)=>({id:str(item?.entity_ref ?? item?.ref ?? item?.id),name:entityName(item)||str((item as any)?.name),description:entityDescription(item)||str((item as any)?.description)})).filter((x)=>x.name);
  const text=str(book.text ?? book.content ?? data.text ?? data.manuscript?.text) || chapters.map((x)=>x.text).join("\n\n");
  return {kind:data.kind,format:1,sourceBookId:str(book.id),title:str(book.title)||"Importerat StoryBook-manus",text,illustrationStyle:str(book.illustration_style),chapters,characters,locations};
}

export function parseStoryBookCards(raw:string):StoryBookCardsImport {
  let data:any; try{data=JSON.parse(raw)}catch{throw new Error("Cards-filen är inte giltig JSON.")}
  if(data?.kind!=="ai-sandbox-library"||data?.format!==1) throw new Error("Filen är inte en StoryBook Cards-export i format 1.");
  const characters=array(data.characters).map((item)=>({
    id:str(item?.id),name:str(item?.name),personality:str(item?.personality),appearance:str(item?.appearance),
    pronoun:str(item?.pronoun)||undefined,approximateAge:num(item?.approximateAge),
    portraitDataUrl:str(item?.portraitDataUrl)||undefined
  })).filter((x)=>x.name);
  return {kind:data.kind,format:1,characters};
}

export function cardMatchesBook(card:StoryBookCard,bookId:string):boolean {
  return Boolean(bookId)&&card.id.startsWith(`sb-${bookId}-`);
}