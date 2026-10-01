from pathlib import Path

p = Path('src/App.tsx')
s = p.read_text(encoding='utf-8')

old = '  const [panelEditor, setPanelEditor] = useState<{pageId:string;placementId:string}|null>(null);'
new = old + '\n  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);'
assert old in s, 'state anchor not found'
s = s.replace(old, new, 1)

old = '  const addOverlay=(pageId:string,placementId:string,type:OverlayType)=>updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>page.id!==pageId?page:{...page,placements:page.placements.map((placement)=>{\n    if(placement.id!==placementId)return placement;\n    const overlays=placement.overlays??[];'
new = '  const addOverlay=(pageId:string,placementId:string,type:OverlayType)=>{\n    const newOverlayId="overlay-"+crypto.randomUUID();\n    updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>page.id!==pageId?page:{...page,placements:page.placements.map((placement)=>{\n    if(placement.id!==placementId)return placement;\n    const overlays=placement.overlays??[];'
assert old in s, 'addOverlay start anchor not found'
s = s.replace(old, new, 1)

old = '    const overlay={id:"overlay-"+crypto.randomUUID(),type,text:type==="sfx"?"BOOM!":"Text",x,y,width,height,rotation:0,'
new = '    const overlay={id:newOverlayId,type,text:type==="sfx"?"BOOM!":"Text",x,y,width,height,rotation:0,'
assert old in s, 'overlay id anchor not found'
s = s.replace(old, new, 1)

old = '    return {...placement,overlays:[...overlays,overlay]};\n  })})}));\n  const updateOverlay='
new = '    return {...placement,overlays:[...overlays,overlay]};\n  })})}));\n    setSelectedOverlayId(newOverlayId);\n  };\n  const updateOverlay='
assert old in s, 'addOverlay end anchor not found'
s = s.replace(old, new, 1)

old = '  const deleteOverlay=(pageId:string,placementId:string,overlayId:string)=>updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>page.id!==pageId?page:{...page,placements:page.placements.map((placement)=>placement.id!==placementId?placement:{...placement,overlays:(placement.overlays??[]).filter((overlay)=>overlay.id!==overlayId)})})}));'
new = '  const deleteOverlay=(pageId:string,placementId:string,overlayId:string)=>{updateActiveProject((project)=>({...project,pages:project.pages.map((page)=>page.id!==pageId?page:{...page,placements:page.placements.map((placement)=>placement.id!==placementId?placement:{...placement,overlays:(placement.overlays??[]).filter((overlay)=>overlay.id!==overlayId)})})}));if(selectedOverlayId===overlayId)setSelectedOverlayId(null);};'
assert old in s, 'deleteOverlay anchor not found'
s = s.replace(old, new, 1)

old = 'onDoubleClick={()=>setPanelEditor({pageId:page.id,placementId:placement.id})}'
new = 'onDoubleClick={()=>{setPanelEditor({pageId:page.id,placementId:placement.id});setSelectedOverlayId((placement.overlays??[])[0]?.id??null);}}'
assert old in s, 'doubleclick anchor not found'
s = s.replace(old, new, 1)

old = 'onClick={()=>setPanelEditor({pageId:page.id,placementId:placement.id})}>Redigera text</button>'
new = 'onClick={()=>{setPanelEditor({pageId:page.id,placementId:placement.id});setSelectedOverlayId((placement.overlays??[])[0]?.id??null);}}>Redigera text</button>'
assert old in s, 'edit button anchor not found'
s = s.replace(old, new, 1)

