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
