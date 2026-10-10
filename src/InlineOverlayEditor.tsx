import { useEffect, useLayoutEffect, useRef } from "react";
import type { TextOverlay } from "./project";
import { overlayTextLayout, type LayerTextMetrics } from "./pageTypography";
import { textPieces, deletionRange, type TextEditRange } from "./richText";

export function selectionOffsets(root:HTMLElement):[number,number]|null {
  const selection=window.getSelection();if(!selection?.rangeCount)return null;
  const range=selection.getRangeAt(0);if(!root.contains(range.startContainer)||!root.contains(range.endContainer))return null;
  const before=range.cloneRange();before.selectNodeContents(root);before.setEnd(range.startContainer,range.startOffset);
  const start=before.toString().length;return [start,start+range.toString().length];
}
function restoreSelection(root:HTMLElement,start:number,end:number){
  const walker=document.createTreeWalker(root,root.ownerDocument.defaultView!.NodeFilter.SHOW_TEXT);let offset=0;
  const nodes:{node:Node;start:number;end:number}[]=[];
  while(walker.nextNode()){const node=walker.currentNode;nodes.push({node,start:offset,end:offset+(node.textContent?.length??0)});offset=nodes.at(-1)!.end;}
  if(!nodes.length)return;
  const position=(index:number)=>{const p=nodes.find(n=>n.end>=index)??nodes.at(-1)!;return {node:p.node,offset:Math.max(0,Math.min(p.end-p.start,index-p.start))};};
  const a=position(start),b=position(end),range=document.createRange();range.setStart(a.node,a.offset);range.setEnd(b.node,b.offset);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);
}
function RichInlineText({overlay,textMetrics,label,onChange,onSelection,onFinish,onCancel}:{overlay:TextOverlay;textMetrics:LayerTextMetrics;label:string;onChange:(text:string,edit?:TextEditRange)=>void;onSelection?:(start:number,end:number)=>void;onFinish:()=>void;onCancel:()=>void}){
  const ref=useRef<HTMLDivElement>(null),composing=useRef(false),editRange=useRef<TextEditRange|undefined>(undefined);
  const factor=25.4/72*700/textMetrics.pageWidthMm;
  useLayoutEffect(()=>{
    const root=ref.current;if(!root||composing.current)return;
    const selection=selectionOffsets(root),focused=document.activeElement===root;
    root.replaceChildren(...textPieces(overlay).map(piece=>{const span=document.createElement('span');span.textContent=piece.text;span.style.fontFamily=piece.style.fontFamily??overlay.fontFamily??(overlay.type==='sfx'?'Impact, sans-serif':'Comic Neue, sans-serif');span.style.fontSize=`${(piece.style.fontSize??overlay.fontSize??(overlay.type==='sfx'?28:8))*factor}px`;span.style.fontWeight=String(piece.style.fontWeight??overlay.fontWeight??(overlay.type==='sfx'?800:600));return span;}));
    if(focused&&selection)restoreSelection(root,...selection);
  },[overlay.text,overlay.textStyles,overlay.fontFamily,overlay.fontSize,overlay.fontWeight,factor]);
  useEffect(()=>{ref.current?.focus();},[overlay.id]);
  const select=()=>{const root=ref.current;if(!root)return;const offsets=selectionOffsets(root);if(offsets)onSelection?.(...offsets);};
  const input=()=>{onChange(ref.current?.textContent??'',editRange.current);editRange.current=undefined;select();};
  const insert=(text:string)=>{const root=ref.current,selection=window.getSelection();if(!root||!selection?.rangeCount)return;const range=selection.getRangeAt(0);if(!root.contains(range.commonAncestorContainer))return;const offsets=selectionOffsets(root);if(offsets)editRange.current={start:offsets[0],end:offsets[1]};range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);input();};
  return <div ref={ref} className="rich-inline-text" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={label} spellCheck={false} style={{textAlign:overlay.textAlign??'center',color:overlay.sfxTextColor??'#171411',fontSize:(overlay.fontSize??(overlay.type==='sfx'?28:8))*factor,lineHeight:1.15}} onInput={input} onMouseUp={select} onKeyUp={select} onBlur={onFinish} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;input();}} onPaste={event=>{event.preventDefault();insert(event.clipboardData.getData('text/plain').replace(/\r\n?/g,'\n'));}} onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onBeforeInput={()=>{const offsets=ref.current&&selectionOffsets(ref.current);if(offsets)editRange.current??={start:offsets[0],end:offsets[1]};}} onKeyDown={event=>{const offsets=ref.current&&selectionOffsets(ref.current);if(offsets)editRange.current=deletionRange(overlay.text,...offsets,event.key);event.stopPropagation();if(event.nativeEvent.isComposing)return;if(event.key==='Escape'){event.preventDefault();onCancel();}else if(event.key==='Enter'){event.preventDefault();insert('\n');}}}/>;
}

