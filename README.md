# ComicBook AI

En fristående desktopapp som omvandlar litterär text till illustrerade serier med redigerbart manus, karaktärsreferenser, sidlayout och pratbubblor.

**Status:** körbar prototyp med lokal projektlagring, StoryBook-import, adaptering, sidlayout och textlager. Markera text direkt i manuset för att skapa beats eller låta lokal text-AI föreslå dem. Högerpanelen samlar beat, rutor, bildprompter och bifogade bilder; sekvenser är tills vidare borttagna ur flödet.

## Grundprinciper

- Projekt, text, referensbilder och genererade bilder sparas lokalt.
- AI-generering kan använda molntjänster. Manusmodell och bildmodell väljs separat.
- Redigering, sidplanering och export ska fungera utan internet när projektets resurser finns lokalt.
- StoryBook AI kopplas in enbart genom import av exportfiler.
- **ComicBook AI får aldrig ändra StoryBook AI:s data, filer, inställningar eller repository.**
- Import skapar en självständig kopia. Ingen återskrivning, synkronisering eller direkt åtkomst till StoryBooks lagring.
- StoryCore är en möjlig framtida integration, inte ett beroende för första versionen.

## Dokumentation

- [PROJECT_SPEC.md](PROJECT_SPEC.md): funktioner, arkitektur, datamodell och utvecklingsplan.
- [AGENTS.md](AGENTS.md): regler för arbete i detta repository.
- [PAGE_LAYOUT.md](PAGE_LAYOUT.md): markera rutor och ändra deras storlek med hörn som fäster i rutnätet.
- [LOCAL_AI.md](LOCAL_AI.md): anslut Ollama eller LM Studio / llama.cpp, välj modell och föreslå beats.

## Första milstolpen

Ett komplett flöde för en kort serie på 1–3 sidor: text eller StoryBook-import → redigerbart seriemanus → sidmallar → bildgenerering → textlager → export.

Teknikförslaget är React, TypeScript, Vite och Tauri. Val av AI-tjänster och övriga bibliotek fastställs vid implementation.



## Sidformat och export

Öppna **Albuminställningar → Sidformat** och välj A4, Letter eller eget format i millimeter, stående eller liggande. Formatet gäller alla albumets sidor och sparas i albumbackupen. Nya album börjar i A4. Äldre album behåller tidigare 3:5-proportioner som ett eget format (180 × 300 mm) tills du ändrar inställningen. Ändrade proportioner kan ändra bildbeskärningen; bilder, bubblor och rutkopplingar finns kvar.

Välj **Exportera** i albummenyn:

- **PDF:** en fil med de valda sidorna i sidordning och rätt fysiska mått. Sidorna rasteriseras i vald dpi med JPEG-kvalitet 98%; texten är inte sökbar.
- **PNG:** en förlustfri bild per sida.
- **JPEG:** en bild per sida, med valbar kvalitet 50–100%.
- En vald bildsida laddas ner direkt. Flera PNG/JPEG-sidor samlas i en vanlig ZIP med numrerade filnamn. Detta är inte en CBZ-export.

Välj hela albumet eller markera sidor individuellt, samt 72, 150, 300 eller 600 dpi. Exportens sidformat kan ändras utan att albumets inställningar ändras. Vid andra proportioner bevaras hela sidan med vita marginaler som standard; **Fyll sidan och beskär kanterna** är ett aktivt val. Exporten innehåller sidbakgrund, beskärning, textlager, bubblor, lokala fonter och SFX, utan rutnät, läsordningsnummer eller redigeringshandtag. Tomma bildrutor exporteras vita med ram.

Exporten körs lokalt och kan avbrytas. En sida får ha högst 40 miljoner pixlar och högst 16 384 pixlar per kant; minska dpi för större egna format. Tryckutfall, CMYK, CBZ och EPUB ingår inte i denna första exportversion.

Kontroller: `npm run test:export`, `npm run test:module-paths`, `npm run test:adaptation`, `npm run test:manuscript-ui` och `npm run build`.

