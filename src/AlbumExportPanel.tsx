import { useEffect, useRef, useState } from "react";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import { PageFormatEditor } from "./PageFormatEditor";
import { albumPageFormat, pageDimensions, rasterDimensions } from "./pageFormat";
import type { ExportOptions } from "./albumExport";
export function AlbumExportPanel({project, locale}: {project: ComicProject; locale: Locale}) {
  const sv=locale==="sv";
  const [options,setOptions]=useState<ExportOptions>(()=>({format:"pdf",pageIds:project.pages.map(p=>p.id),pageFormat:albumPageFormat(project),dpi:300,fit:"contain",jpegQuality:.95}));
  const [busy,setBusy]=useState(false), [progress,setProgress]=useState([0,0]), [error,setError]=useState(""), [complete,setComplete]=useState("");
  const abort=useRef<AbortController|null>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  let dimensions:ReturnType<typeof rasterDimensions>|undefined;try{dimensions=rasterDimensions(options.pageFormat,options.dpi);}catch{}
  const pages=[...project.pages].sort((a,b)=>a.number-b.number), selected=pages.filter(p=>options.pageIds.includes(p.id));
  const emptyImages=selected.reduce((n,p)=>n+p.placements.filter(l=>!l.image).length,0);
  const source=pageDimensions(albumPageFormat(project)), target=pageDimensions(options.pageFormat), changedAspect=Math.abs(source.widthMm/source.heightMm-target.widthMm/target.heightMm)>.001;
  async function run() {
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
      <label>{sv?"Filformat":"File format"}<select value={options.format} onChange={e=>setOptions({...options,format:e.target.value as ExportOptions["format"]})}><option value="pdf">PDF</option><option value="jpeg">JPEG</option><option value="png">PNG</option></select></label>
      <p className="quiet">{sv?"PDF samlar sidorna i en fil. PNG och JPEG ger en bild per sida; flera bilder laddas ner som ZIP.":"PDF contains all selected pages. PNG and JPEG create one image per page; multiple images are downloaded as ZIP."}</p>
      <label>{sv?"Sidor":"Pages"}<select value={options.pageIds.length===pages.length?"all":"selected"} onChange={e=>setOptions({...options,pageIds:e.target.value==="all"?pages.map(p=>p.id):[]})}><option value="all">{sv?"Hela albumet":"Whole album"}</option><option value="selected">{sv?"Valda sidor":"Selected pages"}</option></select></label>
      <div className="export-page-list">{pages.map(p=><label key={p.id}><input type="checkbox" checked={options.pageIds.includes(p.id)} onChange={e=>setOptions({...options,pageIds:e.target.checked?[...options.pageIds,p.id]:options.pageIds.filter(id=>id!==p.id)})}/>{sv?"Sida":"Page"} {p.number}</label>)}</div>
      {!pages.length?<p>{sv?"Skapa en sida under Sidor före export.":"Create a page in Pages before exporting."}</p>:null}
      <PageFormatEditor value={options.pageFormat} locale={locale} onChange={pageFormat=>setOptions({...options,pageFormat})}/>
      <p className="quiet">{sv?"Formatet här gäller bara exporten. Albumets layout och inställningar behålls.":"This format applies to this export. The album layout and settings are preserved."}</p>
      {changedAspect?<label>{sv?"Anpassning till annat format":"Fit to another format"}<select value={options.fit} onChange={e=>setOptions({...options,fit:e.target.value as ExportOptions["fit"]})}><option value="contain">{sv?"Bevara hela sidan med marginaler":"Keep whole page with margins"}</option><option value="cover">{sv?"Fyll sidan och beskär kanterna":"Fill page and crop edges"}</option></select></label>:null}
      {changedAspect&&options.fit==="cover"?<p>{sv?"Kanterna beskärs; bildrutor och text nära kanten kan försvinna.":"Edges will be cropped; frames and text near the edge may be cut off."}</p>:null}
      <label>{sv?"Upplösning (dpi)":"Resolution (dpi)"}<select value={options.dpi} onChange={e=>setOptions({...options,dpi:Number(e.target.value)})}><option value="72">72</option><option value="150">150</option><option value="300">300</option><option value="600">600</option></select></label>
      {dimensions?<p className="quiet">{dimensions.width} × {dimensions.height} px {sv?"per sida":"per page"}</p>:<p role="alert">{sv?"För stor bild. Välj lägre dpi eller mindre sidformat.":"Image too large. Choose a lower DPI or smaller page size."}</p>}
      {options.format==="jpeg"?<label>{sv?"JPEG-kvalitet (%)":"JPEG quality (%)"}<input type="number" min="50" max="100" value={Math.round(options.jpegQuality*100)} onChange={e=>setOptions({...options,jpegQuality:Math.max(.5,Math.min(1,Number(e.target.value)/100))})}/></label>:null}
      {emptyImages?<p className="quiet">{emptyImages} {sv?"bildrutor saknar bild och exporteras med vit bakgrund.":"frames have no image and will export with a white background."}</p>:null}
      <button type="button" className="primary-button" disabled={!selected.length||!dimensions} onClick={()=>void run()}>{sv?"Ladda ner export":"Download export"}</button>
    </fieldset>
    {busy?<><progress className="export-progress" value={progress[0]} max={progress[1]||1}/><p role="status">{sv?"Skapar sida":"Rendering page"} {progress[0]} / {progress[1]}</p><button type="button" onClick={()=>{abort.current?.abort();setBusy(false);}}>{sv?"Avbryt export":"Cancel export"}</button></>:null}
    {error?<p role="alert">{error}</p>:null}{complete?<p role="status">{sv?"Exportfil skapad":"Export file created"}: {complete}</p>:null}
  </div>;
}
