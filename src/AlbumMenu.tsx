import { useEffect, useRef, useState } from "react";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import type { IllustrationStyle } from "./stylesLibrary";
import { OverlayDefaultsEditor } from "./OverlayDefaultsEditor";
import {
  albumBackupFilename,
  packAlbumBackup,
  parseAlbumBackup,
} from "./albumBackup";
import "./AlbumMenu.css";
export type AlbumTool = "settings" | "backup" | null;
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
}: {
  project: ComicProject | null;
  locale: Locale;
  mode: AlbumTool;
  onMode: (mode: AlbumTool) => void;
  onUpdate: (update: (p: ComicProject) => ComicProject) => void;
  onRestore: (p: ComicProject) => void;
  styles: IllustrationStyle[];
  onClose: () => void;
  saveError?: string;
}) {
  const sv = locale === "sv";
  const [preview, setPreview] = useState<ComicProject | null>(null),
    [error, setError] = useState(""),
    [download, setDownload] = useState("");
  const request = useRef(0),
    dialog = useRef<HTMLElement>(null),
    lastFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    request.current++;
    setPreview(null);
    setError("");
    setDownload("");
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
            "button:not(:disabled),input:not(:disabled),select,textarea,summary",
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
    setError("");
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
      const value = parseAlbumBackup(JSON.parse(text));
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
          <span className="project-topbar-spacer" />
          <button onClick={() => onMode("settings")}>
            {sv ? "Albuminställningar" : "Album settings"}
          </button>
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
                  : "Backup"}
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
                        onUpdate((p) => ({ ...p, style: { ...style } }));
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
                <label className="album-check">
                  <input
                    type="checkbox"
                    checked={project.renderOptions.linesOnly}
                    onChange={(e) =>
                      onUpdate((p) => ({
                        ...p,
                        renderOptions: {
                          ...p.renderOptions,
                          linesOnly: e.target.checked,
                        },
                      }))
                    }
                  />
                  {sv
                    ? "Enbart linjer i bildprompter"
                    : "Lines only in image prompts"}
                </label>
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
                        onChange={(e) =>
                          onUpdate((p) => ({
                            ...p,
                            pageDefaults: {
                              ...p.pageDefaults,
                              [key]: Math.max(
                                2,
                                Math.min(
                                  i ? 8 : 6,
                                  Math.round(Number(e.target.value) || 2),
                                ),
                              ),
                            },
                          }))
                        }
                      />
                    </label>
                  ))}
                </fieldset>
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
                <p className="quiet">
                  {sv
                    ? "Ändringar sparas automatiskt i albumet."
                    : "Changes are saved automatically in this album."}
                </p>
              </>
            ) : null}
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
                      <p>
                        {preview.pages.length} {sv ? "sidor" : "pages"} ·{" "}
                        {preview.panels.length} {sv ? "rutor" : "panels"}
                      </p>
                      <button
                        className="primary-button"
                        onClick={() => {
                          try {
                            onRestore(preview);
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
              <p role="alert" className="import-error">
                {saveError}
              </p>
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