start = s.index('      {panelEditor && activeProject ? (()=>{')
end = s.index('      {panel ? <div className="overlay"', start)
new_editor = '''      {panelEditor && activeProject ? (()=>{const pg=activeProject.pages.find(x=>x.id===panelEditor.pageId),pl=pg?.placements.find(x=>x.id===panelEditor.placementId);if(!pg||!pl)return null;const o=(pl.overlays??[]).find(item=>item.id===selectedOverlayId)??null;return <div className="panel-editor-backdrop" onPointerDown={(e)=>e.target===e.currentTarget&&setPanelEditor(null)}><section className="panel-editor-modal"><header><div><p className="eyebrow">PANELREDIGERARE</p><h2>Sida {pg.number} · ruta {pl.readingOrder}</h2></div><button className="text-button" onClick={()=>setPanelEditor(null)}>Stäng</button></header><div className="panel-editor-layout"><div className="panel-editor-stage">{pl.image?<img src={pl.image.dataUrl} alt="" />:<div className="panel-editor-empty">Ingen bild uppladdad</div>}<svg viewBox="0 0 100 100" preserveAspectRatio="none">{(pl.overlays??[]).map((item)=>{const selected=item.id===selectedOverlayId;return <g key={item.id} className={selected?"editable-overlay is-selected":"editable-overlay"}><g className="overlay-drag-surface" onPointerDown={(e)=>{setSelectedOverlayId(item.id);beginOverlayDrag(e,pg.id,pl.id,item,"move");}}><SvgOverlay overlay={item}/></g>{selected?<><rect className="overlay-selection-frame" x={item.x} y={item.y} width={item.width} height={item.height} rx="1"/><rect className="overlay-resize-grip" x={item.x+item.width-1.5} y={item.y+item.height-1.5} width="3" height="3" rx=".5" onPointerDown={(e)=>beginOverlayDrag(e,pg.id,pl.id,item,"resize")}/>{item.type==="speech"&&item.tailEnabled!==false&&item.tailX!==undefined&&item.tailY!==undefined?<circle className="overlay-tail-grip" cx={item.tailX} cy={item.tailY} r="1.6" onPointerDown={(e)=>beginOverlayDrag(e,pg.id,pl.id,item,"tail")}/>:null}</>:null}</g>})}</svg></div><aside className="panel-editor-tools"><div className="panel-editor-tools-head"><h3>{o?"Egenskaper":"Textlager"}</h3><div className="panel-editor-add-actions"><button className="primary-button compact-button" type="button" onClick={()=>addOverlay(pg.id,pl.id,"speech")}>+ Pratbubbla</button><button className="text-button compact-button" type="button" onClick={()=>addOverlay(pg.id,pl.id,"caption")}>+ Berättarruta</button></div></div>{o?<div className="panel-tool-card selected-panel-tool"><div className="panel-tool-title"><strong>{o.type==="speech"?"Pratbubbla":o.type==="thought"?"Tankebubbla":o.type==="caption"?"Berättarruta":"Ljudeffekt"}</strong><button className="text-button danger-text" type="button" onClick={()=>deleteOverlay(pg.id,pl.id,o.id)}>Ta bort</button></div><label>Typ<select value={o.type} onChange={(e)=>{const type=e.target.value as OverlayType;updateOverlay(pg.id,pl.id,o.id,{type,tailEnabled:type==="speech",tailX:type==="speech"?(o.tailX??o.x+o.width*.65):undefined,tailY:type==="speech"?(o.tailY??o.y+o.height*1.15):undefined,roundness:type==="caption"?(o.roundness??18):(o.roundness??60)});}}><option value="speech">Pratbubbla</option><option value="caption">Berättarruta</option><option value="thought">Tankebubbla</option><option value="sfx">SFX</option></select></label><label>Text<input value={o.text} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{text:e.target.value})}/></label><div className="type-grid"><label>Font<select value={o.fontFamily??"Comic Neue, sans-serif"} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{fontFamily:e.target.value})}><option value="Comic Neue, sans-serif">Comic Neue</option><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option><option value="Impact, sans-serif">Impact</option></select></label><label>Vikt<select value={o.fontWeight??600} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{fontWeight:Number(e.target.value)})}><option value="400">400 Normal</option><option value="500">500 Medium</option><option value="600">600 Semi-bold</option><option value="700">700 Bold</option><option value="800">800 Extra-bold</option><option value="900">900 Black</option></select></label><label>Storlek (relativ)<input type="number" min="1" max="120" step="0.5" value={o.fontSize??8} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{fontSize:Math.max(1,Math.min(120,Number(e.target.value)||1))})}/></label></div>{o.type==="speech"?<><label className="tail-toggle"><input type="checkbox" checked={o.tailEnabled!==false} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{tailEnabled:e.target.checked,tailX:e.target.checked?(o.tailX??o.x+o.width*.65):o.tailX,tailY:e.target.checked?(o.tailY??o.y+o.height*1.15):o.tailY})}/> Svans</label>{o.tailEnabled!==false?<div className="number-grid"><label>Svansböjning<input type="number" min="-100" max="100" value={o.tailCurve??0} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{tailCurve:Math.max(-100,Math.min(100,Number(e.target.value)||0))})}/></label><label>Rotbredd<input type="number" min="0" max="100" value={o.tailRootWidth??50} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{tailRootWidth:Math.max(0,Math.min(100,Number(e.target.value)||0))})}/></label><label>Rundning<input type="number" min="0" max="100" value={o.roundness??60} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{roundness:Math.max(0,Math.min(100,Number(e.target.value)||0))})}/></label></div>:<label>Rundning<input type="number" min="0" max="100" value={o.roundness??60} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{roundness:Math.max(0,Math.min(100,Number(e.target.value)||0))})}/></label>}</>:o.type==="caption"?<label>Rundning<input type="number" min="0" max="100" value={o.roundness??18} onChange={(e)=>updateOverlay(pg.id,pl.id,o.id,{roundness:Math.max(0,Math.min(100,Number(e.target.value)||0))})}/></label>:null}</div>:<div className="panel-editor-empty-properties"><p>Välj en bubbla direkt i bilden för att redigera den.</p><p className="quiet">Du kan också skapa en ny pratbubbla eller berättarruta ovan.</p></div>}</aside></div></section></div>})() : null}
'''
s = s[:start] + new_editor + s[end:]
p.write_text(s, encoding='utf-8')

css = Path('src/styles.css')
c = css.read_text(encoding='utf-8')
c += '\n.overlay-selection-frame{fill:none;stroke:currentColor;stroke-width:.45;stroke-dasharray:2 1.5;opacity:.62;vector-effect:non-scaling-stroke;pointer-events:none}\n.panel-editor-empty-properties{padding:18px 0;color:var(--text)}\n.selected-panel-tool{border-top:0;padding-top:8px}\n.panel-editor-add-actions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}\n'
css.write_text(c, encoding='utf-8')
