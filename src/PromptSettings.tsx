import { useEffect, useState } from "react";
import { beatPrompt, DEFAULT_BEAT_PROMPT, MAX_BEAT_PROMPT_LENGTH, normalizeBeatPrompt } from "./aiPrompts";
import type { LocalAiSettings } from "./localAi";
import type { Locale } from "./settings";

export function PromptSettings({settings, locale, onChange}: {settings: LocalAiSettings; locale: Locale; onChange: (value: LocalAiSettings) => boolean | void}) {
  const text = (sv:string,en:string,nb=sv) => locale==='sv'?sv:locale==='nb'?nb:en;
  const saved = beatPrompt(settings), [draft,setDraft] = useState(saved), [notice,setNotice] = useState('');
  useEffect(()=>setDraft(saved),[saved]);
  const custom = saved !== DEFAULT_BEAT_PROMPT, dirty = draft.trim() !== saved;
  const save = (value:string) => {
    const prompt = normalizeBeatPrompt(value);
    if(onChange({...settings,prompts:prompt?{...settings.prompts,beats:prompt}:undefined})===false){setNotice(text('Kunde inte spara prompten lokalt. Försök igen.','Could not save the prompt locally. Please try again.'));return;}
    setDraft(prompt??DEFAULT_BEAT_PROMPT);
    setNotice(text('Prompten är sparad. Den används nästa gång du föreslår beats.','Prompt saved. It will be used the next time you suggest beats.','Prompten er lagret. Den brukes neste gang du foreslår beats.'));
  };
  return <section className="prompt-settings settings-section" aria-labelledby="prompt-settings-title">
    <div className="settings-section-heading"><h3 id="prompt-settings-title">{text('Prompter','Prompts')}</h3><span className="prompt-kind">{custom?text('Anpassad','Custom','Tilpasset'):text('Standard','Default')}</span></div>
    <label>{text('Uppgift','Task','Oppgave')}<select value="beats" onChange={()=>{}}><option value="beats">{text('Föreslå beats','Suggest beats','Foreslå beats')}</option></select></label>
    <p className="quiet">{text('Anpassa hur AI:n väljer berättelseögonblick för serieadaptionen. Du kan skriva instruktionen på svenska eller engelska.','Customize how AI selects story moments for the comic adaptation. Instructions can be written in your preferred language.','Tilpass hvordan AI velger fortellingsøyeblikk for serieadaptasjonen. Du kan skrive instruksjonen på norsk eller engelsk.')}</p>
    <label>{text('Instruktion för beats','Beat instructions','Instruksjon for beats')}<textarea rows={15} maxLength={MAX_BEAT_PROMPT_LENGTH} value={draft} onChange={e=>{setDraft(e.target.value);setNotice('');}} spellCheck={false}/></label>
    <p className="quiet">{text('Appen sköter svarsformat, källreferenser och validering. Ändringar gäller nya AI-förslag; befintliga beats ändras inte. Din anpassning sparas lokalt och behålls vid uppdateringar.','The app controls response format, source references and validation. Changes apply to new AI suggestions; existing beats stay unchanged. Your customization is stored locally and retained across updates.','Appen styrer svarformat, kildereferanser og validering. Endringer gjelder nye AI-forslag; eksisterende beats endres ikke. Tilpasningen lagres lokalt og beholdes ved oppdateringer.')}</p>
    {dirty?<p className="prompt-unsaved">{text('Osparade ändringar','Unsaved changes','Ulagrede endringer')}</p>:null}
    <div className="prompt-actions"><button type="button" className="primary-button" disabled={!dirty||!draft.trim()||draft.length>MAX_BEAT_PROMPT_LENGTH} onClick={()=>save(draft)}>{text('Spara prompt','Save prompt','Lagre prompt')}</button><button type="button" className="secondary-button" disabled={!custom&&!dirty} onClick={()=>save(DEFAULT_BEAT_PROMPT)}>{text('Återställ standard','Restore default','Gjenopprett standard')}</button></div>
    {notice?<p role="status">{notice}</p>:null}
  </section>;
}
