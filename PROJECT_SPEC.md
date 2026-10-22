# PROJECT_SPEC.md — ComicBook AI

Specifikation: 0.1  
Datum: 2026-10-01  
Status: planering; överenskomna produktgränser och föreslagen implementation.

## 1. Mål och produktgräns

ComicBook AI är en fristående installerad datorapp som omvandlar egen litterär text till illustrerade serier. Författaren styr adaption, bildval, layout och text. Appen ska bevara karaktärernas visuella identitet och berättelsens läsbarhet.

Projekt och bildresurser sparas lokalt. Molnbaserad AI är tillåten för att bildgenerering inte ska kräva en kraftfull dator hos varje användare. Vilka tjänster som stöds i första versionen är ännu inte beslutat.

### 1.1 Bindande gräns mot StoryBook AI

**ComicBook AI får aldrig ändra något i StoryBook AI.**

- Enda kopplingen är läsning av en exportfil som användaren själv väljer.
- Import skapar en självständig kopia i ComicBook-projektet.
- Exportfilen får inte skrivas över, flyttas eller raderas av importen.
- Ingen åtkomst till StoryBooks databas, IndexedDB, inställningar eller arbetsmappar.
- Ingen återskrivning, synkronisering, direkt API-koppling eller ändring av StoryBooks repository.
- Alla bearbetningar och genererade resurser tillhör ComicBook-projektet.
- Detta repository ska utvecklas oberoende av StoryBook AI.

StoryCore är på planeringsstadiet. Första versionen ska fungera utan StoryCore. Importmodulens gräns kan senare återanvändas av en separat StoryCore-adapter; någon sådan adapter ingår inte nu.

## 2. Arbetsflöde

1. Skapa ett lokalt serieprojekt.
2. Klistra in text eller importera en StoryBook-export.
3. Välj text, relevanta karaktärer, fakta och referensbilder.
4. Skapa och granska ett seriemanus.
5. Redigera rutor och dialog.
6. Planera sidor, läsordning och utrymme för text.
7. Generera slutbilder utifrån rutornas faktiska proportioner.
8. Välj bilder och justera pratbubblor, berättarrutor och ljudeffekter.
9. Exportera PDF, PNG eller CBZ.

Manus och sidplanering får itereras. Enkla förhandsbilder kan erbjudas före slutlayouten. Slutlig bildgenerering ska använda den planerade rutans mått och komposition.

## 3. Lokal app och lagring

### 3.1 Föreslagen teknik

- React och TypeScript för gränssnitt och domänlogik.
- Vite för frontendbygge.
- Tauri för desktopskal, lokal filhantering och systemintegration.
- Validerade, versionsmärkta projekt- och importmodeller.
- Separata adaptrar för manusmodeller respektive bildtjänster.
- SVG eller motsvarande vektorlager för redigerbar text och bubblor.

Detta ersätter ursprungsspecens antagande om Next.js och serverbaserade API-routes. Exakta bibliotek, stödda operativsystem och AI-leverantörer ska fastställas under implementation.

### 3.2 Projektformat

Första desktopsteget (2026-10-19) har ett Tauri 2-skal för Windows med samma React/Vite-app och befintlig IndexedDB-lagring. `npm run desktop:dev` startar utvecklingsfönstret; `npm run desktop:build` konfigurerar ett NSIS-bygge. Single-instance-plugin fokuserar befintligt fönster vid en andra start. HTML-dragning behålls för paneler och bildbibliotek. Webbläsare, utvecklingsfönster och installerad app har separata lagringsmiljöer; album flyttas med användarvald backup. Windows-kompilering och provkörning återstår. Se DESKTOP.md. Projektformatet nedan beskriver nästa lagringssteg och är ännu inte implementerat.

Ett projekt lagras i en projektmapp:

- project.json: projektmetadata, manus, layout och textlager.
- assets/references/: importerade och tillagda referensbilder.
- assets/generated/: nedladdade genererade bildversioner.
- exports/: användarens exporter.
- recovery/: återställningsdata enligt senare beslutad lagringspolicy.

Resurser adresseras med stabila ID:n och relativa sökvägar inom projektet. Bildfiler ska inte bäddas in som stora data-URL:er i project.json. Leverantörers URL:er eller generation-ID:n är metadata, inte permanent lagring.

Sparning ska ske atomiskt med möjlighet till återställning efter avbrott. Projektet ska kunna paketeras till en enda backupfil och återställas utan molnanslutning.

Källfil och destinationsprojekt måste hållas åtskilda. Import och backupåterställning ska avvisa sökvägar som lämnar projektmappen.

### 3.3 Offline och nätverk

Lokal redigering, layout och export ska fungera offline när nödvändiga resurser finns sparade. Molngenerering kräver nätverk.

Användaren ska kunna se vilket text- och bildmaterial som ska skickas till vald AI-tjänst. Import i sig ska inte starta någon nätverksöverföring. Hemliga API-nycklar ska hanteras separat från projektdata och aldrig följa med i backup, export eller git.

## 4. StoryBook-import och källtext

Första importvägen föreslås vara StoryBook AI:s JSON-backup:
kind = "storybook-ai.manuscript", format = 1.

Befintlig struktur har kapitel, scener, fakta, profiler, media och en illustrationsstil som textsnapshot. Importadaptern översätter dessa till ComicBooks egen datamodell. Den ska validera filformat och rapportera inkompatibla versioner utan att ändra källfilen.

### 4.1 Importurval

Användaren granskar och väljer:
- Kapitel eller textavsnitt som ska adapteras.
- Relevanta karaktärer, platser, föremål och händelser.
- Etablerade fakta och karaktärsprofiler.
- Referensbilder.
- Illustrationsstil.

Brainstormmaterial, kasserade kapitel och versionshistorik ska inte automatiskt följa med till AI-bearbetning. Regler för dolda entiteter och fakta måste respekteras. Föreslagna eller flaggade fakta ska inte automatiskt behandlas som etablerad sanning.

Behåll källans bok-, kapitel-, scen- och entitets-ID:n som proveniens. ComicBook använder egna stabila ID:n internt. Kopplingen till originaltexten ska innehålla en textsnapshot och versions- eller innehållsfingeravtryck så att senare textändringar kan upptäckas.

Import av ett nytt underlag får inte skriva över ett pågående serieprojekt utan ett uttryckligt val. Ingen direkt synkronisering med StoryBook ingår.

## 5. Manusmotor

### 5.1 Visual beat-analys

Text bryts ned till sekventiella rutor utifrån:
1. Ny visuell handling.
2. Dialogskifte.
3. Känsla eller reaktion.
4. Scen- eller miljöbyte.

En utlösare innebär inte automatiskt en ny ruta. Motorn ska också väga tempo, textmängd, sidutrymme och läsbarhet.

### 5.2 Adaption och berättarröst

Inre monolog och miljöbeskrivning får:
- Gestaltas visuellt.
- Bevaras som berättarruta eller tankebubbla.
- Utelämnas när informationen redan framgår.

Föreslagna lägen: trogen adaption, balanserad och fri. Det ska framgå när motorn föreslår tillägg eller större ändringar. Bearbetningen får inte ändra importerade fakta eller källtext.

Varje ruta länkas till relevant källavsnitt. Dialog, berättartext och visuell regi lagras separat. Modellresultat ska valideras innan de blir redigerbart manus.

## 6. Karaktärer och visuell kontinuitet

Karaktärsankare delas i:
- Identitet: ansikte, kroppsbyggnad, ålder och bestående kännetecken.
- Scentillstånd: kläder, rekvisita, skador och andra tidsbundna detaljer.
- Rutregi: pose, uttryck, blick och placering.

