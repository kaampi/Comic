import { useState } from "react";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import { libraryEntries } from "./comicPanelLibrary";
import "./PanelLibrary.css";

export function PanelLibrary({
  project,
  pageId,
  placementId,
  locale,
  onSelect,
  onAssign,
}: {
  project: ComicProject;
  pageId?: string;
  placementId?: string;
  locale: Locale;
  onSelect: (id: string) => void;
  onAssign: (panelId: string) => void;
}) {
  const [unplacedOnly, setUnplacedOnly] = useState(false);
  const sv = locale === "sv";
  const page = project.pages.find((p) => p.id === pageId);
  const target = page?.placements.find((p) => p.id === placementId);
  const entries = libraryEntries(project);
  const empty = !!target && !target.panelId && !target.adaptationPanelPlanId;
  return (
    <section
      className="panel-library"
      aria-label={sv ? "Rutbibliotek" : "Panel library"}
    >
      <h3>
        {sv ? "Rutbibliotek" : "Panel library"} <span>{entries.length}</span>
      </h3>
      <p className="quiet">
        {sv
          ? "Markera en tom bildruta på sidan och välj innehåll här."
          : "Select an empty frame on the page, then choose its content here."}
      </p>
      {page && (
        <label>
          {sv ? "Bildruta på sidan" : "Page frame"}
          <select
            aria-label={sv ? "Bildruta på sidan" : "Page frame"}
            value={target?.id ?? ""}
            onChange={(e) => onSelect(e.target.value)}
          >
            <option value="">{sv ? "Välj bildruta…" : "Choose frame…"}</option>
            {page.placements.map((p) => (
              <option key={p.id} value={p.id}>
                {sv ? "Ruta" : "Frame"} {p.readingOrder}
                {p.panelId || p.adaptationPanelPlanId
                  ? sv
                    ? " · placerad"
                    : " · filled"
                  : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="panel-library-filter">
        <input
          type="checkbox"
          checked={unplacedOnly}
          onChange={(e) => setUnplacedOnly(e.target.checked)}
        />
        {sv ? "Visa bara oplacerade" : "Show unplaced only"}
      </label>
      <div className="panel-library-list">
        {entries
          .filter((e) => !unplacedOnly || !e.pages.length)
          .map((entry) => (
            <button
              type="button"
              className="panel-library-card"
              data-panel-id={entry.panel.id}
              key={entry.panel.id}
              disabled={!empty || !!entry.pages.length}
              onClick={() => onAssign(entry.panel.id)}
            >
              {entry.image ? (
                <img src={entry.image.dataUrl} alt="" />
              ) : (
                <span className="panel-library-placeholder">
                  {sv ? "Ingen bild ännu" : "No image yet"}
                </span>
              )}
              <span className="panel-library-info">
                <strong>{entry.title}</strong>
                <small>
                  {entry.pages.length
                    ? entry.pages
                        .map((p) => `${sv ? "Sida" : "Page"} ${p.number}`)
                        .join(", ")
                    : sv
                      ? "Oplacerad"
                      : "Unplaced"}
                </small>
              </span>
            </button>
          ))}
      </div>
      {!entries.length && (
        <p className="quiet">
          {sv
            ? "Skapa rutor i manusvyn för att fylla biblioteket."
            : "Create panels in the manuscript to fill the library."}
        </p>
      )}
      {unplacedOnly &&
        entries.length > 0 &&
        entries.every((e) => e.pages.length) && (
          <p className="quiet">
            {sv ? "Alla rutor är placerade." : "All panels are placed."}
          </p>
        )}
    </section>
  );
}
