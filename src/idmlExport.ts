import { customBubbleOutline, customBubblePath } from "./bubbleShape";
import { richTextLayout, textPieces } from "./richText";
import { bubbleGroups, connectedBubbleGeometry } from "./bubbleConnections";
import type { ComicProject, TextOverlay } from "./project";
import type { ExportOptions } from "./albumExport";
import { exportFilename } from "./albumExport";
import { albumPageFormat, layerRect, pageGridMetrics, pageAspect, pageDimensions, PANEL_BORDER, validPageFormat } from "./pageFormat";
import { panelOutline } from "./panelGeometry";
import { visibleShapeEdges, panelShapePoints } from "./panelShape";
import { panelBorderStyle, panelBorderWidth } from "./panelBorder";
import { handDrawnBorderPath } from "./handDrawnBorder";
import { imagePlacement, imageAffineTransform } from "./imageView";
import { imageArchive, imageDensity } from "./exportFiles";
import { captionPath, speechPath, shoutPath } from "./SvgOverlay";
import { thoughtCloudGeometry, thoughtTrailGeometry } from "./thoughtBubble";
import { sfxPrimitives } from "./sfxShapes";
import { overlayFont } from "./overlayTypography";
import { polygonPath, rectanglePath, svgGeometry, transformPaths, type GeometryPath, type Point } from "./idmlGeometry";