Tillfälliga uttryck, exempelvis nervositet, får inte bli en permanent identitetsegenskap.

Användaren väljer godkända referensbilder. StoryBooks bilddata omvandlas till egna lokala resurser vid import. Leverantörsspecifika gen_id:n är inte en generell garanti för konsistens.

Konsistens kräver både referenser och granskning. Användaren ska kunna omgenerera en enskild ruta, jämföra bildversioner och välja ett godkänt resultat. Referenser från tidigare rutor ska vara uttryckligt valda så att ett felaktigt utseende inte sprids automatiskt.

Tidsbundna fakta ska tillämpas på rätt scen; senare förändringar får inte läcka bakåt i berättelsen.

## 7. Manusredigerare

Sekventiell listvy med:
- Redigerbar handling, utsnitt, kameravinkel, dialog och berättartext.
- Redigerbar bildinstruktion och valda referenser.
- Infoga, ta bort, flytta och slå ihop rutor.
- Reaktions- och etableringsrutor.
- Koppling till källtext.
- Ångra/återställ för destruktiv redigering.

Infogning ändrar ordningsfält, aldrig rutornas ID:n. Vid sammanslagning bevaras källkopplingar och användaren kan granska dialogens nya ordning.

### 7.1 Manuskriptstyrd adaptering i prototypen

Manuset är den primära arbetsytan. Användaren markerar text och skapar ett beat via högerklick eller ber den valda lokala textmodellen föreslå beats för just markeringen. AI-förslag granskas innan de läggs till; befintliga beats, rutor, prompter och bilder bevaras. Pågående beat-analys visas i en centrerad modal med en animerad tolvpunktsindikator, aktuellt avsnitt och Avbryt. Bakgrunden spärras, fokus hålls i dialogen och Escape avbryter. Minskad rörelse stänger av animationen. Modalen stängs vid resultat, fel eller avbrott; sena svar efter avbrott ignoreras. Den lokala analysen söker synliga handlingsskiften, upptäckter, reaktioner och miljöbyten i stället för en ruta per mening. Varje förslag har en separat händelsesammanfattning och omskriven bildscen med ett teckningsbart ögonblick. De kan granskas och redigeras var för sig. Källtext och dialog återställs från exakta segmentreferenser; AI:n får inte skriva om originalrepliker. Endast kända karaktärs- och plats-ID:n godtas, även vid pronomenkoppling inom det analyserade avsnittet. Saknade bildscener, upprepade sammanfattningar och längre ordagranna källkopior avvisas utan att tillämpa förslagen.

Manusets brödtext visas med 1,5 radavstånd och ett separat, mindre styckeavstånd för tomrader. Formateringen är visuell: ursprungliga radslut och teckenpositioner i arbetskopian och den importerade originalreferensen ändras inte. Beats visas med diskreta ramar i källtexten. En högerpanel med justerbar bredd visar valt beat, karaktärer, plats, dialog och berättartext. Ett beat länkas direkt till en eller flera serierutor med bildinstruktion, utsnitt, bildprompt och bifogad bild. Tidigare bifogade bilder kan återställas. Sekvenser används tills vidare inte i arbetsflödet; äldre sekvensdata läses för bakåtkompatibilitet.

Textändringar före ett beat flyttar dess källkoppling. Ändringar i ett länkat avsnitt markerar beatet och dess rutor för granskning. Befintlig regi, text, prompter och bilder ersätts inte av källredigeringen. Ett försvunnet avsnitt kan kopplas om till ny markerad text.

Prototypen sparar album och bilder i webbläsarens lokala IndexedDB med atomiska transaktioner. Befintliga localStorage-album flyttas först efter validering; textkopian tas bort först när databaskopian är sparad och verifierad. I äldre miljöer utan IndexedDB används localStorage som reserv. Projektmappar, separata bildfiler och atomisk sparning enligt avsnitt 3.2 kvarstår som mål för desktoplagringen.

### 7.1.1 Lagringskonflikter och återställningspunkter

IndexedDB-sparning jämför den aktuella databaskopian med den som appinstansen senast läste eller skrev, i samma transaktion som uppdateringen. Om en annan flik eller appinstans ändrat projektlistan stoppas skrivningen med ett tydligt konfliktmeddelande. Osparade ändringar stannar i den öppna appen och kan hämtas som albumbackup. Ny inläsning krävs innan appinstansen kan skriva över den nya basversionen. Vid modulomladdning tillåts inte en okänd appinstans ersätta en redan befintlig samling utan föregående inläsning.

Upp till tre återställningspunkter sparas i samma databas, atomiskt tillsammans med huvudkopian. Föregående projektlista bevaras före första ändringen efter inläsning, därefter högst vartannat minut vid vanliga sparningar, samt före borttagning av album. Migration från localStorage sparar också en återställningskopia innan den gamla nyckeln tas bort. Avbrutna transaktioner ändrar varken huvudkopian eller historiken. Lokal återställning från startsidan och projektväljaren visar historiska album och låter användaren hämta vanliga albumbackupfiler utan att skriva över aktuella album. Kvarvarande äldre localStorage-album visas också. Funktionen kan läsa återställningspunkter vid korrupt huvudsnapshot; den kan inte återskapa data som redan raderats ur all webbläsarlagring. Diagnostik registrerar endast antal album, datastorlek och teknisk lagringsstatus, aldrig manus eller bilder.

### 7.1.2 Påminnelse om separat backupfil

Backup i toppmenyn markeras rött med en liten prick efter 30 minuters aktivt arbete med ändringar som saknar skapad backupfil, eller efter 10 nya bilder/paneler. Dold flik, ofokuserat fönster och inaktivitet över en minut räknas inte som arbetstid. Markeringen pulserar svagt tre gånger och ligger sedan kvar; minskad rörelse stänger av pulsen. Status och räknare sparas separat per album och påverkar inte albumets innehåll eller automatiska sparning. Poolflytt och återanvändning av samma bild räknas inte som nya resurser.

Create backup… / Skapa säkerhetskopia… skapar albumfilen och återställer påminnelsen för just den versionen; misslyckat filskapande gör det inte. Webbläsaren kan inte bekräfta att användaren fullföljt en eventuell spara-dialog. Återställning av en befintlig albumbackup börjar utan påminnelse tills nya ändringar gjorts. PDF-/bildexport och backup från äldre återställningspunkter återställer inte det aktuella albumets räknare. Restore backup… / Återställ säkerhetskopia… används konsekvent för återläsning. Sparfel visas separat och omedelbart, oberoende av backup-påminnelsen.

### 7.2 Kapitel från StoryBook

StoryBook är sanningskällan. Import av dess export för andra appar är enkelriktad och skapar en självständig arbetskopia i ComicBook. Endast ComicBooks repository och lagring ändras. Ingen anslutning till StoryBooks repository, databas eller originalfil införs och ingen återexport till StoryBook görs.

Kapitel behåller rubriker, ordning enligt exportens `sequence_index`, ursprungliga kapitel-ID:n och exakt importerad originaltext inklusive radslut och tomma kapitel. Varje kapitel får även ett eget stabilt ComicBook-ID och ett intervall i arbetskopians sammanhängande text. Originaltexten förblir en skrivskyddad lokal referens; textredigering ändrar bara arbetskopian. Beats och panelplaner har kapitelkopplingar, medan deras källpositioner fortsatt är globala och stabila vid kapitelbyte.

Manusvyn visar ett kapitel åt gången med kapitelval och föregående/nästa. Beatlista och beatnavigering följer valt kapitel. Man kan analysera en markering eller uttryckligen välja Föreslå beats för kapitlet. Navigation och import startar aldrig AI. Kapitelredigering bevarar andra kapitel, käll-ID:n, originalreferenser, bilder, sparade prompter och sidlayout; senare textintervall förskjuts och ändrade beats/paneler markeras för granskning.