## Ladda upp sidbakgrund

Under **Sidor → Sidans bakgrund** kan du välja **Ladda upp bakgrundsbild** direkt, utan att först öppna bildredigeraren. PNG, JPEG och WebP stöds. När sidan har en bild visas **Byt bakgrundsbild**. Bildbytet behåller bakgrundens textlager och de vanliga bildrutorna ovanpå. Öppna **Redigera bakgrund och text** för beskärning, zoom och bubblor.


## Textstorlek i punkter

Textstorlek anges i **pt** i textlagrens egenskaper och albumets standardvärden. Samma värde ger samma storlek på sidan i stora och små bildrutor och på sidbakgrunden. När du ändrar rutans eller bubblans mått behåller texten sin storlek och radbryts efter det tillgängliga utrymmet. Bokstävernas proportioner bevaras även i avlånga rutor. Sidvy och export använder samma beräkning.

Äldre album och importerade säkerhetskopior räknas automatiskt om till punkter en gång. De nya siffervärdena kan därför skilja sig från de gamla; textens tidigare höjd behålls ungefärligt.

Radbrytningen mäter textens faktiska bredd i valt typsnitt och vikt. **Sidmarginal (%)** lägger lika stort avstånd på vänster och höger sida. Vid vänsterjustering blir högerkanten fortfarande ojämn eftersom hela ord flyttas till nästa rad. Manuella radbrytningar behålls.

## Rutor med olika former

Markera en ruta under **Sidor**, välj **Rutans form** och använd **Redigera form** för hörn som fäster på ett rutnät med fyra delningar per enkelpanel i sidlayouten. Större bildrutor får fler fästpunkter. Rektangel, romb, parallellogram, trapets och triangel stöds. **Klar med formen** återgår till storleksändring. Bild och text beskärs efter konturen i sidvy, redigerare och export. Former sparas med albumet och följer med backup. Se [PAGE_LAYOUT.md](PAGE_LAYOUT.md).

## Flytta bilden i rutan

Öppna bildrutans eller bakgrundens redigerare och välj **Redigera bild**. Bilden följer musen uppåt, nedåt och åt sidorna även när dess höjd eller bredd redan passar rutan. **X-position** och **Y-position** anges i procent av rutans mått; positiva värden flyttar åt höger respektive nedåt. Zoom ändrar bildens storlek utan att ändra förflyttningens känslighet. Escape eller avbruten pekardragning återställer den pågående flytten. Äldre sparade beskärningar behålls tills du ändrar bildens visning.

## Dela yta mellan sneda rutor

Markera rutan som ska anpassas och välj **Grannruta** under **Passa mot grannruta**. Välj vänster, höger, ovanför eller under, ange **Marginal mellan rutor (mm)** och klicka **Passa kanten**. Standardmarginalen är 2 mm. Den valda rutan utökas och klipps längs en parallell kant, så att formerna kan dela på samma enkelpanel utan att deras synliga ytor överlappar. Avståndet mäts mellan ramarna, även längs diagonaler. Bilder, text och rutans ID behålls.

Passningen sparas som rutans form och ingår i export och backup. Klicka **Passa kanten** igen om grannrutan ändras. Rutor som skulle överlappa en annan synlig form tillåts inte.

## Rutornas ramar

I **Albuminställningar → Standardram för rutor** väljer du färg med färgväljare eller hexkod, tjocklek i punkter (pt) och om ramen ska visas. Under **Sidor**, markera en ruta och ändra **Rutans ram** för att ge just den rutan egna värden. **Använd albumets standardram** återställer ärvda värden. Rutor utan eget val följer albumstandarden när den ändras.

Ramändringar flyttar inte bilder eller textlager. Färg, tjocklek och dolda ramar följer med export och backup. **Passa kanten** tar hänsyn till båda rutornas aktuella ramtjocklek; passa kanten igen efter att tjockleken ändrats för att återställa önskad marginal. Äldre album behåller sina tidigare svarta ramar tills inställningarna ändras.
