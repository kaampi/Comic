import type { Locale } from "./settings";

export function PageCanvasHeader({number,hasPrevious,hasNext,locale,onPrevious,onNext,onDelete,onNew}:{number:number;hasPrevious:boolean;hasNext:boolean;locale:Locale;onPrevious:()=>void;onNext:()=>void;onDelete:()=>void;onNew:()=>void}) {
  const sv=locale==="sv";
  return <header className="page-canvas-header">
    <button type="button" className="primary-button page-new-button" onClick={onNew}>{sv?"Ny sida":"New page"}</button>
    <div className="page-canvas-navigation">
      {hasPrevious?<button type="button" className="text-button" aria-label={sv?"Föregående sida":"Previous page"} onClick={onPrevious}>←</button>:<span className="page-canvas-arrow-space"/>}
      <h2>{sv?"Sid":"Page"} {number}</h2>
      {hasNext?<button type="button" className="text-button" aria-label={sv?"Nästa sida":"Next page"} onClick={onNext}>→</button>:<span className="page-canvas-arrow-space"/>}
    </div>
    <button type="button" className="text-button page-delete-button" aria-label={sv?"Radera sida":"Delete page"} title={sv?"Radera sida":"Delete page"} onClick={onDelete}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>
    </button>
  </header>;
}
