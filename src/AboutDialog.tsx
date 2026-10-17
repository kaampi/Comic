import { diagnosticsEnabled, setDiagnosticsEnabled, downloadDiagnostics } from "./diagnostics";
import { useEffect, useId, useRef, useState } from "react";
import { FONT_NOTICES } from "./fontNotices";
import type { Locale } from "./settings";
import packageInfo from "../package.json";
import "./about.css";

const TEXT = {
  sv: {
    title: "Om ComicBook AI", close: "Stäng", version: "Version",
    intro: "ComicBook AI är en app för att skapa seriealbum med lokal projektlagring.",
    fonts: "Fonter som ingår", lead: "Dessa fonter följer med appen och fungerar offline. Länkarna till Google Fonts kräver internet.",
    ui: "Gränssnitt och manus", comic: "Bubblor, berättarrutor och ljudeffekter",
    license: "Läs hela licensen", system: "Valbara systemfonter",
    systemLead: "Dessa fonter följer inte med appen. De behöver finnas installerade på datorn för redigering och export. Om de saknas används en reservfont.",
    action: "Av Iconian Fonts / ShyFonts Type Foundry. Action Man behöver installeras separat. Fontpaketets villkor förbjuder paketering i en annan produkt.",
    terms: "Upphovspersonens villkor", impact: "Av Geoffrey Lee / Monotype. Användning omfattas av licensen för din installation.",
    impactLink: "Fontinformation hos Microsoft", sample: "ÅÄÖ — Hej, världen!",
  },
  en: {
    title: "About ComicBook AI", close: "Close", version: "Version",
    intro: "ComicBook AI is an app for creating comic albums with local project storage.",
    fonts: "Included fonts", lead: "These fonts are bundled with the app and work offline. Google Fonts links require internet.",
    ui: "Interface and manuscript", comic: "Bubbles, captions and sound effects",
    license: "Read the full license", system: "Optional system fonts",
    systemLead: "These fonts are not bundled. They must be installed on the computer used for editing and export. A fallback font is used if they are missing.",
    action: "By Iconian Fonts / ShyFonts Type Foundry. Install Action Man separately. The font package terms prohibit inclusion in another product.",
    terms: "Creator's terms", impact: "By Geoffrey Lee / Monotype. Use is covered by the license for your installation.",
    impactLink: "Font information at Microsoft", sample: "ÅÄÖ — Hello, world!",
  },
  nb: {
    title: "Om ComicBook AI", close: "Lukk", version: "Versjon",
    intro: "ComicBook AI er en app for å lage tegneseriealbum med lokal prosjektlagring.",
    fonts: "Fonter som følger med", lead: "Disse fontene følger med appen og fungerer uten nett. Lenkene til Google Fonts krever internett.",
    ui: "Grensesnitt og manus", comic: "Bobler, tekstruter og lydeffekter",
    license: "Les hele lisensen", system: "Valgfrie systemfonter",
    systemLead: "Disse fontene følger ikke med appen. De må være installert på datamaskinen som brukes til redigering og eksport. En reservefont brukes hvis de mangler.",
    action: "Av Iconian Fonts / ShyFonts Type Foundry. Action Man må installeres separat. Fontpakkens vilkår forbyr pakking i et annet produkt.",
    terms: "Opphavspersonens vilkår", impact: "Av Geoffrey Lee / Monotype. Bruk omfattes av lisensen for installasjonen din.",
    impactLink: "Fontinformasjon hos Microsoft", sample: "ÅÆØ — Hei, verden!",
  },
};

export function aboutLabel(locale: Locale) {
  return TEXT[locale].title;
}

export function AboutDialog({ locale, onClose, returnFocus }: { locale: Locale; onClose: () => void; returnFocus?: HTMLElement | null }) {
  const text = TEXT[locale];
  const [logging, setLogging] = useState(diagnosticsEnabled);
  const titleId = useId();
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = returnFocus ?? document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button, a[href], summary") ?? []).filter(element => {
        const closed = element.closest("details:not([open])");
        return !closed || element === closed.querySelector("summary");
      });
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => { window.removeEventListener("keydown", keydown); previousFocus?.focus(); };
  }, [onClose, returnFocus]);

  return (
    <div className="overlay about-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="guide-card about-dialog" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="about-header">
          <div><h1 id={titleId}>{text.title}</h1><p className="quiet">{text.version} {packageInfo.version}</p></div>
          <button ref={closeButton} className="text-button" type="button" onClick={onClose}>{text.close}</button>
        </header>
        <p>{text.intro}</p>
        <section className="about-font-group">
          <h2>{locale === 'sv' ? 'Felsökning' : locale === 'nb' ? 'Feilsøking' : 'Diagnostics'}</h2>
          <p>{locale === 'sv' ? 'Slå på loggen innan du försöker återskapa kraschen. Efter omstart kan du hämta loggen här. Den innehåller tekniska mätvärden, inte dina texter, bilder eller API-nycklar. Inget skickas automatiskt.' : locale === 'nb' ? 'Slå på logging før du prøver å gjenskape krasjet. Last ned loggen her etter omstart. Den inneholder tekniske målinger, ikke tekst, bilder eller API-nøkler. Ingenting sendes automatisk.' : 'Enable logging before reproducing a crash. After restarting, download the log here. It contains technical measurements, not your text, images or API keys. Nothing is sent automatically.'}</p>
          <button type="button" className="text-button" aria-pressed={logging} onClick={() => { setDiagnosticsEnabled(!logging); setLogging(!logging); }}>{locale === 'sv' ? logging ? 'Stäng av diagnostiklogg' : 'Slå på diagnostiklogg' : locale === 'nb' ? logging ? 'Slå av diagnostikk' : 'Slå på diagnostikk' : logging ? 'Disable diagnostics logging' : 'Enable diagnostics logging'}</button>{' '}
          <button type="button" className="text-button" onClick={downloadDiagnostics}>{locale === 'sv' ? 'Hämta diagnostiklogg' : locale === 'nb' ? 'Last ned diagnostikklogg' : 'Download diagnostic log'}</button>
        </section>
        <h2>{text.fonts}</h2>
        <p className="quiet">{text.lead}</p>
        {(["ui", "comic"] as const).map(group => (
          <section className="about-font-group" key={group}>
            <h3>{text[group]}</h3>
            {FONT_NOTICES.filter(font => font.group === group).map(font => (
              <article className="about-font" key={font.name}>
                <div className="about-font-heading">
                  <div><h4>{font.name}</h4><p className="quiet">{font.designer}</p></div>
                  <a href={font.url} target="_blank" rel="noopener noreferrer">Google Fonts ↗</a>
                </div>
                <p className="about-font-sample" style={{ fontFamily: font.name }}>{text.sample}</p>
                <p className="about-font-license">{font.license}</p>
                <details><summary>{text.license}</summary><pre className="about-license-text">{font.licenseText}</pre></details>
              </article>
            ))}
          </section>
        ))}
        <section className="about-font-group">
          <h2>{text.system}</h2>
          <p className="quiet">{text.systemLead}</p>
          <article className="about-font"><h4>Action Man</h4><p>{text.action}</p><a href="https://www.iconian.com/commercial.html" target="_blank" rel="noopener noreferrer">{text.terms} ↗</a></article>
          <article className="about-font"><h4>Impact</h4><p>{text.impact}</p><a href="https://learn.microsoft.com/en-us/typography/font-list/impact" target="_blank" rel="noopener noreferrer">{text.impactLink} ↗</a></article>
        </section>
      </section>
    </div>
  );
}

