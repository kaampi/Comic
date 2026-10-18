import { useRef } from "react";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
export const foregroundText = (locale: Locale) => locale==='sv'?{
 title:'Förgrundsbilder',add:'Lägg till förgrundsbild',edit:'Redigera bild och bubblor',up:'Flytta framåt',down:'Flytta bakåt',remove:'Ta bort förgrundslager',group:'Flytta bilden och bubblorna tillsammans',help:'Bilderna ligger över rutorna. Egna bubblor kan placeras över hela sidan. Översta bilden i listan ligger längst fram.',foreground:'Förgrund',uploadError:'Förgrundsbilden kunde inte läsas.'
}:locale==='nb'?{
 title:'Forgrunnsbilder',add:'Legg til forgrunnsbilde',edit:'Rediger bilde og bobler',up:'Flytt fremover',down:'Flytt bakover',remove:'Fjern forgrunnslag',group:'Flytt bildet og boblene sammen',help:'Bildene ligger over rutene. Egne bobler kan plasseres over hele siden. Øverste bilde i listen ligger fremst.',foreground:'Forgrunn',uploadError:'Forgrunnsbildet kunne ikke leses.'
}:{title:'Foreground images',add:'Add foreground image',edit:'Edit image and bubbles',up:'Bring forward',down:'Send backward',remove:'Remove foreground layer',group:'Move image and bubbles together',help:'Images sit above the frames. Their bubbles can span the whole page. The top image in the list is in front.',foreground:'Foreground',uploadError:'The foreground image could not be read.'};
export function ForegroundControls({page,locale,onUpload,onEdit,onOrder,onRemove}:{page:ComicProject['pages'][number];locale:Locale;onUpload:(file:File)=>void;onEdit:(id:string)=>void;onOrder:(id:string,direction:-1|1)=>void;onRemove:(id:string)=>void}){
 const input=useRef<HTMLInputElement>(null),t=foregroundText(locale),layers=[...(page.foregrounds??[])].reverse();
 return <section className="foreground-controls" aria-label={t.title}><h3>{t.title}</h3><p className="quiet">{t.help}</p>
 <input ref={input} type="file" aria-label={t.add} accept="image/png,image/webp,image/jpeg" hidden onChange={e=>{const file=e.target.files?.[0];if(file)onUpload(file);e.currentTarget.value='';}}/>
 <button className="secondary-button" type="button" onClick={()=>input.current?.click()}>{t.add}</button>
 <ol>{layers.map((layer,index)=><li key={layer.id} data-foreground-id={layer.id}>{layer.image?<img src={layer.image.dataUrl} alt=""/>:null}<span>{index+1} · {layer.image?.name??t.foreground}</span>
 <button type="button" className="text-button" onClick={()=>onEdit(layer.id)}>{t.edit}</button>
 <button type="button" className="text-button" disabled={index===0} aria-label={t.up} title={t.up} onClick={()=>onOrder(layer.id,1)}>↑</button>
 <button type="button" className="text-button" disabled={index===layers.length-1} aria-label={t.down} title={t.down} onClick={()=>onOrder(layer.id,-1)}>↓</button>
 <button type="button" className="text-button danger-text" onClick={()=>onRemove(layer.id)}>{t.remove}</button></li>)}</ol></section>;
}
