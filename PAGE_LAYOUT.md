# Rutor och hörnhandtag

Öppna **Sidor** och klicka på en befintlig ruta. Fyra hörnhandtag och sidans rutnät visas. Dra ett hörn för att ändra bredd och höjd samtidigt. Hörnen fäster vid rutnätets cellgränser; motsatt hörn ligger kvar.

Rutan förblir rektangulär. Breda panoramarutor och stående rutor kan blandas på samma sida. Storleken begränsas till sidans rutnät och minst en cell i varje riktning. Ändringar som skulle överlappa en annan ruta avvisas.

- Klicka utanför rutan för att dölja handtagen och rutnätet.
- Fokusera ett hörnhandtag och använd piltangenterna för att flytta hörnet ett rutnätssteg.
- Tryck Escape under en dragning för att återställa rutans tidigare storlek.
- Dra över tom yta för att skapa en ny ruta.
- Dubbelklicka på en ruta för att redigera bildens beskärning och dess textlager.

Rutans ID, koppling till manus, läsordning, bild och textlager bevaras vid storleksändring. Bilden visas i den nya rektangeln med sin befintliga beskärningsinställning. Textlagrets relativa koordinater följer rutans storlek. Storleksändring startar ingen AI-generering.

Fria hörn, sneda rutor och polygonformer ingår inte i detta första steg.

## Rutbibliotek i Sidor

Rutorna från manusvyn finns automatiskt i **Rutbibliotek** bredvid sidan, med rubrik och bild när en sådan lagts till. Rita en tom bildruta eller markera en befintlig tom ruta och klicka på innehållet i biblioteket. Nya bildrutor markeras direkt efter ritning. Du kan också välja bildruta i bibliotekets lista.

Bilden, dialogen och berättartexten följer med. Texten blir redigerbara textlager; dubbelklicka på bildrutan för att justera dem. Befintliga bilder och textlager i bildrutan bevaras. Placeringen är en sparad kopia; senare ändringar i manusrutans text skriver inte över sidans redigerade textlager.

Placerade rutor visar sidnummer och kan filtreras bort med **Visa bara oplacerade**. En redan placerad ruta kan inte väljas igen i biblioteket. Tar du bort bildrutan från sidan blir innehållet tillgängligt i biblioteket igen. Rutans bild och manusinnehåll finns kvar.

## Text och standardvärden

Dubbelklicka på en bildruta och öppna **Standardvärden för text och bubblor** i verktygspanelen. Pratbubbla, tankebubbla, berättartext och ljudeffekt har varsin inställning för rundning, font, textstorlek, textvikt, justering och sidmarginal. Värdena sparas i albumet och används för nya textlager, även vid placering från rutbiblioteket. Befintliga lager ändras inte.

Varje markerat textlager kan också få egen **Textjustering** (vänster, centrerad eller höger) och **Sidmarginal (%)**. Sidmarginalen är som standard 4 procent av textlagrets bredd på varje sida. Enter och tomma rader i textfältet återges i bildrutan. Långa rader radbryts automatiskt; texten kapas inte efter sju rader. Öka textrutans höjd eller minska textstorleken om texten inte ryms.

## Albummeny och backup

När ett album är öppet visas en andra menyrad under appens huvudmeny. Den visar albumets titel och antal sidor/rutor. **Albuminställningar** samlar titel, bildstil, linjeprompter, rutnät för nya sidor och standardvärden för text och bubblor. Ändringar sparas automatiskt; sidstandarden ändrar inte befintliga sidlayouter.

**Backup** skapar en lokal `.json`-fil med hela albumet, inklusive manus, adaptationsdata, bilder och bildhistorik, sidor, textlager, bubbelpaletter och albuminställningar. Filen innehåller inga globala AI-serverinställningar. Bilderna är inbäddade i prototypens backupfil.

**Återställ backup** låter dig välja fil och granska titel och omfattning innan **Öppna som nytt album** skapar en separat kopia. Befintliga album ersätts inte. Återställning finns även under **Projekt → Återställ albumbackup**, när inget album är öppet. Ogiltiga filer och lagringsfel lämnar befintliga album orörda. **Stäng album** återgår till albumlistan.
