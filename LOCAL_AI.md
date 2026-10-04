# Lokal text-AI och beats

ComicBook AI stöder samma två typer av lokala textservrar som StoryBook AI:

- Ollama: normalt `http://localhost:11434`.
- LM Studio / llama.cpp med OpenAI-kompatibelt API: normalt `http://localhost:1234`. Adresser med eller utan `/v1` stöds.

## Anslut och välj modell

1. Starta din lokala server och gör en textmodell tillgänglig.
2. Öppna **Inställningar → Lokal text-AI** i ComicBook.
3. Välj servertyp och ange serveradressen.
4. Klicka **Anslut / uppdatera modeller**.
5. Välj **Modell för adaptering** ur serverns lista.
6. Ange kontextstorlek. För Ollama kan **Läs modellens kontextgräns** fylla i modellens rapporterade gräns. Detta är modellens gräns, inte en mätning av datorns minne. För LM Studio / llama.cpp måste kontextstorleken också konfigureras i servern.

Anslutningsinställningarna sparas i ComicBook. Varje servertyp har sin egen adress och sitt eget modellval. Inga inställningar eller data läses från eller skrivs till StoryBook.

Servern måste tillåta anslutningar från adressen där ComicBook körs. Om anslutningen blockeras av webbläsaren, kontrollera serverns CORS-inställningar. Lokala IP-adresser och lokala värdnamn stöds. Molnadresser och URL:er med inbäddade lösenord avvisas i detta läge.

## Föreslå beats

1. Öppna ett projekt och **Adaptering → 1 · Beats**.
2. Fäll ut **AI-analys av beats**.
3. Kontrollera texten och den valda servern/modellen. Markera ett avsnitt för att analysera bara markeringen, eller använd hela manuset. Räknaren visar vilket urval som kommer att skickas.
4. Klicka **Analysera text**. Endast den valda texten och namn på kända karaktärer/platser som förekommer i den skickas till servern. Ingen bild eller StoryBook-fil skickas.
5. Granska förslagen. Ändra rubrik, sammanfattning och visuellt förslag, och välj vilka beats som ska tas med.
6. Klicka **Använd valda beats** för att bygga sekvenser från förslagen. Därefter används **Skapa paneler** som vanligt.

AI-förslag ersätter inte din nuvarande plan förrän du väljer att använda dem. Att använda förslagen ersätter beats, sekvenser och genererade panelförslag/bildprompter; befintliga bilder och sidlayouter behålls. Du kan kasta förslagen eller avbryta analysen. Felaktiga svar ändrar inte projektet.

Källutdrag och originaldialog måste finnas exakt i texten och följa källans ordning. AI-genererad berättartext märks som AI-förslag. Långa texter delas upp i mindre avsnitt som analyseras i följd, med visad progress. En hel roman kan därför ta lång tid; ett kapitel åt gången ger bättre möjlighet att granska resultatet.

Det går fortfarande att välja **Extrahera beats utan AI**. Detta använder den befintliga lokala regelbaserade analysen.

Text-AI-inställningen är separat från bildgenerering. Den här funktionen genererar beats och textinstruktioner, inte bilder.

## Kontrollera koden

```sh
npm run test:adaptation
npm run typecheck
npm run build
```

Regressionstesterna använder simulerade serversvar. Verifiera också anslutningen och resultatens kvalitet med din egen lokala modell.
