import { useState } from "react";
import { AI_MODES, type AiMode } from "./ai";

export function App() {
  const [guideOpen, setGuideOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);
  const [aiMode, setAiMode] = useState<AiMode>("prompt");

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" aria-label="Gå till startsidan">
          <span className="brand-mark" aria-hidden="true">CB</span>
          <span>ComicBook AI</span>
        </button>
        <button className="text-button" type="button" onClick={() => setGuideOpen(true)}>
          Guide
        </button>
      </header>

      <main className="home">
        <header className="home-brand">
          <p className="eyebrow">COMIC CREATION WORKSPACE</p>
          <div className="home-heading-row">
            <div>
              <h1>Från berättelse<br />till seriealbum.</h1>
              <p className="lede">
                Planera bildrutor, bygg konsekventa bildprompter och skapa din serie utan att låsa projektet till en viss AI-tjänst.
              </p>
            </div>
            <button className="home-guide-button" type="button" onClick={() => setGuideOpen(true)}>
              Öppna Guide
            </button>
          </div>
        </header>

        <section className="home-connect" aria-label="AI-inställningar">
          <button
            type="button"
            className="home-connect-toggle"
            aria-expanded={aiOpen}
            onClick={() => setAiOpen((open) => !open)}
          >
            <span className="chevron" aria-hidden="true">{aiOpen ? "▾" : "▸"}</span>
            <h2>AI-inställningar</h2>
          </button>
          <p className="quiet">Välj hur ComicBook AI ska arbeta med bildgenerering.</p>

          {aiOpen ? (
            <div className="ai-options" role="radiogroup" aria-label="AI-läge">
              {AI_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={aiMode === mode.id ? "ai-option is-selected" : "ai-option"}
                  disabled={!mode.available}
                  aria-pressed={aiMode === mode.id}
                  onClick={() => mode.available && setAiMode(mode.id)}
                >
                  <span>
                    <strong>{mode.label}</strong>
                    {!mode.available ? <small>Kommer senare</small> : null}
                  </span>
                  <span>{mode.description}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="workspace-card">
          <p className="eyebrow">NÄSTA STEG</p>
          <h2>Dina serieprojekt kommer att bo här.</h2>
          <p className="quiet">
            Projektflöde, StoryBook-import och själva serieskapandet bygger vi vidare på härnäst.
          </p>
        </section>
      </main>

      {guideOpen ? (
        <div className="overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setGuideOpen(false);
        }}>
          <article className="guide-card" role="dialog" aria-modal="true" aria-labelledby="guide-title">
            <div className="guide-actions">
              <button className="text-button" type="button" onClick={() => setGuideOpen(false)}>Stäng</button>
            </div>
            <p className="eyebrow">GUIDE</p>
            <h1 id="guide-title">ComicBook AI Guide</h1>
            <p className="lede">Guiden skriver vi senare. Den här platsen är förberedd för den.</p>
          </article>
        </div>
      ) : null}
    </div>
  );
}