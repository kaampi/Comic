import { useEffect, useRef, useState } from "react";
import { AI_MODES, type AiMode } from "./ai";
import { applyLocale, applyTheme, LOCALES, readLocale, readTheme, type Locale, type Theme } from "./settings";
import { BUILTIN_STYLES, STYLE_GENRES } from "./stylesLibrary";

type Panel = "styles" | "guide" | "settings" | null;

export function App() {
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [aiMode, setAiMode] = useState<AiMode>("prompt");
  const [locale, setLocale] = useState<Locale>(readLocale);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [styleGenre, setStyleGenre] = useState("Alla");
  const [styleQuery, setStyleQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { applyLocale(locale); }, [locale]);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    if (!projectMenuOpen) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setProjectMenuOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [projectMenuOpen]);

  const closePanel = () => setPanel(null);
  const visibleStyles = BUILTIN_STYLES.filter((style) => {
    const genreMatch = styleGenre === "Alla" || style.genre === styleGenre;
    const q = styleQuery.trim().toLowerCase();
    return genreMatch && (!q || style.name.toLowerCase().includes(q) || style.promptText.toLowerCase().includes(q));
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={closePanel} aria-label="Gå till startsidan">
          <span className="brand-mark" aria-hidden="true">CB</span><span>ComicBook AI</span>
        </button>
        <div className="top-menu" ref={menuRef}>
          <button className="text-button" type="button" aria-expanded={projectMenuOpen} onClick={() => setProjectMenuOpen((open) => !open)}>Projekt</button>
          {projectMenuOpen ? <div className="menu-panel" role="menu">
            <button role="menuitem" type="button" className="menu-item">Nytt seriealbum</button>
            <div className="menu-divider" /><span className="menu-empty">Inga senaste projekt ännu</span>
            <div className="menu-divider" /><button role="menuitem" type="button" className="menu-item">Visa alla projekt</button>
          </div> : null}
        </div>
        <button className="text-button" type="button" onClick={() => setPanel("styles")}>Stillmallar</button>
        <button className="text-button" type="button" onClick={() => setPanel("guide")}>Guide</button>
        <button className="text-button" type="button" onClick={() => setPanel("settings")}>Inställningar</button>
        <div className="top-chrome">
          <label className="locale-select"><span className="visually-hidden">Språk</span>
            <select value={locale} aria-label="Språk" onChange={(e) => setLocale(e.target.value as Locale)}>
              {LOCALES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <button className={theme === "light" ? "text-button theme-toggle is-on" : "text-button theme-toggle"} type="button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? "Mörkt" : "Ljust"}</button>
        </div>
      </header>

      <main className="home">
        <header className="home-brand"><p className="eyebrow">COMIC CREATION WORKSPACE</p>
          <h1>Från berättelse<br />till seriealbum.</h1>
          <p className="lede">Planera bildrutor, bygg konsekventa bildprompter och skapa din serie utan att låsa projektet till en viss AI-tjänst.</p>
        </header>
        <section className="workspace-card"><p className="eyebrow">DINA PROJEKT</p><h2>Seriealbum kommer att visas här.</h2>
          <p className="quiet">Nästa steg blir projektflödet och import av exportfiler från StoryBook.</p></section>
      </main>

      {panel ? <div className="overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closePanel()}>
        <article className="guide-card" role="dialog" aria-modal="true">
          <div className="guide-actions"><button className="text-button" type="button" onClick={closePanel}>Stäng</button></div>
          {panel === "guide" ? <><p className="eyebrow">GUIDE</p><h1>ComicBook AI Guide</h1><p className="lede">Guiden skriver vi senare. Den här platsen är förberedd för den.</p></> : null}
          {panel === "styles" ? <><p className="eyebrow">SYSTEM</p><h1>Stillmallar</h1><p className="lede">Globala visuella stilar som kan användas när ComicBook AI bygger bildprompter.</p>
              <div className="style-tools"><input value={styleQuery} onChange={(e) => setStyleQuery(e.target.value)} placeholder="Sök stillmall…" aria-label="Sök stillmall" />
                <select value={styleGenre} onChange={(e) => setStyleGenre(e.target.value)} aria-label="Genre"><option>Alla</option>{STYLE_GENRES.map((genre) => <option key={genre}>{genre}</option>)}</select></div>
              <div className="style-grid">{visibleStyles.map((style) => <article className="style-card" key={style.id}><span className="style-genre">{style.genre}</span><h2>{style.name}</h2><p>{style.promptText}</p></article>)}</div></> : null}
          {panel === "settings" ? <><p className="eyebrow">SYSTEM</p><h1>Inställningar</h1><p className="lede">Välj hur ComicBook AI ska arbeta med bildgenerering.</p>
            <div className="ai-options" role="radiogroup" aria-label="AI-läge">{AI_MODES.map((mode) => (
              <button key={mode.id} type="button" className={aiMode === mode.id ? "ai-option is-selected" : "ai-option"} disabled={!mode.available}
                aria-pressed={aiMode === mode.id} onClick={() => mode.available && setAiMode(mode.id)}>
                <span><strong>{mode.label}</strong>{!mode.available ? <small>Kommer senare</small> : null}</span><span>{mode.description}</span>
              </button>
            ))}</div></> : null}
        </article>
      </div> : null}
    </div>
  );
}