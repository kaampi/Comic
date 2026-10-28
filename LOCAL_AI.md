# Lokal text-AI och beats

kaampi Comic stöder samma två typer av lokala textservrar som kaampi Write:

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

1. Öppna ett projekt och **Manus**.
2. Markera det avsnitt du vill analysera direkt i manuset.
3. Högerklicka och välj **Föreslå beats för markeringen**, eller använd samma knapp ovanför manuset. Räknaren visar markeringens antal tecken. Server och modell väljs i **AI-inställningar**.
4. Endast den markerade texten och namn på kända karaktärer/platser som förekommer i den skickas till servern. Ingen bild eller StoryBook-fil skickas.
5. Granska förslagen i högerpanelen. Ändra rubrik och sammanfattning och välj vilka beats som ska tas med.
6. Klicka **Lägg till valda beats**. Förslagen läggs till bredvid befintliga beats; rutor, prompter, bilder och sidlayouter bevaras.

Förslagen ändrar inte projektet innan du väljer att lägga till dem. Du kan kasta förslagen eller avbryta analysen. Felaktiga svar ändrar inte projektet. Om manuset ändras måste gamla förslag analyseras på nytt.

Du kan också högerklicka på en markering och välja **Skapa beat** utan AI. Beatet får en diskret ram i manuset. Klicka på ramen eller välj beatet i högerpanelens lista för att redigera det. Panelens bredd ändras genom att dra kanten mellan manuset och högerpanelen. Sammanfattning, beat-typ, karaktärer, plats, dialog och berättartext samlas i den gemensamma hopfällbara panelen **Beatdetaljer**. Serierutorna som grupp och varje enskild ruta kan också fällas ihop för bättre överblick.

Välj ett beat och använd **Ta bort beat** för att ta bort dess ram och källkopplingar. Manustext, befintliga rutor, prompter och bilder behålls. **Ångra borttagning** återställer beatet så länge du inte gör nya projektändringar eller lämnar manusvyn.

Varje nytt beat får automatiskt en första serieruta. När beatet har en enda ruta visas bildinstruktion, prompt och bild direkt i beatets högerpanel. Äldre beats som saknar ruta får en första ruta när manusvyn öppnas; befintliga rutor och bilder bevaras. Först när du väljer **Lägg till ruta** visas flera rutor som separata hopfällbara avsnitt.

Varje beat kan ha flera **serierutor**. Använd **Lägg till ruta**, redigera bildinstruktion, dialog och berättartext, skapa/kopiera bildprompt och lägg in en PNG-, JPG- eller WebP-bild via filval eller drag och släpp. Tidigare bifogade bilder kan återställas under **Tidigare bilder**. Rutor blir automatiskt tillgängliga under **Bildrutor** och **Sidor**. En bifogad bild följer med när rutan väljs på en sida; en redan placerad bild ersätts inte automatiskt.

**Sekvenser ingår inte i arbetsflödet.** Äldre projekt behåller sina tidigare data och rutor. I adapteringsöversikten kan du skapa rutor för återstående beats utan att befintliga rutor eller bildprompter ersätts.

Om du redigerar text före ett beat flyttas dess källkoppling. Om du ändrar beatets eget avsnitt visas en granskningsmarkering för beatet och dess rutor. Kontrollera sammanfattning, bildinstruktion och dialog innan du bekräftar granskningen. Om avsnittet har försvunnit kan du markera ny text och koppla beatet till den.

Texten delas upp i numrerade avsnitt. Modellen svarar med en kort rubrik, en sammanfattning, beat-typ samt första och sista avsnittsnummer för varje beat. Appen hämtar källtexten själv och plockar ut citerad originaldialog direkt ur den. Modellen behöver därför inte kopiera text eller dialog perfekt. Okända eller felordnade avsnittsnummer avvisas utan att ändra projektet.

Prompten ber om högst 15 beats per textdel, högst 8 ord i rubriken och högst 30 ord i sammanfattningen. Svarslimiten är 35 procent av kontextstorleken, högst 2 048 token. Bildinstruktionen börjar som beatets sammanfattning och kan justeras i rutans högerpanel. Beats-analysen genererar inte separat visuell regi eller berättartext.

Långa texter delas upp i mindre textdelar som analyseras i följd, med visad progress. En hel roman kan därför ta lång tid; ett kapitel åt gången ger bättre möjlighet att granska resultatet. Kortare svar minskar genereringsarbetet men garanterar inte en viss analystid på din dator.

**Skapa beat** använder lokal regelbaserad analys av markeringen och kräver ingen AI-anslutning.

Text-AI-inställningen är separat från bildgenerering. Den här funktionen genererar beats och textinstruktioner, inte bilder.

## Kontrollera koden

```sh
npm run test:adaptation
npm run test:manuscript-ui
npm run typecheck
npm run build
```

Regressionstesterna använder simulerade serversvar. Verifiera också anslutningen och resultatens kvalitet med din egen lokala modell.