Kapiteldata följer lokal lagring och albumbackup; ogiltiga eller överlappande intervall och okända kapitelreferenser avvisas vid återställning. Äldre album fungerar utan kapitel. Tidigare StoryBook-importer får återställda kapitel endast om de bevarade scenkopiorna exakt motsvarar hela texten; gränser eller förlorade ursprungliga kapitel-ID:n gissas aldrig. Inläsning och jämförelse av en ny StoryBook-export mot pågående adaption ingår inte i detta steg.

### 7.3 Startguide för nya album

Startsidan erbjuder direkt sidbygge, eget manus, StoryBook-import och öppning av sparade projekt. Nya album skapas genom tre steg: namn, bildstil och textutseende. Bakåt/framåt bevarar utkastets val. Avbryt sparar inget nytt album; först Skapa album skapar och sparar det färdiga projektet. Direkt sidbygge öppnar Sidor med en första tom sida, medan eget manus och StoryBook-import öppnar Manus.

StoryBook-valet öppnar först filväljaren och en importgranskning med befintliga val för karaktärer, platser och Cards. Därefter följer samma guide med bokens namn förifyllt. Originalfilen förblir oförändrad och sena svar från avbrutna filinläsningar får inte ändra ett annat utkast. Ingen AI startas av guiden.

Bildstilen väljs i grupper med stora förhandsbilder och lightbox. Textsteget visar separata levande exempel för pratbubblor, tankebubblor och berättarrutor med samma renderer som sidbyggaren. Exemplen visar en normal ny bubbla i en rutnätscell från albumets startrutnät, förstorad som helhet med sidbyggarens fysiska textmått och proportioner. Förhandsvisningens förstoring ändrar inte sparade punktstorlekar. Typsnitt, storlek, vikt, justering, marginal, rundning, bubbelform, text- och bakgrundsfärg, ram och opacitet sparas som albumets standard för nya textlager. Inställningarna kan ändras i albuminställningarna och följer lokal lagring och backup. Befintliga textlager behåller sina värden; tidigare pratbubblors utseende och uttryckligt valda karaktärsswatcher behåller företräde vid relevant nyskapande.

### 7.4 Albumkort

Befintliga album öppnas först i ett albumkort från startsidan, projektlistan och projektmenyn. Kortet visar titel, bildstil, sidantal och en märkning för album med StoryBook som importkälla. Omslagsbild och kort introduktion kan redigeras; Spara albuminfo eller Öppna album för redigering sparar ändringarna lokalt. Omslaget visas på startsidan och i projektlistan. Informationen följer lokal lagring och albumbackup. Öppna återupptar albumets senaste arbetssteg. Ta bort album använder befintlig raderingsbekräftelse och påverkar endast den valda lokala ComicBook-kopian, aldrig StoryBooks original eller andra album.

## 8. Sidplanerare

Första versionen använder sidmallar. Fri drag-and-drop och rutnät är en senare utbyggnad.

Planerade rutnät är 3 × 3 och 4 × 4 med stöd för bland annat:
- 1 × 1: standardruta eller närbild.
- 2 × 1: bred ruta.
- 1 × 2: hög ruta.
- 2 × 2: större betoning eller klimax.

Dessa är layoutspann, inte fasta bildförhållanden. Faktiska proportioner beräknas från sidformat, marginaler, mellanrum och rutans bredd/höjd.

Läsordning lagras uttryckligen, separat från rutornas geometriska placering. Höger-till-vänster-läsning är en möjlig senare funktion.

Ändrad layout ska markera när en befintlig bild inte längre passar. Användaren väljer beskärning, omkomposition eller ny generering; layoutändring får inte starta en kostnadsbelagd generering automatiskt.

### 8.1 Sidmarginaler och rutmellanrum

Albuminställningarna erbjuder fyra oberoende sidmarginaler och mellanrum mellan kolumner respektive rader, i millimeter. Dessa gäller alla albumets sidor och sparas i sidformatets `spacing`. Förhandsvisning, rutgeometri och export använder samma mått. Sidbakgrunden fyller hela sidan. Ändringar bevarar rut-ID:n, gridplaceringar, bildversioner och text; beskärning och radbrytning kan förändras när rutornas mått ändras. Om inställningarna saknas bevaras äldre layout. Om måtten inte lämnar plats för rutnätet ska ändringen avvisas.

### 8.2 Flytta befintliga paneler inom sidan

I normalt läge lossnar en panel efter 400 ms med vänster musknapp nedtryckt. Därefter kan hela panelen dras till en ny plats i sidans rutnät. Rörelse över 6 skärmpixlar före aktivering avbryter långtrycket. Vanliga klick markerar och dubbelklick öppnar redigeraren; hörnhandtag fortsätter ändra storlek direkt och formredigering använder sina befintliga handtag.

Den lossade panelen följer musen fritt och kontinuerligt, även mellan rutnätscellerna. En separat streckad kontur visar närmaste släppmål i rutnätet med sidans marginaler och mellanrum. Först vid släpp fäster panelen på målet. Bild, beskärning, texter, svansar, bubbelförbindelser, fri form, källkopplingar, stabila ID:n och läsordning bevaras. Kollisionskontrollen använder faktiska konvexa konturer och ramarnas bredd, inte bara panelernas omslutande rektanglar. Placering utanför rutnätet, över andra paneler eller över reserverad bakgrundstext markeras ogiltig.

Dragningen har en tydligt synlig men begränsad geléeffekt med dämpad fjädring, eftersläpning och ett kort landningsgung, även vid normal och långsam musrörelse. Deformationen begränsas så att snabba rörelser inte förstör läsbarheten. Effekten omfattar bild, ram och paneltext även när texten ligger ovanpå förgrundsbilder. Den ändrar inga projektdata eller kollisionskonturer, återställer alla visuella transformeringar och stängs av vid minskad rörelse i systeminställningarna. I det läget visar draghjälpen varför geléeffekten är avstängd.

En giltig flytt sparas en gång vid släpp. Ogiltigt släpp, Escape, pointercancel, förlorad pointer capture, fönsterbyte, rullning, storleksändring eller byte av sida/album/läge avbryter utan att ändra projektet. Flytt mellan sidor hanteras via panelpoolen nedan.

### 8.3 Panelpool och väntande paneler

Albumets panelpool lagrar hela sidpaneler som inte är placerade. En panel kan antingen tillhöra den gemensamma poolen eller vänta på en bestämd sida. Bild, beskärning, form, ram, texter, typografi, svansar, bubbelförbindelser, källkopplingar och stabila ID:n bevaras. Det tidigare rutnätet sparas för förhandsvisningen. Sidbakgrund och förgrundslager är separata lager och flyttas inte som paneler.

Högerklick erbjuder Lyft till panelpool och Flytta till annan sida. I sidopanelen kan flera av den aktuella sidans paneler markeras och flyttas samtidigt till poolen, en befintlig sida eller en ny sida. På målsidan hamnar de under Väntar på placering även om layouten är full. Ingen befintlig panel ersätts. Poolens miniatyrer visar bild och bubblor; destination kan ändras och enskilda paneler raderas efter bekräftelse.

Paneler dras från poolen till sidan med en grön/röd kontur som visar om de får plats. Alternativt anges kolumn och rad med en placeringsknapp. Rutnätsstorlek i celler och fri form bevaras; andra sidrutnät kan förändra proportionerna vid placering. Samma kontroll mot sidgränser, faktiska panelkonturer och reserverad bakgrundstext används som vid flytt inom sidan. Endast giltig placering tar bort panelen från poolen. Ångra paneländring återställer den senaste pooländringen om inga senare panel-/layoutändringar skulle skrivas över.

