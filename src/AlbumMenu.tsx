import { parseOrganization, type StyleOrganization } from "./styleOrganization";
import { PanelBorderControls } from "./PanelBorderControls";
import { albumPanelBorder } from "./panelBorder";
import { AlbumExportPanel } from "./AlbumExportPanel";
import { PageSpacingEditor } from "./PageSpacingEditor";
import { PageFormatEditor } from "./PageFormatEditor";
import { albumPageFormat, spacingFitsAlbum } from "./pageFormat";
import { useEffect, useRef, useState } from "react";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import { ColorModeSelect } from "./ColorModeSelect";
import { renderOptionsForStyle } from "./styleColorMode";
import { albumStyleModules, styleGroupLabel, type IllustrationStyle } from "./stylesLibrary";
import { OverlayDefaultsEditor } from "./OverlayDefaultsEditor";
import {
  albumBackupFilename,
  packAlbumBackup,
  parseAlbumBackup,
} from "./albumBackup";
import "./AlbumMenu.css";
import { uiText } from "./i18n";
export type AlbumTool = "settings" | "backup" | "export" | null;
export type AlbumSection = "manus" | "adaptation" | "characters" | "locations" | "scenes" | "pages";
export function AlbumMenu({
  project,
  locale,
  mode,
  onMode,
  onUpdate,
  onRestore,
  styles,
  onClose,
  saveError,
  saving,
  onRetrySave,
  section,
  onSection,
}: {
  project: ComicProject | null;
  locale: Locale;
  mode: AlbumTool;
  onMode: (mode: AlbumTool) => void;
  onUpdate: (update: (p: ComicProject) => ComicProject) => void;
  onRestore: (p: ComicProject, organization?: StyleOrganization) => void | Promise<void>;
  styles: IllustrationStyle[];
  onClose: () => void;
  saveError?: string;
  saving?: boolean;
  onRetrySave?: () => void;
  section: AlbumSection;
  onSection: (section: AlbumSection) => void;
}) {
  const sv = locale === "sv";
  const [previewOrganization, setPreviewOrganization] = useState<StyleOrganization>();
  const [preview, setPreview] = useState<ComicProject | null>(null),
    [error, setError] = useState(""),
    [download, setDownload] = useState(""), [layoutError, setLayoutError] = useState(false);
  const request = useRef(0),
    dialog = useRef<HTMLElement>(null),
    lastFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    request.current++;
    setPreview(null);
    setPreviewOrganization(undefined);
    setError("");
    setDownload("");
    setLayoutError(false);
  }, [mode, project?.id]);
  useEffect(() => {
    if (!mode) return;
    lastFocus.current = document.activeElement as HTMLElement;
    dialog.current?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMode(null);
      if (e.key === "Tab") {
        const controls = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary",
          ) ?? [],
        ).filter(
          (el) =>
            !el.closest("details:not([open])") ||
            (el.tagName === "SUMMARY" &&
              el.parentElement === el.closest("details:not([open])")),
        );
        const first = controls[0],
          last = controls.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      lastFocus.current?.focus();
    };
  }, [mode]);
  function backup() {
    if (!project) return;
    try {
      const date = new Date().toISOString(),
        filename = albumBackupFilename(project, date),
        blob = new Blob(
          [JSON.stringify(packAlbumBackup(project, date), null, 2)],
          { type: "application/json" },
        ),
        url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownload(filename);
      setError("");
    } catch {
      setError(
        sv
          ? "Backupen kunde inte skapas. Försök igen."
          : "Could not create backup. Try again.",
      );
    }
  }
  async function read(file: File) {
    const current = ++request.current;
    setPreview(null);
    setPreviewOrganization(undefined);
    setError("");
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
      const raw = JSON.parse(text);
      const value = parseAlbumBackup(raw);
      const organization = raw.styleOrganization === undefined ? undefined : parseOrganization(raw.styleOrganization);
      if (current === request.current) setPreviewOrganization(organization);
      if (current === request.current) setPreview(value);
    } catch (err) {
      if (current !== request.current) return;
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "unsupported-backup"
          ? sv
            ? "Backupformatet stöds inte av denna version."
            : "This backup format is not supported."
          : sv
            ? "Filen är inte en giltig ComicBook-albumbackup."
            : "This file is not a valid ComicBook album backup.",
      );
    }
  }
  return (
    <>
      {project && (
        <nav
          className="project-topbar album-topbar"
          aria-label={sv ? "Albummeny" : "Album menu"}
        >
          <button
            className="project-title-button"
            onClick={() => onMode("settings")}
          >
            {project.title}
          </button>
          <span className="album-stats">
            {project.pages.length} {sv ? "sidor" : "pages"} ·{" "}
            {project.panels.length} {sv ? "rutor" : "panels"}
          </span>
          <div className="album-section-nav" role="group" aria-label={uiText(locale,"projectContent")}>
            {([ ["manus","manuscript"], ["adaptation","adaptation"], ["characters","characters"], ["locations","locations"], ["scenes","panels"], ["pages","pages"] ] as const).map(([value,label]) =>
              <button key={value} type="button" className={section===value?"is-active":""} aria-current={section===value?"page":undefined} onClick={()=>onSection(value)}>{uiText(locale,label)}</button>
            )}
          </div>
          <span className="project-topbar-spacer" />
          <button onClick={() => onMode("settings")}>
            {sv ? "Albuminställningar" : "Album settings"}
          </button>
          <button onClick={() => onMode("export")}>{sv ? "Exportera" : "Export"}</button>
          <button onClick={() => onMode("backup")}>Backup</button>
          <button onClick={() => onMode("backup")}>
            {sv ? "Återställ backup" : "Restore backup"}
          </button>
          <button onClick={onClose}>
            {sv ? "Stäng album" : "Close album"}
          </button>
        </nav>
      )}
      {mode && (
        <div
          className="album-dialog-backdrop"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onMode(null);
          }}
        >
          <section
            className="album-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="album-dialog-title"
            tabIndex={-1}
            ref={dialog}
          >
            <header>
              <h2 id="album-dialog-title">
                {mode === "settings"
                  ? sv
                    ? "Albuminställningar"
                    : "Album settings"
                  : mode === "export" ? (sv ? "Exportera" : "Export") : "Backup"}
              </h2>
              <button className="text-button" onClick={() => onMode(null)}>
                {sv ? "Stäng" : "Close"}
              </button>
            </header>
            {mode === "settings" && project ? (
              <>
                <label>
                  {sv ? "Albumtitel" : "Album title"}
                  <input
                    value={project.title}
                    onChange={(e) =>
                      onUpdate((p) => ({ ...p, title: e.target.value }))
                    }
                  />
                </label>
                <label>
                  {sv ? "Bildstil" : "Image style"}
                  <select
                    value={project.style.id}
                    onChange={(e) => {
                      const style = styles.find((s) => s.id === e.target.value);
                      if (style)
                        onUpdate((p) => ({ ...p, style: { ...style }, promptStyle: undefined, renderOptions: renderOptionsForStyle(style, p.renderOptions) }));
                    }}
                  >
                    {[
                      project.style,
                      ...styles.filter((s) => s.id !== project.style.id),
                    ].map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <ColorModeSelect style={project.style} options={project.renderOptions} locale={locale} onChange={renderOptions => onUpdate(p => ({ ...p, renderOptions }))} />
                <details className="album-prompt-style">
                  <summary>{sv ? "Avancerad albumstil för bildprompter" : "Advanced album style for image prompts"}</summary>
                  <p className="quiet">{sv ? "Gäller nya och omskapade bildprompter i albumet. Sparade prompter ändras inte automatiskt. Färg och skuggning används i färgläget." : "Applies to new and regenerated image prompts in this album. Saved prompts are not automatically changed. Color and shading apply in color mode."}</p>
                  {(["medium", "lines", "color", "texture"] as const).map((key, i) => <label key={key}>
                    {(sv ? ["Konstform & medium", "Linjer & former", "Färg & skuggning", "Ytstruktur & finish"] : ["Art form & medium", "Lines & form", "Color & shading", "Texture & finish"])[i]}
                    <textarea rows={key === "medium" ? 4 : 2} value={(project.promptStyle ?? albumStyleModules(project.style))[key]} onChange={e => onUpdate(p => ({ ...p, promptStyle: { ...albumStyleModules(p.style), ...p.promptStyle, [key]: e.target.value } }))} />
                  </label>)}
                  <button type="button" className="text-button" onClick={() => onUpdate(p => ({ ...p, promptStyle: undefined }))}>{sv ? "Använd stilens standard" : "Use style defaults"}</button>
                </details>
                <fieldset>
                  <legend>
                    {sv ? "Rutnät för nya sidor" : "Grid for new pages"}
                  </legend>
                  {(["gridColumns", "gridRows"] as const).map((key, i) => (
                    <label key={key}>
                      {(sv ? ["Kolumner", "Rader"] : ["Columns", "Rows"])[i]}
                      <input
                        type="number"
                        min="2"
                        max={i ? 8 : 6}
                        value={project.pageDefaults[key]}
                        onChange={(e) => {
                          const value = e.currentTarget.valueAsNumber;
                          if (!Number.isFinite(value)) return;
                          const pageDefaults = { ...project.pageDefaults, [key]: Math.max(2, Math.min(i ? 8 : 6, Math.round(value))) };
                          if (!spacingFitsAlbum(albumPageFormat(project), [...project.pages, pageDefaults])) { setLayoutError(true); return; }
                          setLayoutError(false); onUpdate(p => ({ ...p, pageDefaults }));
                        }}
                      />
                    </label>
                  ))}
                </fieldset>
                <PageFormatEditor value={albumPageFormat(project)} locale={locale} onChange={pageFormat => {
                  if (!spacingFitsAlbum(pageFormat, [...project.pages, project.pageDefaults])) { setLayoutError(true); return; }
                  setLayoutError(false); onUpdate(p => ({...p,pageFormat}));
                }}/>
                {layoutError?<p role="alert">{sv ? "Sidformatet eller rutnätet lämnar inte plats för marginaler och bildrutor. Minska marginalerna eller mellanrummen först." : "The page size or grid leaves no room for margins and panels. Reduce margins or spacing first."}</p>:null}
                <PageSpacingEditor format={albumPageFormat(project)} grids={[...project.pages, project.pageDefaults]} locale={locale} onChange={spacing => { setLayoutError(false); onUpdate(p => ({...p,pageFormat:{...albumPageFormat(p),spacing}})); }}/>

                <p className="quiet">{sv ? "Sidformatet gäller alla sidor. Ändrade proportioner påverkar beskärningen av befintliga bilder." : "The format applies to all pages. Changing proportions affects cropping of existing images."}</p>
                <PanelBorderControls value={albumPanelBorder(project)} locale={locale} onChange={panelBorderDefaults=>onUpdate(p=>({...p,panelBorderDefaults}))}/>
                <OverlayDefaultsEditor
                  project={project}
                  locale={locale}
                  onChange={(type, value) =>
                    onUpdate((p) => ({
                      ...p,
                      overlayDefaults: { ...p.overlayDefaults, [type]: value },
                    }))
                  }
                />
                {!saveError ? <p className="quiet" role="status">
                  {saving ? (sv ? "Sparar albumet…" : locale === "nb" ? "Lagrer albumet…" : "Saving album…") : (sv ? "Ändringar sparas automatiskt i albumet." : "Changes are saved automatically in this album.")}
                </p> : null}
              </>
            ) : null}
            {mode === "export" && project ? <AlbumExportPanel key={project.id} project={project} locale={locale}/> : null}
            {mode === "backup" && (
              <>
                {project && (
                  <section>
                    <h3>{sv ? "Säkerhetskopiera album" : "Back up album"}</h3>
                    <p>
                      {sv
                        ? "Hela albumet, med manus, bilder, bildhistorik, sidor, textlager och albuminställningar, sparas i en fil."
                        : "Save the whole album, including manuscript, images, image history, pages, text layers and album settings, in one file."}
                    </p>
                    <button className="primary-button" onClick={backup}>
                      {sv ? "Ladda ner albumbackup" : "Download album backup"}
                    </button>
                    {download && (
                      <p role="status">
                        {sv ? "Backupfil skapad" : "Backup file created"}:{" "}
                        {download}
                      </p>
                    )}
                  </section>
                )}
                <section>
                  <h3>{sv ? "Återställ backup" : "Restore backup"}</h3>
                  <p className="quiet">
                    {sv
                      ? "Backupen öppnas som ett separat album. Dina befintliga album finns kvar."
                      : "The backup opens as a separate album. Your existing albums remain available."}
                  </p>
                  <label>
                    {sv ? "Välj albumbackup" : "Choose album backup"}
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void read(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {preview && (
                    <div className="album-backup-preview">
                      <strong>{preview.title}</strong>
                      {previewOrganization ? <p>{sv ? "Egna taggar och favoriter läggs till i ditt stilbibliotek." : "Personal tags and favorites will be added to your style library."}</p> : null}
                      <p>
                        {preview.pages.length} {sv ? "sidor" : "pages"} ·{" "}
                        {preview.panels.length} {sv ? "rutor" : "panels"}
                      </p>
                      <button
                        className="primary-button"
                        disabled={saving}
                        onClick={async () => {
                          try {
                            await onRestore(preview, previewOrganization);
                            onMode(null);
                          } catch (err) {
                            setError(
                              err instanceof Error ? err.message : String(err),
                            );
                          }
                        }}
                      >
                        {sv ? "Öppna som nytt album" : "Open as new album"}
                      </button>
                    </div>
                  )}
                </section>
              </>
            )}
            {saveError && (
              <div role="alert" className="import-error">
                <p>{saveError}</p>
                {onRetrySave ? <button className="text-button" type="button" onClick={onRetrySave}>{sv ? "Försök spara igen" : locale === "nb" ? "Prøv å lagre igjen" : "Retry save"}</button> : null}
              </div>
            )}
            {error && (
              <p role="alert" className="import-error">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}



