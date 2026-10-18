import type { ComicProject, PageLayer } from "./project";
import { albumPageFormat, pageAspect } from "./pageFormat";
import { panelOutline } from "./panelGeometry";

export function PanelMoveTarget({ project, page, layer, valid }: { project: ComicProject; page: ComicProject["pages"][number]; layer: PageLayer; valid: boolean }) {
  const format = albumPageFormat(project);
  const points = panelOutline(page, layer, format).map(p => `${p.x},${p.y}`).join(' ');
  return <svg className={`panel-move-target${valid ? '' : ' is-invalid'}`} aria-hidden="true" viewBox={`0 0 700 ${700 / pageAspect(format)}`} preserveAspectRatio="none"><polygon points={points}/></svg>;
}