Vid radering av en sida flyttas dess paneler och sidans väntande paneler till albumets pool; sidbakgrund och förgrundslager tas bort efter tydlig bekräftelse. Vid byte av rutnät väntar sidans paneler på ny placering i stället för att försvinna. Bildbiblioteket får inte duplicera en panel som ligger i poolen. Poolen följer lokal lagring, engångskonvertering av äldre typografi och albumbackup med validerade ID:n, målsidor, rutnät och textkopplingar. Väntande paneler exporteras inte; exportkontrollen påminner om albumets fria paneler och väntande paneler på de valda sidorna.

## 9. Stilmotor och promptbyggare

Stilbiblioteket ska stödja inbyggda och egna stilar med:
- Namn och beskrivning.
- Positiva stilinstruktioner.
- Negativa instruktioner där bildtjänsten stöder dem.
- Referensbilder och taggar.

Inledande stilfamiljer:
- Europeisk klassisk seriestil med detaljerad tusch och akvarell.
- Franco-belgisk/Marcinelle med karikatyr, rörelse och uttrycksfull tusch.
- Graphic Novel Noir med stark kontrast och dramatiska skuggor.
- Manga/Seinen med tusch, screentones och dramatiska vinklar.

Stilen beskriver återgivning, inte vilka personer eller händelser som finns i scenen. Vald stil kopieras till projektet så att framtida biblioteksändringar inte ändrar äldre projekt.

Promptbyggaren sammanför utsnitt, handling, visuella ankare, scentillstånd, stil och kompositionskrav. Bildförhållande, referensbilder och andra tekniska parametrar hanteras som strukturerade data av leverantörsadaptern. "--ar" är inte universell promptsyntax.

Bilder ska genereras utan inbränd dialog eller berättartext. Planerad plats för bubblor ska ingå i kompositionsinstruktionen.

### 9.0 Renodlat stilbibliotek

Det inbyggda biblioteket har 37 profiler i åtta grupper: stiliserad serieteckning, realistisk serieteckning, manga/japansk teckning, modern serieteckning, måleri, teckning/tryck, collage/grafisk illustration och fotografisk återgivning. Grupperna beskriver bildspråk och material; berättelsegenre, miljö och tidsålder kommer från panelen. Bildspråksreferenser till Hergé, Uderzo, Morris, Franquin och Manara visas och kan sökas, men prompten beskriver tekniken och maneret utan att ange förebildens figurer eller motiv.

Snarlika mallar har förenats utan att radera särpräglade maner. Nya profiler täcker nervig karikatyrtusch, färgpennor/vaxkrita, träsnitt/linoleumtryck, risografi, skrapkartong, gravyr, gouache, papperscollage, geometrisk illustration och tre fotografiska uttryck. Fotografiska profiler bevarar overkliga motiv, art och överdriven anatomi. Familjevänliga former kan gestalta alla efterfrågade känslor. Konsthistoriska materialegenskaper kan finnas kvar utan att föreskriva en historisk berättelsemiljö.

Kamera- och effektförval lagras i stilens `panelDefaults` och kopieras endast till nya paneler. Befintliga paneler och sparade prompter ändras inte av ett stilbyte. Optik, fokus, effekter och kontinuitet visar aktiva val när avsnitten är stängda. Förval märks **Från stil**, ändrade fält **Anpassat**; blandade avsnitt visar båda. Avstängda effekter saknas i prompten. Raster, penseldrag och materialstruktur är stilteknik och ligger kvar i stilen.

Befintliga album behåller sin stilsnapshot, även om stilens ID inte längre ingår i biblioteket. Ingen automatisk ersättning sker vid öppning, normalisering eller backupåterställning. Egna lokala mallar bevaras. Uppdaterade profiler väljs uttryckligen i stilbiblioteket. Befintliga förhandsbilder behålls där de fortfarande passar; nya profiler har tills vidare ingen genererad exempelbild.

Den godkända profilen **Cinematic storybook comic** finns under Modern serieteckning med fyra stilmoduler och en färgförhandsbild från robot- och byborscenen. Den använder uttrycksfulla tecknade figurer och breda målade former även i maskiner och miljö. Motiv, ljus och kamera styrs av panelen. Testprompt och bildproveniens sparas med de verifierade stilresurserna.

Den godkända profilen **Classic fairytale animation** finns under Stiliserad serieteckning med fyra stilmoduler och en färgförhandsbild från robot- och byborscenen. Alla förgrundsmotiv återges med tunna konturer och rena celmålade färgfält framför mjukt målade akvarell- och gouachemiljöer. Maskiner och djur följer samma animationsspråk som figurerna. Panelen bestämmer motiv, känslor, ljus och kamera.

### 9.1 Bildpromptredigering i manusläget

Kopiering och sparning av en strukturerad stilmall bevarar dess fyra stilfält, bildspråksreferenser, förhandsbilder, panelförval och inställning för avslutande stilpåminnelse. Mallredigeraren visar de fyra fält som promptbyggaren använder; sammanställd text och färglägesvarianter uppdateras tillsammans vid sparning. Äldre mallar utan strukturerade fält behåller sina manuella promptvarianter. Befintliga album och redan sparade bildprompter uppdateras först genom uttryckligt stilval respektive omskapande. Modul 3 för specialeffekter utelämnas när inga effekter är valda.

Beats behåller snabbspåret för lokal bildpromptgenerering. Varje serieruta erbjuder också **Justera bildprompt** i ett modalt redigeringsfönster, cirka 80 procent av skärmens bredd och höjd. Handling, karaktärsankare och separat regi per karaktär, miljö, ljus, utsnitt och kameravinkel visas direkt. Optik, skärpedjup, visuell fokuspunkt, specialeffekter och kontinuitet är valfria utfällbara avsnitt. Optik och effekter är ospecificerade som standard. Utsnitt och vinkel kan låsas oberoende när ett nytt lokalt förslag hämtas från beatet.

Vanlig redigering och promptförhandsvisning sker utan nätverksanrop eller projektsparning. Med en vald lokal textmodell erbjuder redigeraren **Skriv om till bildscen med lokal AI**. Endast länkade källavsnitt, aktuell regi och valda karaktärers/platsens beskrivningar skickas till den lokala modellen efter knapptryckning; bilder och resten av manuset skickas inte. Modellen ska iscensätta ett synligt ögonblick och bevara fakta, identitet, kameraval och kontinuitet. Förslaget visas separat och måste användas uttryckligen för att ändra utkastet. Avbrutna, sena, ogiltiga eller kopierade svar lämnar den aktuella beskrivningen kvar. **Spara bildprompt** sparar både rutans strukturerade regi och den sammansatta prompten. Avbryt, Stäng och Escape lämnar projektet oförändrat. Manuellt redigerade sparade prompter kan granskas i fönstret och ersätts först vid uttrycklig sparning eller omskapande. Rut-ID:n, prompt-ID:n och bildhistorik bevaras.

Albuminställningarna innehåller fyra valfria stilfält: medium, linjer/former, färg/skuggning och ytstruktur/finish. Äldre album använder sin befintliga stilsnapshot. Stiländringar påverkar nya eller omskapade prompter; sparade prompttexter skrivs inte om automatiskt. Ett byte av stilpreset återgår till den nya stilens standard. Färg- och skuggningsfältet tillämpas endast i färgläget; gråskala och linjeteckning behåller sina återgivningskrav. Strukturerad stil och rutregi följer lokal sparning och albumbackup.

## 10. Bildgenerering

En leverantörsadapter beskriver vilka bildstorlekar, referenser och redigeringsfunktioner tjänsten faktiskt stöder. Ingen specifik tjänst är beslutad ännu.

