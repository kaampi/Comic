import type { Locale } from "./settings";
const en = {
  title: "Local text AI", intro: "Connect the same type of local server as in StoryBook AI. Used to understand the manuscript and suggest beats.",
  engine: "Server type", url: "Server address", model: "Adaptation model", refresh: "Connect / refresh models", connecting: "Connecting…",
  noModels: "No models found", connected: "Connected", context: "Context size (tokens)", contextHelp: "Ollama receives this context size. For LM Studio / llama.cpp, also configure the context in the server.",
  suggestContext: "Read model context limit", unknownContext: "The server did not report a context limit.", contextLimit: "Model context limit",
  connectionHelp: "Start the server and load a text model. If the browser cannot connect, allow ComicBook's address in the server's CORS settings.",
  localHelp: "Use localhost, a private IP address or a local network hostname. Settings are saved only in ComicBook AI.",
  propose: "Suggest beats with AI", show: "AI beat analysis", source: "Text to analyse", selection: "Use highlighted text", whole: "Use entire manuscript",
  sourceHelp: "Highlight a passage below and choose Use highlighted text, or analyse the entire manuscript. Long texts are processed in smaller passages.",
  preview: "Sending only this passage and names of known characters/places found in it", chars: "characters", parts: "passages",
  analyse: "Analyse text", analysing: "Analysing passage", cancel: "Cancel", settings: "AI settings", configure: "Connect a local server and choose a text model in Settings first.",
  review: "Review AI suggestions", generated: "AI suggestion", include: "Include beat", summary: "Summary", visual: "Visual suggestion", original: "Source excerpt",
  dialogue: "Original dialogue", caption: "Suggested narration", apply: "Use selected beats", discard: "Discard suggestions",
  replace: "Using these suggestions replaces the current beats, sequences and generated plan. Images already on pages are preserved.",
  stale: "The manuscript changed. Analyse it again before applying these suggestions.", failed: "AI analysis failed. Your current plan is unchanged.",
  cancelled: "Analysis cancelled. Your current plan is unchanged.", selected: "Selected text", empty: "Select at least one beat.",
  imageHeading: "Image generation", basic: "Extract beats without AI"
};
type Text = typeof en;
const sv: Text = {
  title: "Lokal text-AI", intro: "Anslut samma typ av lokal server som i StoryBook AI. Används för att förstå manuset och föreslå beats.",
  engine: "Servertyp", url: "Serveradress", model: "Modell för adaptering", refresh: "Anslut / uppdatera modeller", connecting: "Ansluter…",
  noModels: "Inga modeller hittades", connected: "Ansluten", context: "Kontextstorlek (token)", contextHelp: "Ollama får denna kontextstorlek. För LM Studio / llama.cpp ställer du också in kontexten i servern.",
  suggestContext: "Läs modellens kontextgräns", unknownContext: "Servern rapporterade ingen kontextgräns.", contextLimit: "Modellens kontextgräns",
  connectionHelp: "Starta servern och ladda en textmodell. Om webbläsaren inte kan ansluta, tillåt ComicBooks adress i serverns CORS-inställningar.",
  localHelp: "Använd localhost, en privat IP-adress eller ett värdnamn i det lokala nätverket. Inställningarna sparas endast i ComicBook AI.",
  propose: "Föreslå beats med AI", show: "AI-analys av beats", source: "Text att analysera", selection: "Använd markerad text", whole: "Använd hela manuset",
  sourceHelp: "Markera ett avsnitt nedan och välj Använd markerad text, eller analysera hela manuset. Långa texter bearbetas i mindre avsnitt.",
  preview: "Skickar endast detta avsnitt och namn på kända karaktärer/platser som finns i det", chars: "tecken", parts: "avsnitt",
  analyse: "Analysera text", analysing: "Analyserar avsnitt", cancel: "Avbryt", settings: "AI-inställningar", configure: "Anslut en lokal server och välj en textmodell i Inställningar först.",
  review: "Granska AI-förslag", generated: "AI-förslag", include: "Ta med beat", summary: "Sammanfattning", visual: "Visuellt förslag", original: "Källutdrag",
  dialogue: "Originaldialog", caption: "Föreslagen berättartext", apply: "Använd valda beats", discard: "Kasta förslagen",
  replace: "När du använder förslagen ersätts nuvarande beats, sekvenser och genererad plan. Bilder som redan ligger på sidor behålls.",
  stale: "Manuset har ändrats. Analysera det igen innan du använder förslagen.", failed: "AI-analysen misslyckades. Din nuvarande plan är kvar.",
  cancelled: "Analysen avbröts. Din nuvarande plan är kvar.", selected: "Markerad text", empty: "Välj minst ett beat.",
  imageHeading: "Bildgenerering", basic: "Extrahera beats utan AI"
};
const nb: Text = {
  ...sv, title: "Lokal tekst-AI", intro: "Koble til samme type lokal server som i StoryBook AI. Brukes til å forstå manuset og foreslå beats.",
  engine: "Servertype", model: "Modell for adaptering", refresh: "Koble til / oppdater modeller", connecting: "Kobler til…",
  noModels: "Ingen modeller funnet", connected: "Tilkoblet", context: "Kontekststørrelse (token)",
  contextHelp: "Ollama mottar denne kontekststørrelsen. For LM Studio / llama.cpp må konteksten også stilles inn i serveren.",
  suggestContext: "Les modellens kontekstgrense", unknownContext: "Serveren rapporterte ingen kontekstgrense.", contextLimit: "Modellens kontekstgrense",
  connectionHelp: "Start serveren og last en tekstmodell. Hvis nettleseren ikke kan koble til, tillat ComicBooks adresse i serverens CORS-innstillinger.",
  localHelp: "Bruk localhost, en privat IP-adresse eller et lokalt vertsnavn. Innstillingene lagres bare i ComicBook AI.",
  propose: "Foreslå beats med AI", show: "AI-analyse av beats", source: "Tekst å analysere", selection: "Bruk markert tekst", whole: "Bruk hele manuset",
  sourceHelp: "Marker et avsnitt nedenfor og velg Bruk markert tekst, eller analyser hele manuset. Lange tekster behandles i mindre avsnitt.",
  preview: "Sender bare dette avsnittet og navn på kjente karakterer/steder som finnes i det", chars: "tegn", parts: "avsnitt",
  analyse: "Analyser tekst", analysing: "Analyserer avsnitt", settings: "AI-innstillinger", configure: "Koble til en lokal server og velg en tekstmodell i Innstillinger først.",
  review: "Se gjennom AI-forslag", generated: "AI-forslag", include: "Ta med beat", summary: "Sammendrag", visual: "Visuelt forslag", original: "Kildeutdrag",
  dialogue: "Originaldialog", caption: "Foreslått fortellertekst", apply: "Bruk valgte beats", discard: "Forkast forslagene",
  replace: "Forslagene erstatter nåværende beats, sekvenser og generert plan. Bilder som allerede ligger på sider beholdes.",
  stale: "Manuset er endret. Analyser det igjen før du bruker forslagene.", failed: "AI-analysen mislyktes. Nåværende plan er beholdt.",
  cancelled: "Analysen ble avbrutt. Nåværende plan er beholdt.", selected: "Markert tekst", empty: "Velg minst ett beat.",
  imageHeading: "Bildegenerering", basic: "Trekk ut beats uten AI"
};
export function localAiText(locale: Locale): Text { return locale === "sv" ? sv : locale === "nb" ? nb : en; }
