import type { AdaptationBeat } from "./adaptation/types";

const escapeHtml = (text: string) => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\r/g,'&#13;');
// Keep every original character in text nodes. Paragraph separators only gain
// a visual wrapper, so Range/textContent offsets still address the source.
export function manuscriptHtml(source: string, beats: AdaptationBeat[], selected: string | null, start=0, end=source.length): string {
  const boundaries=[...new Set([start,end,...beats.flatMap(beat=>beat.sourceStart===undefined||beat.sourceEnd===undefined?[]:[beat.sourceStart,beat.sourceEnd].filter(value=>value>=start&&value<=end))])].sort((a,b)=>a-b);
  const marked=(from:number,to:number)=>{
    const points=[from,...boundaries.filter(value=>value>from&&value<to),to];
    return points.slice(0,-1).map((a,i)=>{
      const b=points[i+1],owners=beats.filter(beat=>beat.sourceStart!==undefined&&beat.sourceEnd!==undefined&&beat.sourceStart<=a&&beat.sourceEnd>=b);
      const classes=owners.length?`manuscript-beat${owners.some(beat=>beat.id===selected)?' is-selected':''}${owners.some(beat=>beat.sourceNeedsReview)?' needs-review':''}`:'';
      return `<span${owners.length?` data-beat-ids="${escapeHtml(owners.map(beat=>beat.id).join(' '))}" class="${classes}"`:''}>${escapeHtml(source.slice(a,b))}</span>`;
    }).join('');
  };
  let cursor=start,html='';
  for(const match of source.slice(start,end).matchAll(/\r?\n(?:[ \t]*\r?\n)+/g)){
    const a=start+match.index!,b=a+match[0].length;
    html+=marked(cursor,a)+`<span class="manuscript-paragraph-break">${marked(a,b)}</span>`;cursor=b;
  }
  return html+marked(cursor,end);
}