Varje generering lagrar:
- Ruta och aktuell revision av manus/layout/stil.
- Modell, parametrar och skickad prompt.
- Valda referensresurser.
- Jobbstatus, fel och leverantörens jobb-ID.
- Lokalt sparat bildresultat och skapandetid.
- Tillgänglig kostnadsinformation.

Första versionen genererar en ruta åt gången. Albumgenerering i kö kommer senare. Appen ska före generering tydligt visa vad som ska genereras och tillgänglig prisinformation. Avbryt i appen kan inte garanteras avbryta ett redan accepterat leverantörsjobb eller dess kostnad.

Återförsök får inte blint skapa dubbla betaljobb. Misslyckad nedladdning och misslyckad generering hanteras separat. Ett resultat från en äldre rutrevision ska kunna sparas utan att tyst ersätta det aktuella bildvalet.

## 11. Textlager och export

Vektorlager ovanpå bilderna:
- Pratbubblor och tankebubblor med talare och pekpinne.
- Berättarrutor.
- SFX/ljudeffekter.
- Redigerbar text, typsnitt, storlek, position och läsordning.

Textpositioner lagras i ett gemensamt koordinatsystem så att redigerare och export använder samma placering. Dialog har stabila ID:n; bubbellayout refererar till dem i stället för att skapa konkurrerande textkopior.

Första exporter: PNG per sida och PDF. CBZ paketerar sidbilder i stabil läsordning och kommer i nästa steg. Textoverflow, saknade bilder och resurser ska upptäckas före export. Typsnitt och upplösning måste ge läsbart resultat i vald sidstorlek.

### 11.0 Kontroller före export

Exportpanelen kontrollerar automatiskt de valda sidorna före PDF-, PNG-, JPEG- och IDML-export. Textens radbrytning, punktstorlek och blandade typografi mäts med samma mått som SVG-exporten. Text som överstiger textrutans rektangulära utrymme flaggas som möjlig överfyllnad; rundade bubbelsidor, fria panelkonturer och beskärning vid sidkanter behöver fortsatt granskas visuellt. Dolda SFX-texter ignoreras.

Tomma bildrutor och rasterbilder under 300 effektiv dpi vid exportens fysiska storlek visas som varningar. Bildens inpassning, zoom och exportens contain/cover-anpassning ingår; ändrad raster-dpi skapar inte fler detaljer i originalbilden. Sidbakgrunder och förgrunder kontrolleras, men rena textlager kräver ingen bild. Oläsbara bilder stoppar export tills bilden ersatts eller tagits bort. Kontrollen läser endast lokala data-/blob-bilder och ändrar inte projektet. Varningar tillåter export av exempelvis läskopior med tomma rutor. Visa öppnar rätt panel/lager och markerar berörd text. Byte av sidor eller exportinställningar avbryter tidigare kontroll och export inväntar det aktuella resultatet.

### 11.1 Redigerbara bubbelförbindelser

Kopplade prat- eller tankebubblor har två fästpunkter som kan flyttas längs respektive bubbels kontur och två oberoende kurvhandtag. En kubisk kurva ger både bågar och S-former. Fästvinklar lagras lokalt till bubblorna; kurvhandtag använder förbindelsens fysiska koordinater och följer flyttning, skalning och rotation. Vid kraftiga böjar begränsas handtag och faktisk bredd för att undvika övervikningar. Befintliga förbindelser behåller sin raka geometri tills de redigeras. Startbredd och slutbredd kan anges oberoende (2–80 procent av den gemensamma referensstorleken). Bredden interpoleras längs kurvans längd; skyddsbegränsningen vid skarpa böjar skalar båda ändarna lika så att förhållandet behålls. Äldre förbindelser använder sin befintliga bredd i båda ändarna. Återställ förbindelse tar bort kurvinställningar men bevarar båda bredderna och texterna.

Pratbubblors böjda och avsmalnande förbindelser ansluter längs bubbelkonturen med mjuka övergångar, utan utstickande raka avslutningar. Förbindelsens runda handtag visas i halv storlek med bibehållen osynlig träffyta.

Dragning förhandsvisas lokalt och sparas först vid släpp; Escape, pointercancel och förlorat fönsterfokus avbryter. Handtagen kan även styras med piltangenter och Shift. Redigeringshandtag visas bara i panelredigeraren. Sidan och export använder samma sammanfogade kontur. Kurvdata följer IndexedDB/localStorage och albumbackup; ogiltiga vinklar och kontrollvärden avvisas vid backupimport.

### 11.2 Berättarrutors rundning

Berättarrutor har rundning från −100 till 100, både per ruta och i albumets standardvärden. Noll är en exakt rektangel med fyra raka sidor. Negativa värden behåller hörn och yttermått men böjer sidorna inåt för spetsigare hörn; positiva värden behåller den befintliga rundningen. Förhandsvisning, sidexport och IDML använder samma kontur. Värdena följer lokal sparning och albumbackup. Vid byte av texttyp används den nya typens albumstandardvärden, så berättarrutans negativa rundning inte följer med till pratbubblor.

### 11.3 Sidövergripande förgrundslager

Kontrollerna för förgrundsbilder ligger i sidinställningspanelen direkt under Sidans bakgrund. Varje sida kan ha flera förgrundslager med stabila ID:n, originalbild och egna textlager. PNG/WebP-transparens bevaras; ingen panel eller vit bakgrund skapas runt förgrundsbilden. Bilderna ligger över panelbilder och panelramar men under sidans texter och bubblor. Lagerordning kan ändras i listan, med främsta bilden överst. Förgrundens bubblor använder hela sidans koordinater och kan länkas över panelgränser inom samma förgrundslager.

Redigeraren visar hela sidans bildkomposition. Bilden kan flyttas, skalas, roteras och spegelvändas. Som standard lämnar bildflyttning bubblorna på plats; valet att flytta bild och bubblor tillsammans flyttar deras positioner och svansändar lika mycket. Zoom, rotation och spegling gäller bilden. Bilddragning förhandsvisas lokalt och sparas vid släpp; Escape och avbruten dragning återställer bilden och dess grupp. Förgrundsredigering ändrar inte paneler, källbilder eller andra förgrundslager.

Originalbild, lagerordning, gruppläge och redigerbara texter följer lokal lagring och albumbackup. Sidexport och IDML behåller transparens, fullsidiga koordinater och text över förgrundsbilder. Att ta bort bara bilden lämnar texterna kvar; borttagning av hela förgrundslagret tar även bort dess texter efter bekräftelse.

## 12. Domänmodell

Modellen delas upp för att hålla berättelse, layout och genereringshistorik åtskilda:

| Modell | Huvudansvar |
|---|---|
| ComicProject | Formatversion, metadata, inställningar och projektinnehåll |
| SourceDocument / SourceSpan | Importproveniens, textsnapshot och källkopplingar |
| StoryContext | Importerade entiteter, profiler och etablerade fakta |
| CharacterAnchor / SceneState | Visuell identitet och tillfälliga scenegenskaper |
| Panel | Stabilt ID, ordning, utsnitt, handling, dialog och källkopplingar |
| Dialogue | Stabilt ID, talare, text och bubbeltyp |
| Page / PanelPlacement | Sidformat, rutans position, mått och läsordning |
| StylePreset | Stilinstruktioner och referenser |
| Asset | Lokalt bild-ID, relativ sökväg, typ och ursprung |
| Generation | Jobbstatus, indatarevision, modell, parametrar och resultat |
| Overlay | Textreferens, position, form, pekpinne och typografi |

Datamodellerna ska ha schema-validering och migrationsväg. Stable ID:n får inte härledas från arrayindex. Bildversioner får inte skrivas över vid omgenerering.

