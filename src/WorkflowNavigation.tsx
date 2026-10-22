import type { AlbumSection, AlbumTool } from "./AlbumMenu";
import type { Locale } from "./settings";
import "./workspaceLayout.css";

function StepIcon({index}:{index:number}) {
  const paths=["M4 4h6c2 0 2 1 2 2v15c0-2-2-3-4-3H4z M20 4h-6c-2 0-2 1-2 2v15c0-2 2-3 4-3h4z", "M8 5h12 M8 12h12 M8 19h12 M3 5h1 M3 12h1 M3 19h1", "M3 3h18v18H3z M3 10h18 M11 10v11", "M3 3h18v18H3z M3 17l6-6 5 5 3-3 4 4 M8 7h.01", "M4 3h16v18H4z M7 6h10v5H7z M7 14h4v4H7z M14 14h3v4h-3z", "M12 3v12 M7 8l5-5 5 5 M4 14v7h16v-7"];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[index]}/></svg>;
}
export function WorkflowNavigation({section,mode,locale,onSection,onMode}:{section:AlbumSection;mode:AlbumTool;locale:Locale;onSection:(s:AlbumSection)=>void;onMode:(m:AlbumTool)=>void}) {
  const sv=locale==='sv',nb=locale==='nb';
  const steps=[
    ['manus',sv?'Manus & scener':nb?'Manus & scener':'Manuscript & scenes',sv?'Berättelsens underlag':nb?'Fortellingens grunnlag':'Story foundations'],
    ['beats','Beats',sv?'Välj berättelsemoment':nb?'Velg historiens øyeblikk':'Select story moments'],
    ['storyboard',sv?'Paneler':nb?'Paneler':'Panels',sv?'Regissera varje bildruta':nb?'Regisser hvert bilde':'Stage each panel'],
    ['images',sv?'Bilder':nb?'Bilder':'Images',sv?'Skapa eller importera':nb?'Lag eller importer':'Create or import'],
    ['pages',sv?'Sidor':nb?'Sider':'Pages',sv?'Bygg albumets layout':nb?'Bygg albumets layout':'Compose your album'],
    ['export',sv?'Export':nb?'Eksport':'Export',sv?'Granska och exportera':nb?'Se over og eksporter':'Review and export'],
  ] as const;
  return <nav className={`workflow-navigation${section==='pages'?' is-compact':''}`} aria-label={sv?'Arbetsflöde':nb?'Arbeidsflyt':'Workflow'}>{steps.map(([key,label,help],index)=><button key={key} type="button" aria-label={label} aria-current={(key==='export'?mode==='export':mode!=='export'&&section===key)?'step':undefined} onClick={()=>{if(key==='export')onMode('export');else{onMode(null);onSection(key);}}}><StepIcon index={index}/><span className="workflow-card-label">{label}</span><small aria-hidden="true">{help}</small></button>)}</nav>;
}
