import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import type { ReviewedText } from "./chapterPilot";
export function ManuscriptContext({project,chapterSourceId,locale,onUpdate}:{project:ComicProject;chapterSourceId?:string;locale:Locale;onUpdate:(fn:(p:ComicProject)=>ComicProject)=>void}){
  const sv=locale==='sv',chapter=project.adaptationContext?.chapters.find(c=>c.sourceId===chapterSourceId);
  const change=(kind:'synopsis'|'brief',text:ReviewedText)=>onUpdate(p=>!p.adaptationContext?p:{...p,adaptationContext:{...p.adaptationContext,...(kind==='synopsis'?{synopsis:text}:{chapters:p.adaptationContext.chapters.map(c=>c.sourceId===chapterSourceId?{...c,brief:text}:c)})}});
  return <details className="manuscript-context" open><summary>{sv?'Berättelseunderlag':'Story context'}</summary>{!project.adaptationContext?<p className="quiet">{sv?'Importerat underlag kan läggas till under Avancerat → Kapitelpilot.':'Imported context can be added under Advanced → Chapter pilot.'}</p>:([['synopsis','Synopsis',project.adaptationContext.synopsis],['brief',sv?'Kapitlets Brief':'Chapter Brief',chapter?.brief]] as const).map(([kind,label,value])=>value?<section key={kind}><label>{label}<textarea rows={5} value={value.text} onChange={e=>change(kind,{...value,text:e.target.value,approved:false})}/></label><label className="context-approval"><input type="checkbox" checked={value.approved} onChange={e=>change(kind,{...value,approved:e.target.checked})}/>{sv?'Godkänt för AI-underlag':'Approved for AI context'}</label></section>:null)}</details>;
}