## 13. Utvecklingsplan

- [ ] Fas 1: Desktopgrund, domänmodeller, lokal projektlagring och återställning.
- [ ] Fas 2: Inklistrad text och skrivskyddad StoryBook-import med urvalsgranskning.
- [ ] Fas 3: Manusmotor och manusredigerare med källkopplingar.
- [ ] Fas 4: Sidmallar, läsordning och faktisk rutgeometri.
- [ ] Fas 5: Stilar, karaktärsreferenser och en bildleverantör med bildversioner.
- [ ] Fas 6: Textlager och PNG/PDF-export.
- [ ] Fas 7: Fri sidlayout, genereringskö och CBZ.

Första milstolpen är en fungerande kort serie på 1–3 sidor med ett fåtal karaktärer. StoryCore och direkt appsynkronisering ingår inte.

## 14. Acceptanskriterier för första milstolpen

- Ett projekt kan skapas, sparas, stängas och öppnas med text och bildresurser intakta.
- StoryBook-exporten är oförändrad efter import, även vid avbruten eller misslyckad import.
- Ingen del av appen läser eller skriver direkt i StoryBooks lagring.
- Bara användarens valda underlag skickas till AI-tjänsten.
- Rutor kan redigeras och infogas utan att befintliga ID:n och källkopplingar går förlorade.
- En ruta kan omgenereras utan att tidigare bilder eller andra rutor försvinner.
- Manus, layout och textlager kan redigeras offline.
- Exporterad sida har samma läsordning och textplacering som förhandsvisningen.
- Fel vid generering eller nedladdning lämnar projektet användbart och återställbart.

## 15. Återstående beslut

- AI-leverantörer, autentisering och stödda funktioner.
- Om manusgenerering ska erbjuda lokal AI, moln-AI eller båda.
- Prioriterat operativsystem för första desktopversionen.
- Exakta lagrings-, backup- och migrationsdetaljer.
- Sidformat, upplösning och typsnitt för första exporten.
- Licens för projektet.


## English beta guide

The top-level Guide opens an English getting-started dialog. It starts with a no-AI exercise: create an album, draw page frames, upload images, add text, download a backup and export a page. Further sections explain manuscript beats, panel plans, image prompts, style snapshots and beta feedback.

`src/guideContent.ts` is the shared source for the in-app guide and `docs/GETTING_STARTED.md`. Each topic has a stable ID and `shortHelp` for future contextual help beside UI headings. Run `npm run docs:guide` after editing content. `npm run test:guide` checks documentation freshness and guide navigation, keyboard focus and dismissal. Installation instructions are a separate documentation task.

### Fri form för bildrutor (2026-10-21)

Under bildrutans inställningar finns en utfällbar **Fri form**-sektion. **Redigera form** visar noder och valfri fästning mot sidrutnätets fyra delningar per enkelpanel. Dubbelklick på kanten lägger till en nod; noder kan dras eller flyttas med piltangenter, och markerad nod kan tas bort ned till tre noder. Konturen får ha urtag men inte korsa eller vidröra sig själv eller överlappa andra rutor. Högst 64 noder. Escape återställer pågående drag.

Markerade kantsegment kan döljas och visas utan att ändra bildens beskärning. Segmentens synlighet sparas med album och backup och används även av raster-, PDF- och IDML-export, inklusive handritade ramar. **Återställ till rektangel** återställer formen och visar alla kanter. Kurvor och automatisk friläggning av figurer ingår inte i detta steg.

### Fri form för textbubblor (2026-10-21)

Textredigerarens egenskaper för markerad pratbubbla, tankebubbla eller berättarruta har en egen **Fri form → Redigera form**. Noder kan dras, flyttas med piltangenter, läggas till med dubbelklick på konturen och tas bort ned till tre noder. Valbar mjuk kontur och fästning mot ett lokalt rutnät. Escape återställer pågående drag; återställ grundform tar bort den egna konturen utan att ändra text, typografi eller svansinställningar. Att öppna verktyget ändrar inte bubblan.

Konturen sparas i normaliserade koordinater som följer bubblans storlek och rotation. Svansens fäste, tankebubblans spår, sammanlänkade bubblor, sidvisning, backup och export använder den egna formen. Befintliga bubblor utan egen kontur behåller sitt utseende. Bildrutornas tidigare Fri form-funktion finns kvar separat.

Formredigering för textbubblor kan också aktiveras direkt med **Redigera bubblans form** högst upp i textredigerarens huvudrad. Knappen avslutar eventuell pågående direkt textredigering och visar blå noder samt en synlig statusrad. **Avsluta formredigering** återgår till vanligt textläge. Fri form-sektionen ligger bland bubblans utseendeinställningar.

### Textflöde i fria bubblor (2026-10-21)

Bubblor med egen kontur radbryter texten efter kroppens insida, med användarens marginal och utrymme för ramlinjen. Varje rad använder ett sammanhängande intervall som rymmer hela radens höjd; urtag delar aldrig en rad i två delar. Svansen räknas inte som textutrymme. Blandad typografi, Unicode, författarens radbrytningar och punktstorlekar bevaras. Formen och textens fysiska rotation ingår i beräkningen.

Redigerarens visning och direktredigering använder samma radpositioner som SVG, raster och PDF. Om hela texten inte ryms visas **Texten ryms inte** bland textens egenskaper och i exportkontrollen. Överskjutande text behålls i projekt och backup; textstorleken ändras aldrig automatiskt. IDML använder placerade redigerbara textrader för samma radbrytning och behåller eventuell överskjutande källtext i en dold textram märkt Overflow text. Äldre bubblor utan egen kontur behåller sin tidigare textlayout.

### Kontextmenyer för textbubblor (2026-10-21)

I textredigeraren visar högerklick på en bubbla Redigera text, Redigera bubblans form, Kopiera, Duplicera, Klistra in och Ta bort. Tom yta erbjuder Klistra in för en tidigare kopierad bubbla, även från en annan bildruta. Kopior får nya ID:n och egna kopior av form, svans, text och typografi; bubbelförbindelser dupliceras inte.

Vid textredigering bevarar menyn textmarkeringen och erbjuder Avsluta textredigering, Fet, Kursiv, Understruken, Klipp ut, Kopiera och Klistra in. Formatering gäller markeringen, eller hela texten om inget är markerat. Intern textkopiering bevarar typografin; extern text klistras in som vanlig text. Kursiv och understrykning sparas per textrange och används i visning, direktredigering, radmätning, backup och export.

I formredigering erbjuder högerklick på en nod Ta bort nod och Gör skarp/Gör mjuk för just den noden. Högerklick på konturen erbjuder Lägg till nod här. Avsluta formredigering finns i båda menyerna. Minst tre noder och en giltig, ej självkorsande kontur krävs. Escape stänger först en öppen meny, ångrar annars pågående noddrag, eller avslutar aktiv text-/formredigering utan att stänga redigeringsfönstret. Textändringar behålls när textläget avslutas. Menyer stöder piltangenter, Home/End och Escape; synliga knappar finns kvar.


### Visningszoom och bubblornas lagerordning (2026-10-21)

Rutans och de sidomfattande lagrens redigerare har separat visningszoom 25–800 %, Anpassa och panorering med mellanslag + dra eller mittenknappen. Ctrl/Command + scroll zoomar runt pekaren utanför Redigera bild; i bildläget behåller gesten sin befintliga funktion för bildplacering. Visningszoom ändrar aldrig projektets bild-, text- eller formgeometri och följer inte med i export. Varje öppning börjar med anpassad vy.

