import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ComicProject, ProjectSource } from "./project";
import type { Locale } from "./settings";
import type { IllustrationStyle } from "./stylesLibrary";
import { NewAlbumStylePicker } from "./NewAlbumStylePicker";
import { TextBoxStyles } from "./TextBoxStyles";
import "./newAlbumWizard.css";

export function NewAlbumWizard({ locale, source, name, onName, styles, styleId, onStyle, defaults, onDefaults, importReady, importReview, onCreate, onCancel }: {
  locale: Locale; source: ProjectSource; name: string; onName: (name: string) => void;
  styles: IllustrationStyle[]; styleId: string; onStyle: (id: string) => void;
  defaults: ComicProject["overlayDefaults"]; onDefaults: (defaults: ComicProject["overlayDefaults"]) => void;
  importReady: boolean; importReview: ReactNode; onCreate: () => void; onCancel: () => void;
}) {
  const sv = locale === "sv", tr = (s: string, e: string) => sv ? s : e, importing = source === "storybook";
  const [step, setStep] = useState(importing ? -1 : 0);
  const content = useRef<HTMLDivElement>(null);
  const selectedStyle = styles.find(style => style.id === styleId);
  const labels = [tr("Namn", "Name"),tr("Bildstil", "Illustration style"),tr("Textrutor", "Text boxes")];
  const navigation = [...(importing ? [{ index:-1, label:tr("Import", "Import") }] : []), ...labels.map((label,index) => ({index,label}))];
  const canContinue = step === -1 ? importReady : Boolean(name.trim()) && (step === 0 || Boolean(selectedStyle));
  useEffect(() => {
    const dialog = content.current?.closest<HTMLElement>(".new-album-dialog"); if(dialog)dialog.scrollTop=0;
    const field = content.current?.querySelector<HTMLElement>("input[data-album-name],h2[tabindex]"); field?.focus();
  }, [step]);
  const heading = step === -1 ? tr("Välj och granska din StoryBook-export", "Choose and review your StoryBook export") : step === 0 ? tr("Vad ska albumet heta?", "What is the name of your album?") : step === 1 ? tr("Vilken bildstil vill du ha?", "What style do you want for your illustrations?") : tr("Ge dina textrutor ett utseende", "Style your text boxes");
  const help = step === -1 ? tr("Importen skapar en självständig kopia. StoryBook och originalfilen påverkas inte.", "Import creates an independent copy. StoryBook and your original file are not changed.") : step === 0 ? tr("Ingen fara – du kan ändra namnet senare.", "Don't worry — you can change this later.") : step === 1 ? tr("Välj med hjälp av exempelbilderna. Bildstilen kan också ändras senare.", "Choose using the example images. You can change the style later, too.") : tr("Klicka på ett exempel och prova inställningarna. Du kan behålla standardvalen och ändra dem senare.", "Click an example and try the settings. You can keep the defaults and change them later if needed.");
  return <div className="album-wizard" data-stage={step === -1 ? "import" : ["name","style","text"][step]}>
    <header><p className="eyebrow">{tr("Kom igång", "Get started")} · {tr("Steg", "Step")} {step + (importing ? 2 : 1)} / {navigation.length}</p><h1 id="new-project-title">{tr("Nytt seriealbum", "New comic album")}</h1>{step!==0 && name.trim() ? <p className="album-wizard-name-summary">{name}</p> : null}</header>
    <nav className="album-wizard-steps" aria-label={tr("Skapa album", "Album setup")}>
      {navigation.map(item => <button key={item.index} type="button" aria-current={step === item.index ? "step" : undefined} disabled={item.index > step && (!name.trim() || (importing && !importReady) || (item.index === 2 && !selectedStyle))} onClick={() => setStep(item.index)}><span aria-hidden="true">{item.index + (importing ? 2 : 1)}</span>{item.label}</button>)}
    </nav>
    <div className="album-wizard-content" ref={content}><h2 tabIndex={-1}>{heading}</h2><p className="album-wizard-help">{help}</p>
      {step === -1 ? importReview : step === 0 ? <label className="album-wizard-name">{tr("Projektnamn", "Project name")}<input data-album-name value={name} onChange={event => onName(event.target.value)} onKeyDown={event => { if(event.key === "Enter" && name.trim()){event.preventDefault();setStep(1);} }} placeholder={tr("T.ex. Mysteriet på Svartön", "For example, The mystery of the island")} /></label> : step === 1 ? <NewAlbumStylePicker styles={styles} value={styleId} locale={locale} onChange={onStyle} /> : <TextBoxStyles defaults={defaults} locale={locale} onChange={onDefaults} />}
    </div>
    <footer className="album-wizard-footer"><button className="text-button" type="button" onClick={onCancel}>{tr("Avbryt", "Cancel")}</button><div>{step === 1 && selectedStyle ? <span>{tr("Vald stil", "Selected style")}: {selectedStyle.name}</span> : null}<button className="text-button" type="button" disabled={step === (importing ? -1 : 0)} onClick={() => setStep(value => value - 1)}>← {tr("Tillbaka", "Back")}</button>
      {step < 2 ? <button className="primary-button" type="button" disabled={!canContinue} onClick={() => setStep(value => value + 1)}>{tr("Nästa", "Next")} →</button> : <button className="primary-button" type="button" disabled={!canContinue} onClick={onCreate}>{tr("Skapa album", "Create album")} →</button>}
    </div></footer>
  </div>;
}