const NS="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging";
const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const encode=(s:string)=>new TextEncoder().encode(s);
const xml=(s:string)=>s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));
const num=(n:number)=>{if(!Number.isFinite(n))throw new Error("invalid-idml-geometry");return String(Math.round(n*1e6)/1e6);};
const pair=(p:Point)=>`${num(p.x)} ${num(p.y)}`;
const part=(kind:string,body:string)=>`${declaration}<idPkg:${kind} xmlns:idPkg="${NS}" DOMVersion="8.0">${body}</idPkg:${kind}>`;
const check=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException("Cancelled","AbortError");};
export function idmlPathGeometry(paths:GeometryPath[]) {
  return `<PathGeometry>${paths.map(path=>`<GeometryPathType PathOpen="${path.open}"><PathPointArray>${path.points.map(p=>`<PathPointType Anchor="${pair(p.anchor)}" LeftDirection="${pair(p.left)}" RightDirection="${pair(p.right)}"/>`).join("")}</PathPointArray></GeometryPathType>`).join("")}</PathGeometry>`;
}
// Fonts with one bundled weight must use their actual desktop style name.
export function idmlFont(o:TextOverlay) {
  const family=(o.fontFamily??(o.type==="sfx"?"Impact":"Comic Neue")).split(",")[0].replace(/["']/g,"").trim();
  const hasBold=["Comic Neue","Comic Relief","Action Man","Fuzzy Bubbles"].includes(family);
  return {family,style:hasBold&&(o.fontWeight??(o.type==="sfx"?800:600))>=600?"Bold":"Regular"};
}
function artwork(o:TextOverlay):{paths:GeometryPath[];fill:boolean}[] {
  const style=o.bubbleStyle??"organic";
  if(o.type==="thought") {
    const cloud=o.bubbleShapePoints?{outline:customBubbleOutline(o),path:customBubblePath(o)}:thoughtCloudGeometry(o.width,o.height);
    return [...thoughtTrailGeometry(o,cloud.outline).map(c=>({paths:svgGeometry(`M ${c.x+c.r} ${c.y} A ${c.r} ${c.r} 0 1 1 ${c.x-c.r} ${c.y} A ${c.r} ${c.r} 0 1 1 ${c.x+c.r} ${c.y} Z`),fill:true})),{paths:svgGeometry(cloud.path),fill:true}];
  }
  if(o.type==="sfx")return sfxPrimitives(o.sfxShapeId??"none").map(p=>({paths:transformPaths(svgGeometry(p.d),q=>({x:q.x*o.width/100,y:q.y*o.height/60})),fill:p.fill}));
  return [{paths:svgGeometry(o.type==="caption"?captionPath(o):style==="shout"?shoutPath(o):speechPath(o,style)),fill:true}];
}
type ArchiveFile={name:string;bytes:Uint8Array};
export async function exportIdml(project:ComicProject,options:ExportOptions,onProgress:(done:number,total:number)=>void,signal?:AbortSignal) {
  const pages=[...project.pages].sort((a,b)=>a.number-b.number).filter(p=>options.pageIds.includes(p.id));
  if(!pages.length)throw new Error("no-pages");
  if(!validPageFormat(options.pageFormat))throw new Error("invalid-export-size");check(signal);
  const target=pageDimensions(options.pageFormat),w=target.widthMm*72/25.4,h=target.heightMm*72/25.4;
  const sourceFormat=albumPageFormat(project),sourceH=700/pageAspect(sourceFormat);
  const scale=(options.fit==="cover"?Math.max:Math.min)(w/700,h/sourceH),dx=(w-700*scale)/2,dy=(h-sourceH*scale)/2;
  const map=(p:Point)=>({x:dx+p.x*scale,y:dy+p.y*scale});
  const files:ArchiveFile[]=[],assets:ArchiveFile[]=[],spreads:string[]=[],stories:string[]=[],colors=new Map<string,string>(),fonts=new Map<string,{family:string;style:string}>();
  let count=0;const id=()=>`cb${++count}`;
  const add=(name:string,content:string)=>files.push({name,bytes:encode(content)});
  const color=(value:string)=>{if(value==="none")return "Swatch/None";if(!/^#[0-9a-f]{6}$/i.test(value))throw new Error("invalid-export-color");const hex=value.toLowerCase();if(!colors.has(hex))colors.set(hex,`Color/CB${hex.slice(1)}`);return colors.get(hex)!;};
  const layers=[{id:"cbText",name:"Text"},{id:"cbBubbles",name:"Bubbles and SFX"},...(pages.some(page=>page.foregrounds?.length)?[{id:"cbForeground",name:"Foreground images"}]:[]),{id:"cbFrames",name:"Panel borders"},{id:"cbImages",name:"Images"},{id:"cbBackground",name:"Background"}];
  const shape=(paths:GeometryPath[],layer:string,name:string,fill:string,stroke="none",weight=0,extra="",children="",transform="1 0 0 1 0 0",tag="Polygon")=>
    `<${tag} Self="${id()}" Name="${xml(name)}" ItemLayer="${layer}" ItemTransform="${transform}" ContentType="${children.startsWith("<Image ")?"GraphicType":"Unassigned"}" FillColor="${color(fill)}" StrokeColor="${color(stroke)}" StrokeWeight="${num(weight)}" StrokeAlignment="CenterAlignment" EndJoin="RoundEndJoin" AppliedObjectStyle="ObjectStyle/$ID/[None]" Visible="true" Locked="false" ${extra}><Properties>${idmlPathGeometry(paths)}</Properties>${children}</${tag}>`;
  const fontLoads=pages.flatMap(p=>[...(p.background?[p.background]:[]),...p.placements,...(p.foregrounds??[])].flatMap(l=>l.overlays)).flatMap(o=>[o,...textPieces(o).map(p=>({...o,...Object.fromEntries(Object.entries(p.style).filter(([,v])=>v!==undefined))}))]).map(o=>typeof document!=="undefined"?document.fonts?.load(overlayFont(o,16),o.text||"ÅÄÖ abc"):undefined);
  if(typeof document!=="undefined")await Promise.all(fontLoads);check(signal);
  const imageCache=new Map<string,{name:string;width:number;height:number;mime:string}>();
  async function imageAsset(url:string) {
    const cached=imageCache.get(url);if(cached)return cached;
    if(!url.startsWith("data:image/")&&!url.startsWith("blob:"))throw new Error("image-load-failed");
    check(signal);const response=await fetch(url,{signal});if(!response.ok)throw new Error("image-load-failed");let blob=await response.blob();
    const objectUrl=URL.createObjectURL(blob),image=new Image();
    try {
      image.src=objectUrl;await image.decode();check(signal);
      if(blob.type!=="image/png"&&blob.type!=="image/jpeg") {
        const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        const ctx=canvas.getContext("2d");if(!ctx)throw new Error("canvas-unavailable");ctx.drawImage(image,0,0);
        blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("encode-failed")),"image/png"));canvas.width=canvas.height=0;
      }
      const name=`Links/image-${String(assets.length+1).padStart(4,"0")}.${blob.type==="image/jpeg"?"jpg":"png"}`;
      // Normalize the exported copy to 72 dpi: one GraphicBounds unit per pixel.
      assets.push({name,bytes:imageDensity(new Uint8Array(await blob.arrayBuffer()),blob.type,72)});
      const value={name,width:image.naturalWidth,height:image.naturalHeight,mime:blob.type};imageCache.set(url,value);return value;
    } finally {URL.revokeObjectURL(objectUrl);}
  }
  onProgress(0,pages.length);
  for(const [index,page] of pages.entries()) {
    check(signal);const items:string[]=[],gridMetrics=pageGridMetrics(page,sourceFormat);
    items.push(shape([rectanglePath(0,0,w,h)],"cbBackground","Page background","#fffdf7"));
    for(const layer of [...(page.background?[page.background]:[]),...page.placements,...(page.foregrounds??[])]) {
      const background=layer.id===page.background?.id,foreground=!!page.foregrounds?.some(l=>l.id===layer.id),full=background||foreground;
      const r=full?{x:0,y:0,width:700,height:sourceH}:layerRect(page,layer,sourceFormat),inset=full?0:PANEL_BORDER;
      const bubbleLayer=background&&!page.foregrounds?.length?"cbBackground":"cbBubbles",textLayer=background&&!page.foregrounds?.length?"cbBackground":"cbText";
      const x=r.x+inset,y=r.y+inset,lw=r.width-2*inset,lh=r.height-2*inset;
      if(lw<=0||lh<=0)throw new Error("invalid-layout");
      const clip=full?rectanglePath(x,y,lw,lh):polygonPath(panelShapePoints(layer).map(p=>({x:x+p.x/4*lw,y:y+p.y/4*lh})));
      let imageXml="";
      if(layer.image) {
        const asset=await imageAsset(layer.image.dataUrl),placed=imagePlacement(layer.image,lw,lh,asset.width,asset.height),matrix=imageAffineTransform(layer.image,placed,asset.width,asset.height),pos=map({x:x+matrix.e,y:y+matrix.f});
        imageXml=`<Image Self="${id()}" ItemTransform="${num(matrix.a*scale)} ${num(matrix.b*scale)} ${num(matrix.c*scale)} ${num(matrix.d*scale)} ${pair(pos)}" ActualPpi="72 72" Space="$ID/#Links_RGB" ImageTypeName="$ID/${asset.mime==="image/jpeg"?"JPEG":"PNG"}" AppliedObjectStyle="ObjectStyle/$ID/[None]"><Properties><Profile type="string">$ID/None</Profile><GraphicBounds Left="0" Top="0" Right="${asset.width}" Bottom="${asset.height}"/></Properties><Link Self="${id()}" LinkResourceURI="file:${asset.name}" LinkResourceFormat="$ID/${asset.mime==="image/jpeg"?"JPEG":"PNG"}" StoredState="Normal" LinkResourceModified="false" LinkObjectModified="false" ShowInUI="true" CanEmbed="true" CanUnembed="true" CanPackage="true" ImportPolicy="NoAutoImport" ExportPolicy="NoAutoExport"/></Image>`;
      }
      items.push(shape(transformPaths([clip],map),foreground?"cbForeground":background?"cbBackground":"cbImages",`Image frame ${layer.id}`,foreground?"none":"#fffdf7","none",0,"",imageXml));
      if(!full) {
        const border=panelBorderStyle(project,layer);
        if(border.visible&&border.thicknessPt>0&&visibleShapeEdges(panelShapePoints(layer),layer.hiddenShapeEdges).length>0) {
          const outline=panelOutline(page,layer,sourceFormat);
          if(border.style==="hand-drawn"&&(border.roughness??50)>0)items.push(shape(transformPaths(svgGeometry(handDrawnBorderPath(outline,panelBorderWidth(project,layer),border.roughness??50,layer.id,layer.hiddenShapeEdges)),map),"cbFrames",`Panel border ${layer.id}`,border.color));
          else items.push(shape(transformPaths(layer.hiddenShapeEdges?.length?visibleShapeEdges(outline,layer.hiddenShapeEdges).map(({a,b})=>polygonPath([a,b],true)):[polygonPath(outline)],map),"cbFrames",`Panel border ${layer.id}`,"none",border.color,border.thicknessPt*scale/(pageDimensions(sourceFormat).widthMm*72/25.4/700)));
        }
      }
      const connected=bubbleGroups(layer.overlays);
      for(const group of connected){
        const o=group[0],geometry=connectedBubbleGeometry(group,{width:lw,height:lh,pageWidthMm:pageDimensions(sourceFormat).widthMm});
        const local=(p:Point)=>map({x:x+p.x*lw/100,y:y+p.y*lh/100});
        const name=`Connected bubbles ${group.map(o=>o.id).join(" ")}`,itemLayer=bubbleLayer;
        items.push(shape(transformPaths(svgGeometry(geometry.fillPath),local),itemLayer,name,o.fillColor??"#fffdf7","none",0,"",`<FillTransparencySetting><BlendingSetting Opacity="${num(Math.max(0,Math.min(1,o.fillOpacity??1))*100)}" BlendMode="Normal"/></FillTransparencySetting>`));
        items.push(shape(transformPaths(svgGeometry(geometry.strokePath),local),itemLayer,`${name} outline`,"none",o.strokeColor??"#171411",(o.strokeWidth??2)*scale,o.bubbleStyle==="whisper"?'StrokeType="StrokeStyle/$ID/Dashed"':""));
      }
      for(const o of layer.overlays) {
        const a=o.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
        const local=(p:Point)=>{const ux=p.x-o.width/2,uy=p.y-o.height/2;return map({x:x+(o.x+o.width/2+c*ux-s*uy)*lw/100,y:y+(o.y+o.height/2+s*ux+c*uy)*lh/100});};
        const fill=o.fillColor??"#fffdf7",stroke=o.strokeColor??"#171411",opacity=Math.max(0,Math.min(1,o.fillOpacity??1));
        for(const primitive of connected.some(g=>g.some(b=>b.id===o.id))?[]:artwork(o))items.push(shape(transformPaths(primitive.paths,local),bubbleLayer,`${o.type} ${o.id}`,primitive.fill?fill:"none",stroke,(o.strokeWidth??2)*scale,o.bubbleStyle==="whisper"?'StrokeType="StrokeStyle/$ID/Dashed"':"",`<FillTransparencySetting><BlendingSetting Opacity="${num(opacity*100)}" BlendMode="Normal"/></FillTransparencySetting>`));
        if(o.type==="sfx"&&o.sfxTextHidden)continue;
        if(o.bubbleShapePoints&&o.type!=="sfx") {
          const layout=richTextLayout(o,{width:lw,height:lh,pageWidthMm:pageDimensions(sourceFormat).widthMm});
          const frame=(name:string,start:number,end:number,left:number,top:number,frameWidth:number,frameHeight:number,baseline:number,hidden=false)=>{
            const story=id(),storyPath=`Stories/Story_${story}.xml`;
            const pieces=textPieces(o,start,end);
            const content=pieces.map(piece=>{
              const styled={...o,...Object.fromEntries(Object.entries(piece.style).filter(([,v])=>v!==undefined))},font=idmlFont(styled);
              fonts.set(`${font.family}/${font.style}`,font);
              const fontSize=(styled.fontSize??8)*25.4/72*700/pageDimensions(sourceFormat).widthMm*scale;
              return `<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]" PointSize="${num(fontSize)}" FontStyle="${xml(font.style)}" FillColor="${color(styled.textColor??"#171411")}"><Properties><AppliedFont type="string">${xml(font.family)}</AppliedFont><Leading type="unit">${num(frameHeight*scale)}</Leading></Properties><Content>${xml(piece.text)}</Content></CharacterStyleRange>`;
            }).join("");
            add(storyPath,part("Story",`<Story Self="${story}"><StoryPreference StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection"/><ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/ComicBook" Justification="LeftAlign" Hyphenation="false" SpaceBefore="0" SpaceAfter="0">${content}</ParagraphStyleRange></Story>`));stories.push(storyPath);
            const cx=layout.width/2,cy=layout.height/2,px=left-cx,py=top-cy,pos=map({x:x+o.x*lw/100+cx+c*px-s*py,y:y+o.y*lh/100+cy+s*px+c*py});
            items.push(`<TextFrame Self="${id()}" Name="${xml(name)}" ParentStory="${story}" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" ItemLayer="${textLayer}" ItemTransform="${num(c)} ${num(s)} ${num(-s)} ${num(c)} ${pair(pos)}" FillColor="Swatch/None" StrokeColor="Swatch/None" Visible="${!hidden}" AppliedObjectStyle="ObjectStyle/$ID/[None]"><Properties>${idmlPathGeometry([rectanglePath(0,0,Math.max(.1,frameWidth)*scale,Math.max(.1,frameHeight)*scale)])}</Properties><TextFramePreference TextColumnCount="1" VerticalJustification="TopAlign" FirstBaselineOffset="FixedHeight" FirstBaselineFixed="${num(baseline*scale)}"><Properties><InsetSpacing type="list">${[0,0,0,0].map(()=>'<ListItem type="unit">0</ListItem>').join("")}</InsetSpacing></Properties></TextFramePreference></TextFrame>`);
          };
          layout.rows.forEach((row,i)=>{if(row.start===row.end)return;const left=row.runs[0]?.x??0;frame(`Text ${o.id} line ${i+1}`,row.start,row.end,left,row.y-row.size*.85,row.lineWidth+.01,row.lineHeight,row.size*.85);});
          if(layout.overflow)frame(`Overflow text ${o.id}`,layout.overflowStart,o.text.length,0,0,layout.width,layout.height,8,true);
          continue;
        }
        const font=idmlFont(o);fonts.set(`${font.family}/${font.style}`,font);
        const story=id(),storyPath=`Stories/Story_${story}.xml`,padding=o.width*lw/100*Math.max(0,Math.min(25,o.textPadding??4))/100*scale;
        const tw=o.width*lw/100*scale,th=o.height*lh/100*scale,size=(o.fontSize??(o.type==="sfx"?28:8))*scale/(pageDimensions(sourceFormat).widthMm*72/25.4/700);
        const pos=map({x:x+o.x*lw/100,y:y+o.y*lh/100}),cx=tw/2,cy=th/2;
        // Text rotates in physical page coordinates, matching pageTypography's un-stretched text.
        const matrix=`${num(c)} ${num(s)} ${num(-s)} ${num(c)} ${num(pos.x+cx-c*cx+s*cy)} ${num(pos.y+cy-s*cx-c*cy)}`;
        const justification=o.textAlign==="left"?"LeftAlign":o.textAlign==="right"?"RightAlign":"CenterAlign";
        const plainParagraphs=o.text.replace(/\r\n?/g,"\n").split("\n").map(line=>`<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/ComicBook" Justification="${justification}" Hyphenation="false" SpaceBefore="0" SpaceAfter="0"><CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]" PointSize="${num(size)}" FontStyle="${xml(font.style)}" FillColor="${color(o.textColor??o.sfxTextColor??"#171411")}"${o.type==="sfx"?` StrokeColor="${color("#fffdf7")}" StrokeWeight="${num(3*scale)}"`:""}><Properties><AppliedFont type="string">${xml(font.family)}</AppliedFont><Leading type="unit">${num(size*1.15)}</Leading></Properties><Content>${xml(line)}</Content><Br/></CharacterStyleRange></ParagraphStyleRange>`).join("");
        let textOffset=0;
        const richParagraphs=o.textStyles?.length?o.text.split("\n").map(line=>{
          const parts=textPieces(o,textOffset,textOffset+line.length);textOffset+=line.length+1;
          if(!parts.length)parts.push({text:"",style:{},start:0,end:0});
          const content=parts.map((piece,i)=>{
            const styled={...o,...Object.fromEntries(Object.entries(piece.style).filter(([,v])=>v!==undefined))},partFont=idmlFont(styled);
            fonts.set(`${partFont.family}/${partFont.style}`,partFont);
            const partSize=(styled.fontSize??(o.type==="sfx"?28:8))*scale/(pageDimensions(sourceFormat).widthMm*72/25.4/700);
            return `<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]" PointSize="${num(partSize)}" FontStyle="${xml(partFont.style)}" FillColor="${color(styled.textColor??o.sfxTextColor??"#171411")}"${o.type==="sfx"?` StrokeColor="${color("#fffdf7")}" StrokeWeight="${num(3*scale)}"`:""}><Properties><AppliedFont type="string">${xml(partFont.family)}</AppliedFont><Leading type="unit">${num(partSize*1.15)}</Leading></Properties><Content>${xml(piece.text.replace(/\r/g,""))}</Content>${i===parts.length-1?"<Br/>":""}</CharacterStyleRange>`;
          }).join("");
          return `<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/ComicBook" Justification="${justification}" Hyphenation="false" SpaceBefore="0" SpaceAfter="0">${content}</ParagraphStyleRange>`;
        }).join(""):undefined;
        const paragraphs=richParagraphs??plainParagraphs;
        add(storyPath,part("Story",`<Story Self="${story}"><StoryPreference StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection"/>${paragraphs}</Story>`));stories.push(storyPath);
        items.push(`<TextFrame Self="${id()}" Name="${xml(`Text ${o.id}`)}" ParentStory="${story}" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" ItemLayer="${textLayer}" ItemTransform="${matrix}" FillColor="Swatch/None" StrokeColor="Swatch/None" AppliedObjectStyle="ObjectStyle/$ID/[None]"><Properties>${idmlPathGeometry([rectanglePath(0,0,tw,th)])}</Properties><TextFramePreference TextColumnCount="1" VerticalJustification="CenterAlign" FirstBaselineOffset="AscentOffset"><Properties><InsetSpacing type="list"><ListItem type="unit">0</ListItem><ListItem type="unit">${num(padding)}</ListItem><ListItem type="unit">0</ListItem><ListItem type="unit">${num(padding)}</ListItem></InsetSpacing></Properties></TextFramePreference></TextFrame>`);
      }
    }
    const spread=id(),spreadPath=`Spreads/Spread_${spread}.xml`;
    add(spreadPath,part("Spread",`<Spread Self="${spread}" PageCount="1" BindingLocation="0" AllowPageShuffle="false" ItemTransform="1 0 0 1 0 0"><Page Self="${id()}" Name="${page.number}" GeometricBounds="0 0 ${num(h)} ${num(w)}" ItemTransform="1 0 0 1 0 0" AppliedMaster="n"><MarginPreference Top="${num(Math.max(0,dy+gridMetrics.top*scale))}" Bottom="${num(Math.max(0,dy+gridMetrics.bottom*scale))}" Left="${num(Math.max(0,dx+gridMetrics.left*scale))}" Right="${num(Math.max(0,dx+gridMetrics.right*scale))}" ColumnCount="1" ColumnGutter="0"/></Page>${items.join("")}</Spread>`));spreads.push(spreadPath);
    onProgress(index+1,pages.length);await new Promise(resolve=>setTimeout(resolve,0));
  }
  add("Resources/Graphic.xml",part("Graphic",`<Swatch Self="Swatch/None" Name="$ID/None" ColorEditable="false" ColorRemovable="false"/>${[...colors].map(([hex,self])=>`<Color Self="${self}" Name="CB ${hex}" Model="Process" Space="RGB" ColorValue="${[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(" ")}"/>`).join("")}<StrokeStyle Self="StrokeStyle/$ID/Solid" Name="$ID/Solid"/><StrokeStyle Self="StrokeStyle/$ID/Dashed" Name="$ID/Dashed"/>`));
  add("Resources/Styles.xml",part("Styles",'<RootCharacterStyleGroup Self="cbCharacterStyles"><CharacterStyle Self="CharacterStyle/$ID/[No character style]" Name="$ID/[No character style]"/></RootCharacterStyleGroup><RootParagraphStyleGroup Self="cbParagraphStyles"><ParagraphStyle Self="ParagraphStyle/ComicBook" Name="ComicBook" PointSize="8" Hyphenation="false"/></RootParagraphStyleGroup><RootObjectStyleGroup Self="cbObjectStyles"><ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]"/></RootObjectStyleGroup>'));
  const families=[...new Set([...fonts.values()].map(f=>f.family))];
  add("Resources/Fonts.xml",part("Fonts",families.map((family,i)=>`<FontFamily Self="cbFontFamily${i}" Name="${xml(family)}">${[...fonts.values()].filter(f=>f.family===family).map((f,j)=>`<Font Self="cbFont${i}_${j}" FontFamily="${xml(family)}" Name="${xml(`${family} ${f.style}`)}" FontStyleName="${xml(f.style)}"/>`).join("")}</FontFamily>`).join("")));
  add("Resources/Preferences.xml",part("Preferences",`<DocumentPreference PageWidth="${num(w)}" PageHeight="${num(h)}" PagesPerDocument="${pages.length}" FacingPages="false" Intent="PrintIntent" AllowPageShuffle="false"/><ViewPreference HorizontalMeasurementUnits="Points" VerticalMeasurementUnits="Points"/>`));
  add("META-INF/container.xml",`${declaration}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="designmap.xml" media-type="text/xml"/></rootfiles></container>`);
  const layerXml=layers.map(l=>`<Layer Self="${l.id}" Name="${l.name}" Visible="true" Locked="false" Printable="true" IgnoreWrap="true"/>`).join("");
  const references=["Graphic","Fonts","Styles","Preferences"].map(p=>`<idPkg:${p} src="Resources/${p}.xml"/>`).join("");
  add("designmap.xml",`${declaration}<?aid style="50" type="document" readerVersion="6.0" featureSet="257"?><Document xmlns:idPkg="${NS}" DOMVersion="8.0" Self="d" ActiveLayer="cbText" ZeroPoint="0 0" StoryList="${stories.map(p=>p.match(/Story_(.+)\.xml/)![1]).join(" ")}">${references}${layerXml}${spreads.map(p=>`<idPkg:Spread src="${p}"/>`).join("")}${stories.map(p=>`<idPkg:Story src="${p}"/>`).join("")}</Document>`);
  // OCF requires mimetype first, uncompressed and without an extra field.
  const idml=imageArchive([{name:"mimetype",bytes:encode("application/vnd.adobe.indesign-idml-package")},...files]);check(signal);
  const base=exportFilename(project.title);
  const readme=`ComicBook AI — IDML export (experimental)\n\n1. Extract the entire ZIP before opening ${base}.idml in InDesign or Affinity Publisher.\n2. Keep Links next to the IDML. If asked for missing images, select the Links folder.\n3. Install the fonts listed below or replace them in the destination application.\n4. Check text wrapping, overflow, layer order and page edges before production.\n\nLayers: Text; Bubbles and SFX; Panel borders; Images; Background.\nImages remain raster images, with editable clipping frames and placement. Bubble contours and tails are vector paths. Text remains editable. Custom bubble text uses positioned editable line frames to preserve contour wrapping. If text does not fit, its remainder is retained in a hidden frame named Overflow text. No font files are embedded.\n\nCurrent limitations: destination font metrics can change wrapping; text weights use available Regular/Bold desktop styles; text and bubble artwork extending beyond a panel are not clipped to its outline; page-edge crop should be checked when using Cover.\nAffinity import is one-way: save subsequent work in Affinity's own format.\n\nFonts:\n${[...fonts.values()].map(f=>`${f.family} — ${f.style}`).join("\n")||"None"}\n`;
  return {blob:imageArchive([{name:`${base}.idml`,bytes:new Uint8Array(await idml.arrayBuffer())},...assets,{name:"README.txt",bytes:encode(readme)}]),name:`${base}-idml.zip`};
}