Bubblans högerklicksmeny erbjuder Lägg överst, Flytta framåt, Flytta bakåt och Lägg underst inom dess bildruta eller sidomfattande lager. Sammankopplade bubblor bildar en gemensam lagernivå, förankrad vid första medlemmen i den sparade ordningen. Kontur och text målas tillsammans per lagernivå. Ordningen sparas i befintlig overlaylista och följer backup, sidvisning och export. IDML samlar text, bubblor och SFX på samma redigerbara lager för att överlappningen ska bevaras.


### Kurvhandtag för fria textbubblor (2026-10-21)

Skarpa noder visas som små fyrkanter och mjuka noder som cirklar, med större osynlig träffyta. Nodmarkörer och handtagsändar har fast skärmstorlek oavsett visningszoom, proportioner och rotation. Bara markerad mjuk nod visar sina två kurvhandtag. Handtagen hålls i linje med varandra, med oberoende längd på varje sida. Dragning samt piltangenter (Shift för större steg) ändrar kurvan. Escape, pointercancel och fönstrets fokusförlust återställer pågående drag.

Handtag sparas som vektorer relativt noden i bubblans normaliserade koordinater och följer nodflyttning, bubbelstorlek och rotation. Äldre noder utan sparade handtag behåller tidigare automatiska kurvor exakt tills de justeras. Skarp nod använder inte sina handtag; de finns kvar om noden åter görs mjuk. Grundformsåterställning tar bort egna noder och handtag. Samma geometri används för kontur, svansfäste, förbindelser, textflöde och export. Backup bevarar handtagen och avvisar ogiltiga eller icke ändliga värden.


### Inställningar och anpassningsbar beatprompt (2026-10-21)

Inställningsfönstret har två kolumner med oberoende scroll på större skärmar, en gemensam scroll på smala skärmar samt fast rubrik och stängknapp. Dialogen ryms inom fönstret, håller tangentbordsfokus och stängs med Escape.

AI-kolumnens Prompter erbjuder uppgiften Föreslå beats, ett större instruktionsfält, Spara prompt och Återställ standard. Standardprompten prioriterar berättelsens förändringar, orsak–handling–reaktion, viktiga upptäckter och lågmälda reaktioner framför mekanisk meningsindelning. Ett beat kan omfatta flera rutor; en representativ teckningsbar stund anges i bildbeskrivningen. AI:n granskar sammanhang, luckor och upprepningar innan svaret.

Endast berättarinstruktionen är redigerbar. JSON-kontrakt, källsegment, kända entiteter och lokal validering styrs fortsatt av appen. Egna instruktioner sparas separat från albumet i ComicBooks lokala AI-inställningar och bevaras vid appuppdateringar samt modellbyte. Utkast används först vid sparning. Återställning tar bort anpassningen så att kommande standardförbättringar används. Befintliga beats ändras inte. Öppning och redigering startar inga AI-anrop; instruktionen används först när användaren uttryckligen begär beatförslag.


### Kapitelpilot för beatförslag (2026-10-22)

StoryCore-export format 1 och 2 stöds genom det uppdaterade delade kontraktet. Synopsis, kapitel-Brief och ordnade scener (originalprosa och separata instruktioner) bevaras i ComicBooks eget adaptionunderlag. Import startar ingen AI och godkänner inget automatiskt. I Manus → Kapitelpilot kan original visas, arbetskopior redigeras och respektive del godkännas för AI. Äldre album kan kompletteras med en användarvald export för samma bok, med matchande kapitel-ID:n och originalprosa, utan att ersätta manus, beats, bilder eller sidor. Full återimport/sammanfogning ingår inte.

Kapitel ärver albumets standardprofil för manustrohet, tempo, oberoende fokusprioriteringar, instruktion och skyddade ögonblick tills användaren gör egna kapitelval. Relevanta karaktärs- och platsbeskrivningar godkänns separat; användaren granskar när fakta gäller. Profilen är en instruktion, inte en garanti för korrekt urval.

Piloten arbetar med en scen åt gången. Scenen måste vara innehållsfylld, granskad och motsvara en entydig oförändrad passage i arbetskopian. A skickar scenprosa samt namn/ID:n. B lägger till godkänt synopsis, Brief, sceninstruktion, kapitelprofil och godkända fakta. B får använda helhetskunskap för urval men inte avslöja framtida händelser i scenen. Båda använder befintlig beatprompt, lokal transport och källsegmentsvalidering. Varje körning är ett separat uttryckligt anrop. En försiktig storleksuppskattning reserverar plats för svar och avvisar för stora anrop före nätverk; faktisk tokenisering beror på modellen. Kontextstorleken höjs aldrig automatiskt och ingen helboksanalys körs.

A/B-resultat, testförutsättningar, exakt källtext, val, tilläggsstatus och bedömningsanteckningar sparas separat i albumet och backup. Skilda testförutsättningar markeras. Okända karaktärs- och platsreferenser i pilotresultat blir granskningsvarningar, utan att nya entiteter skapas automatiskt. Vanliga befintliga AI-anrop behåller sin strikta ID-validering. Valda förslag läggs till först efter användarens uttryckliga val genom befintligt manus-/bildmanusflöde. Ändrad källtext blockerar tillägg från äldre resultat. Escape, avbrott och sena svar bevarar tidigare resultat och befintligt arbete. Verklig urvalskvalitet prövas av användaren med sin lokala modell; automatiserade tester använder syntetiska svar.

### Kapitelpilot: AI-diagnostik (2026-10-22)
Varje ny pilotkörning sparar det faktiska request-innehållet (systeminstruktion, segment, underlag och tokeninställningar), råsvaret och servermetadata. Även avklippta svar och tolkningsfel sparas som misslyckade tester med tom beatlista. Utfällbar AI-diagnostik visar dessa lokalt, utan extra modellförfrågan. Avbrutna eller inaktuella körningar lägger inte till resultat. Äldre tester fungerar men saknar diagnostik.

### Kapitelpilot C: enbart urval (2026-10-22)
Separat granskningsläge med en kort fast prompt: ett anrop över den valda scenen och godkänt berättelseunderlag. Endast källintervall, sammanfattning och berättelsefunktion begärs; inga bildbeskrivningar, typer eller karaktärs-/plats-ID:n. Resultatet sparas som C med diagnostik och backupstöd men kan inte appliceras som panelplaner. A/B och användarens sparade beatprompt bevaras. Inga automatiska följdanrop, ändrad kontextstorlek eller nya modeller.

### Kapitelpilot D: läsförståelse (2026-10-22)
Ett separat test skickar endast vald scenprosa, numrerad som i A/B/C, och en fast kort prompt. Modellen besvarar nutida plats/förflyttning, minnen/tidigare händelser och praktisk eller känslomässig förändring. Varje svar har segment-ID:n som visas med exakt källtext. Resultat och diagnostik sparas lokalt och i backup; de är modellens tolkning, inte verifierat facit. Inga beats, paneler, följdanrop eller ändrad kontextstorlek. Befintliga testlägen bevaras.

### Granskad läsförståelse till urval (2026-10-22)
D-resultat kan granskas i en separat redigerbar kopia av svar och segmentreferenser. Explicit spara/godkänn krävs; ändringar återkallar godkännandet. Ett separat knapptryck kör C med den granskade förståelsen, vald scen och aktuellt godkänt berättelseunderlag. Ett anrop; ingen automatisk kedja. C sparar D-testets ID och en oföränderlig kopia av det använda underlaget i inputs. Original-D och råsvar bevaras. Felaktiga, ej godkända, inaktuella eller andra sceners D-resultat kan inte användas.

