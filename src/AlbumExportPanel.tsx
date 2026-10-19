import { useEffect, useRef, useState } from "react";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import { PageFormatEditor } from "./PageFormatEditor";
import { albumPageFormat, pageDimensions, rasterDimensions } from "./pageFormat";
import { checkExport, type ExportIssue } from "./exportPreflight";
import type { ExportOptions } from "./albumExport";
export function AlbumExportPanel({project, locale, onInspect}: {project: ComicProject; locale: Locale; onInspect?: (issue: ExportIssue) => void}) {
  const sv=locale==="sv";
  const [options,setOptions]=useState<ExportOptions>(()=>({format:"pdf",pageIds:project.pages.map(p=>p.id),pageFormat:albumPageFormat(project),dpi:300,fit:"contain",jpegQuality:.95}));
  const [busy,setBusy]=useState(false), [progress,setProgress]=useState([0,0]), [error,setError]=useState(""), [complete,setComplete]=useState("");
  const abort=useRef<AbortController|null>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  let dimensions:ReturnType<typeof rasterDimensions>|undefined;try{dimensions=rasterDimensions(options.pageFormat,options.dpi);}catch{}
  const pages=[...project.pages].sort((a,b)=>a.number-b.number), selected=pages.filter(p=>options.pageIds.includes(p.id));
  const [report,setReport]=useState<{project:ComicProject;options:ExportOptions;issues:ExportIssue[];failed?:boolean}|null>(null);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setReport(null);
    checkExport(project,options,controller.signal).then(issues=>{if(!controller.signal.aborted)setReport({project,options,issues});},()=>{if(!controller.signal.aborted)setReport({project,options,issues:[],failed:true});});
    return()=>controller.abort();
  },[project,options,retry]);
  const current=report?.project===project && report.options===options?report:null;
  const issues=current?.issues??[], errors=issues.some(issue=>issue.severity==="error");
  const location=(issue:ExportIssue)=>issue.kind==="unplaced-panel"&&!issue.pageId?(sv?"Albumets panelpool":"Album panel pool"):`${sv?"Sida":"Page"} ${issue.pageNumber} · ${issue.layerKind==="pool"?(sv?"Väntar på placering":"Waiting for placement"):issue.layerKind==="background"?(sv?"Sidbakgrund":"Page background"):issue.layerKind==="foreground"?(sv?"Förgrund":"Foreground"):`${sv?"Panel":"Panel"} ${issue.panelNumber}`}`;
  const message=(issue:ExportIssue)=>issue.kind==="unplaced-panel"?(sv?"Panelen väntar på placering och ingår inte i exporten.":"This panel is waiting for placement and is not included in the export."):issue.kind==="empty-image"?(sv?"Bildrutan saknar bild och exporteras utan bild.":"This frame has no image and will export without one."):issue.kind==="unreadable-image"?(sv?"Bilden kan inte läsas. Byt ut eller ta bort den före export.":"The image cannot be read. Replace or remove it before exporting."):issue.kind==="low-resolution"?(sv?`Cirka ${issue.dpi} dpi i exportens storlek. Under rekommenderade 300 dpi för tryck.`:`About ${issue.dpi} DPI at export size. Below the recommended 300 DPI for print.`):(sv?"Texten kan vara för stor för textrutan. Öka rutan eller minska textstorleken.":"Text may not fit its text box. Enlarge the box or reduce the text size.");
  const source=pageDimensions(albumPageFormat(project)), target=pageDimensions(options.pageFormat), changedAspect=Math.abs(source.widthMm/source.heightMm-target.widthMm/target.heightMm)>.001;
  async function run() {
    if(!current || current.failed || errors)return;
    const controller=new AbortController();abort.current=controller;setBusy(true);setError("");setComplete("");
    try {
      const { exportAlbum } = await import("./albumExport");
      const file=await exportAlbum(project,options,(done,total)=>{if(!controller.signal.aborted)setProgress([done,total]);},controller.signal);
      if(controller.signal.aborted)return;
      const url=URL.createObjectURL(file.blob),link=document.createElement("a");link.href=url;link.download=file.name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30_000);setComplete(file.name);
    }catch(err){if(controller.signal.aborted)return;setError(sv?"Exporten kunde inte skapas. Kontrollera bilder och sidstorlek och försök igen.":"Export failed. Check images and page size and try again.");}
    finally {if(!controller.signal.aborted)setBusy(false);}
  }
  return <div>
    <fieldset disabled={busy}><legend>{sv?"Exportera serien":"Export comic"}</legend>
      <label>{sv?"Filformat":"File format"}<select value={options.format} onChange={e=>setOptions({...options,format:e.target.value as ExportOptions["format"]})}><option value="pdf">PDF</option><option value="jpeg">JPEG</option><option value="png">PNG</option><option value="idml">IDML — InDesign / Affinity (beta)</option></select></label>
      {options.format!=="idml"?<p className="quiet">{sv?"PDF samlar sidorna i en fil. PNG och JPEG ger en bild per sida; flera bilder laddas ner som ZIP.":"PDF contains all selected pages. PNG and JPEG create one image per page; multiple images are downloaded as ZIP."}</p>:null}
      <label>{sv?"Sidor":"Pages"}<select value={options.pageIds.length===pages.length?"all":"selected"} onChange={e=>setOptions({...options,pageIds:e.target.value==="all"?pages.map(p=>p.id):[]})}><option value="all">{sv?"Hela albumet":"Whole album"}</option><option value="selected">{sv?"Valda sidor":"Selected pages"}</option></select></label>
      <div className="export-page-list">{pages.map(p=><label key={p.id}><input type="checkbox" checked={options.pageIds.includes(p.id)} onChange={e=>setOptions({...options,pageIds:e.target.checked?[...options.pageIds,p.id]:options.pageIds.filter(id=>id!==p.id)})}/>{sv?"Sida":"Page"} {p.number}</label>)}</div>
      {!pages.length?<p>{sv?"Skapa en sida under Sidor före export.":"Create a page in Pages before exporting."}</p>:null}
      <PageFormatEditor value={options.pageFormat} locale={locale} onChange={pageFormat=>setOptions({...options,pageFormat})}/>
      <p className="quiet">{sv?"Formatet här gäller bara exporten. Albumets layout och inställningar behålls.":"This format applies to this export. The album layout and settings are preserved."}</p>
      {changedAspect?<label>{sv?"Anpassning till annat format":"Fit to another format"}<select value={options.fit} onChange={e=>setOptions({...options,fit:e.target.value as ExportOptions["fit"]})}><option value="contain">{sv?"Bevara hela sidan med marginaler":"Keep whole page with margins"}</option><option value="cover">{sv?"Fyll sidan och beskär kanterna":"Fill page and crop edges"}</option></select></label>:null}
      {changedAspect&&options.fit==="cover"?<p>{sv?"Kanterna beskärs; bildrutor och text nära kanten kan försvinna.":"Edges will be cropped; frames and text near the edge may be cut off."}</p>:null}
      {options.format!=="idml"?<><label>{sv?"Upplösning (dpi)":"Resolution (dpi)"}<select value={options.dpi} onChange={e=>setOptions({...options,dpi:Number(e.target.value)})}><option value="72">72</option><option value="150">150</option><option value="300">300</option><option value="600">600</option></select></label>
      {dimensions?<p className="quiet">{dimensions.width} × {dimensions.height} px {sv?"per sida":"per page"}</p>:<p role="alert">{sv?"För stor bild. Välj lägre dpi eller mindre sidformat.":"Image too large. Choose a lower DPI or smaller page size."}</p>}
      </>:null}
      {options.format==="idml"?<p className="quiet">{sv?"ZIP med IDML och bildmapp. Packa upp allt före öppning. Bilder, panelramar, bubblor och text ligger på separata lager. Installera använda typsnitt och kontrollera radbrytning i InDesign eller Affinity. Text och bubblor som går utanför en panel beskärs inte i denna betaversion.":"ZIP with IDML and images. Extract everything before opening. Images, panel borders, bubbles and text use separate layers. Install the fonts used and check wrapping in InDesign or Affinity. Text and bubbles extending beyond a panel are not clipped in this beta."}</p>:null}
      {options.format==="jpeg"?<label>{sv?"JPEG-kvalitet (%)":"JPEG quality (%)"}<input type="number" min="50" max="100" value={Math.round(options.jpegQuality*100)} onChange={e=>setOptions({...options,jpegQuality:Math.max(.5,Math.min(1,Number(e.target.value)/100))})}/></label>:null}
      <section className="export-preflight" aria-labelledby="export-check-title" aria-busy={!current}>
        <h3 id="export-check-title">{sv?"Kontroll före export":"Pre-export check"}</h3>
        {!current?<p role="status">{sv?"Kontrollerar text och bilder…":"Checking text and images…"}</p>:current.failed?<><p role="alert">{sv?"Kontrollen kunde inte slutföras. Försök igen.":"The check could not be completed. Please try again."}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>{sv?"Försök igen":"Retry"}</button></>:<>
          <p role="status">{issues.length?`${issues.length} ${sv?"saker att granska":"items to review"}`:(sv?"Inga problem hittades i de valda sidorna.":"No issues found on the selected pages.")}</p>
          {issues.length?<ul>{issues.map((issue,index)=><li key={`${issue.layerId}-${issue.kind}-${issue.overlayId??index}`}><div><strong>{location(issue)}</strong><p>{message(issue)}</p>{issue.excerpt?<q>{issue.excerpt}</q>:null}</div>{onInspect?<button type="button" className="text-button" onClick={()=>onInspect(issue)}>{sv?"Visa":"Show"}</button>:null}</li>)}</ul>:null}
          <p className="quiet">{sv?"Textkontrollen uppskattar utrymmet i textrutan. Granska även rundade bubblor och fria panelkonturer visuellt. 300 dpi gäller bildens storlek på papper; högre export-dpi ger inte fler detaljer i originalbilden.":"Text checks estimate the text box space. Also inspect rounded bubbles and custom panel outlines visually. 300 DPI refers to the image's printed size; increasing export DPI adds no detail to the original image."}</p>
          {issues.length&&!errors?<p>{sv?"Du kan exportera ändå, till exempel en läskopia med tomma rutor.":"You can still export, for example a reading copy with empty frames."}</p>:null}
        </>}
      </section>
      <button type="button" className="primary-button" disabled={!selected.length||!current||Boolean(current.failed)||errors||(options.format!=="idml"&&!dimensions)} onClick={()=>void run()}>{sv?"Ladda ner export":"Download export"}</button>
    </fieldset>
    {busy?<><progress className="export-progress" value={progress[0]} max={progress[1]||1}/><p role="status">{sv?"Skapar sida":"Rendering page"} {progress[0]} / {progress[1]}</p><button type="button" onClick={()=>{abort.current?.abort();setBusy(false);}}>{sv?"Avbryt export":"Cancel export"}</button></>:null}
    {error?<p role="alert">{error}</p>:null}{complete?<p role="status">{sv?"Exportfil skapad":"Export file created"}: {complete}</p>:null}
  </div>;
}