// Use SvgOverlay's physical text coordinates for the same scale and rotation.
export function InlineOverlayEditor({ overlay, textMetrics, label, onChange, onSelection, onFinish, onCancel }: {
  overlay: TextOverlay;
  textMetrics: LayerTextMetrics;
  label: string;
  onChange: (text: string,edit?:TextEditRange) => void;
  onSelection?: (start:number,end:number) => void;
  onFinish: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const editRange=useRef<TextEditRange|undefined>(undefined);
  const richMode=useRef(Boolean(overlay.textStyles?.length));
  if(overlay.textStyles?.length)richMode.current=true;
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
    const outside = (event: PointerEvent) => {
      if (!ref.current?.closest(".inline-overlay-editor")?.contains(event.target as Node)) finishRef.current();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [overlay.id]);
  const layout = overlayTextLayout(overlay, textMetrics);
  const padding = layout.width * Math.max(0, Math.min(25, overlay.textPadding ?? 4)) / 100;
  return <g className="inline-overlay-editor" transform={`translate(${overlay.x} ${overlay.y}) scale(${100 / textMetrics.width} ${100 / textMetrics.height}) rotate(${overlay.rotation} ${layout.width / 2} ${layout.height / 2})`}>
    <foreignObject width={layout.width} height={layout.height}>
      <div className="inline-overlay-editor-body" style={{ paddingInline: padding }} onPointerDown={event => event.stopPropagation()}>
        {richMode.current?<RichInlineText overlay={overlay} textMetrics={textMetrics} label={label} onChange={onChange} onSelection={onSelection} onFinish={onFinish} onCancel={onCancel}/>:<textarea
          ref={ref}
          aria-label={label}
          spellCheck={false}
          value={overlay.text}
          style={{
            fontFamily: overlay.fontFamily ?? (overlay.type === "sfx" ? "Impact, sans-serif" : "Comic Neue, sans-serif"),
            fontSize: layout.fontSize,
            fontWeight: overlay.fontWeight ?? (overlay.type === "sfx" ? 800 : 600),
            textAlign: overlay.textAlign ?? "center",
            color: overlay.sfxTextColor ?? "#171411",
            height: Math.max(1, layout.textLines.length) * layout.fontSize * 1.15,
          }}
          onBeforeInput={event=>{editRange.current??={start:event.currentTarget.selectionStart,end:event.currentTarget.selectionEnd};}} onPaste={event=>{editRange.current={start:event.currentTarget.selectionStart,end:event.currentTarget.selectionEnd};}}
          onChange={event => {onChange(event.target.value,editRange.current);editRange.current=undefined;}}
          onSelect={event=>onSelection?.(event.currentTarget.selectionStart,event.currentTarget.selectionEnd)}
          onBlur={onFinish}
          onPointerDown={event => event.stopPropagation()}
          onDoubleClick={event => event.stopPropagation()}
          onKeyDown={event => {
            editRange.current=deletionRange(overlay.text,event.currentTarget.selectionStart,event.currentTarget.selectionEnd,event.key);
            event.stopPropagation();
            if (event.key === "Escape" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onCancel();
            }
          }}
        />}
      </div>
    </foreignObject>
  </g>;
}