### C inventerar före urval (2026-10-22)
Nya C-körningar inventerar betydelsebärande passager i källordning utan rangordning eller slutligt beaturval. Kontraktet är passages med from/to, kort sammanfattning och berättelsefunktion, högst 12 kompakta poster inom befintlig svarsbudget. Inga bokdetaljer hårdkodas. Samma godkända berättelseunderlag och eventuell granskad D-kopia används, i ett anrop och med oförändrad kontext. inputs.selectionTask=inventory skiljer nya körningar från historiska C-urval, som behåller sin ursprungliga märkning och data. Inventeringen är fortfarande endast för granskning; automatisk sammanslagning eller panelgenerering införs inte.

### C kopplar scenens syfte till källstöd (2026-10-22)
Nya C-körningar använder godkänd sceninstruktion för att identifiera högst fyra lokala syften och upp till tre stödjande passager per syfte. Kapitelbrief, synopsis och eventuell granskad D-kopia ger bakgrund, inte framtida handling att införa i scenen. Saknat eller ofullständigt stöd redovisas uttryckligen. Metoden märks scene-purpose; historiska urval och inventeringar behålls. Ett anrop med oförändrad kontext/svarsgräns. Ett JSON-schema skickas i Ollamas format respektive OpenAI-kompatibel response_format; antal poster, textlängder och tillåtna segment-ID:n begränsas. Lokal validering kontrollerar också intervall och luckor innan något sparas. Ingen automatisk retry eller fallback; servern måste stödja strukturerade svar. Formatkontroll garanterar inte korrekt tolkning.

### Fasta granskade scensyften i C (2026-10-22)
Scenen har ett redigerbart fält med 1–4 fasta syften, ett per rad, baserat på sceninstruktionen. Användaren måste godkänna dem. Ändringar av syften eller ändrad/ej godkänd sceninstruktion kräver nytt godkännande. C skickar den fasta listan och begär bara källstöd eller luckor. Schemat har en obligatorisk numrerad post för varje syfte; lokalt återförs de ursprungliga syftestexterna och kontrolleras täckning, segmentgränser och dubbla intervall inom ett syfte. Syftena sparas i testets inputs och märks fixed-scene-purpose; historiska tester bevaras. Inga bokspecifika syften hårdkodas, inga extra AI-anrop och ingen ändrad kontextstorlek.

### Manusets scener och adaption (2026-10-22)
ManuscriptScenes är separata från äldre bild/scenbiblioteket och pilotens råa importunderlag. StoryBook-scener med prosa kopieras lokalt med stabila käll-ID:n, titel och syfte; tomma scener hoppas över. Varje representerad scen får ett startbeat om kopplade beats saknas. Startbeats är platsmarkörer och skapar inga automatiska paneler. Tidigare beats och bilder bevaras, och osäkra textkopplingar markeras för granskning. I manusdelen kan markerad text skapa en lokal scen med namn, obligatoriskt syfte och valfritt viktigt-att-bevara. Båda sorterna har samma editor, explicita utelämningsstatus, källtext, beatkopplingar och möjlighet att återkoppla markering. Källredigering flyttar ankare och flaggar överlappande ändringar. Scen-AI använder endast vald prosa plus syfte, bevarandekrav och godkänd synopsis/Brief i ett manuellt startat anrop. Förslag granskas före applicering och tar bara bort oanvända startplatshållare. Metadata- eller källändring spärrar gamla förslag. Pilotens tester kvarstår som avancerat verktyg. StoryBook-lagring berörs inte.

### Kort scenprompt för definierade scener (2026-10-22)
Scenknappen använder en egen kompakt anpassningsprompt eftersom textgränser och avsikt redan är fastställda. Den återanvänder inte den längre generella upptäcktsprompten från Settings. Godkänd synopsis, Brief och scenens syfte/bevarandekrav skickas fortfarande, med oförändrad kontext/svarsgräns och ett anrop. Generell analys och pilotens promptinställningar bevaras. Budgetfel hänvisar inte längre felaktigt till piloten.

### Täckning av scenavsikt i normal scenadaption (2026-10-22)
Samma manuellt startade anrop som föreslår beats ska redovisa täckning för scenens hela syfte och valfria bevarandekrav. Varje krav återförs lokalt från indatan och länkas till föreslagna beats; saknade/ogiltiga rapporter, luckor och bortvalda stödbeats visas som ofullständiga. Textändringar i förslag kräver ny manuell granskning av rapporten. Modellens självbedömning är inte semantisk verifiering; användaren får granska och välja att använda även ofullständiga förslag. Ingen automatisk omkörning, större kontext eller bokspecifik hårdkodning införs.

### Kompakt kontrakt för scenens täckningsrapport (2026-10-22)
Scenadaption med täckningskrav använder ett sammanhållet kort kontrakt i stället för att stapla generella instruktioner, scenprompt och täckningsinstruktioner. Hela godkända underlaget behålls. Budgetkontrollen, kontextstorleken och svarsgränsen är oförändrade. Regressionstest omfattar en hel syntetisk scen, synopsis och namn/ID:n för åtta personer och sex platser vid 8192 kontext, samt avvisning av verkligt för stort underlag utan nätverksanrop.

### AI-diagnostik för normal scenanalys (2026-10-22)
Under scenförslagen visas utfällbar diagnostik från samma anrop: hela skickade förfrågan, rå textsvar före bearbetning, serversvar och metadata, kontext/svarsgräns och avslutsorsak. Diagnostik finns även vid tolkningsfel eller avklippt svar. Ingen extra AI-förfrågan görs. Endast senaste analysen i den öppna manusvyn behålls i minnet; den rensas vid ny analys, kapitelbyte eller stängd vy och ingår inte i albumbackup. Sena eller avbrutna svar får inte ersätta aktuell diagnostik. Befintligt arbete påverkas inte.

### Scenanalys med enbart urval (2026-10-22)
Normal scenanalys begär nu endast from/to, kort sammanfattning och berättelsefunktion. Godkänd synopsis/Brief och scenens syfte/bevarandekrav behålls, men karaktärs-/platslistor, bildbeskrivningar, klassificering och självvärderad täckning begärs inte. Granskningen visar källstödet och funktionen; bildregi och entiteter hanteras efter urvalet. Lokala beats har tom bildkandidatlista och tomma entitetskopplingar samt Reaktion som tydligt märkt starttyp. Felaktiga källintervall och identiska upprepade sammanfattningar avvisas utan applicering. Samma manuella anrop, diagnostik och oförändrade budgetgränser används. Pilot och generell beat-analys behåller sina tidigare kontrakt. Ingen garanti för semantisk urvalskvalitet ges.

### Slå ihop granskade beatförslag (2026-10-22)
I normal förslagsgranskning är Markera för sammanslagning separat från Ta med. Minst två intilliggande, inkluderade förslag med aktuellt källstöd i samma scen/kapitel kan sammanföras utan AI-anrop. Förhandsgranskningen visar hela omslutande källintervallet (även eventuell text mellan förslagen) och redigerbar titel, sammanfattning och berättelsefunktion. Spara ändrar bara utkastet, inte albumet. Första förslagets ID bevaras; dialog, bildkandidater, källtext och entiteter bevaras/samlas, medan motstridiga platser lämnas ospecificerade. Ångra återställer senaste sammanslagningen innan ytterligare beatredigering. Ny analys och kapitelbyte rensar sammanslagningsutkast. Inaktuellt underlag eller ändrade förslag spärrar sparning. Vanligt explicit tillägg krävs fortfarande och befintliga beats, paneler och bilder påverkas inte.

### Panelantal efter sammanslagning (2026-10-22)
Sammanslagna beatförslag börjar med targetPanelCount=1. Ursprungliga förslags panelantal summeras inte, eftersom sammanslagningen inte definierar skilda bildögonblick och annars gav identiska panelbeskrivningar. Fler paneler planeras uttryckligen senare. Befintliga paneler och bilder rensas inte automatiskt.
