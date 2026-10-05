# Rutor och hörnhandtag

Öppna **Sidor** och klicka på en befintlig ruta. Fyra hörnhandtag och sidans rutnät visas. Dra ett hörn för att ändra bredd och höjd samtidigt. Hörnen fäster vid rutnätets cellgränser; motsatt hörn ligger kvar.

Storleksändringen behåller rutans valda form. Breda panoramarutor och stående rutor kan blandas på samma sida. Storleken begränsas till sidans rutnät och minst en cell i varje riktning. Ändringar som skulle överlappa en annan ruta avvisas.

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

## Startpunkt för svans och bubbelkedja

Markera en pratbubbla eller tankebubbla i bildrutans editor. Handtaget vid konturen flyttar svansens eller bubbelkedjans start runt bubblan. Det yttre handtaget flyttar slutpunkten. Starten fäster vid konturen och följer med när textlagret flyttas eller ändrar storlek. Startbredd och böjning styrs separat av de numeriska fälten.

## SFX-bibliotek

Välj **Lägg till SFX** i bildrutans editor, eller byt ett textlagers typ till SFX. Välj sedan en miniatyr i **SFX-bibliotek**: enbart text, explosion, smäll, puff, blixt, fartstreck, svep, spiral, stjärna, stjärnkluster, utrop, frågetecken, hjärta eller pil. Formerna är egna SVG-original.

Texten är fortsatt redigerbar och kan döljas med **Visa text** utan att raderas. Storlek och proportioner ändras med lagrets hörnhandtag; rotation anges numeriskt. Fyllning, konturfärg, linjetjocklek och textfärg kan ställas separat. Val och inställningar sparas med textlagret och följer med albumbackupen. Befintliga SFX-lager visas som enbart text tills en form väljs.

## Sidans bakgrund

I **Sidor → Sidans bakgrund** kan du ge sidan en bild som fyller hela ytan, under de vanliga bildrutorna. **Välj från rutbiblioteket** markerar bakgrunden som mål; välj sedan ett oplacerat innehåll i biblioteket. Bild, dialog och berättartext följer med som en redigerbar kopia, precis som för vanliga rutor. Biblioteket räknar också innehåll i bakgrunden som placerat.

**Redigera bakgrund och text** öppnar bildredigeraren. Använd **Ladda upp bild…** eller **Byt bild…**, justera beskärning, zoom och position och lägg till pratbubblor, tankebubblor, berättartext eller SFX direkt på sidan. Bakgrunden är ett eget lager och tar ingen plats i rutnätet. Du kan ha bara bakgrunden eller valfritt antal vanliga bildrutor ovanpå.

**Ta bort bakgrund** kräver bekräftelse och tar bort bakgrundslagret med dess textlager. Bildrutorna ovanpå och originalinnehållet i rutbiblioteket finns kvar. Bakgrund, beskärning och textlager sparas med albumet och ingår i backup och återställning.

## Rutans form

Markera en bildruta på sidan och välj **Rutans form**: rektangel, romb, parallellogram, trapets eller triangel. Välj **Redigera form** för att flytta hörnen. Varje enkelpanel i sidans rutnät delas i 4×4. En bildruta som täcker 3 kolumner och 5 rader får därför 12×20 delningar och 13×21 fästpunkter. En ruta på en enda cell har 25 punkter. Fästnätet blir tätare när rutan täcker fler celler. Hörnen fäster vid närmaste punkt; piltangenterna flyttar ett steg. Escape eller avbruten pekardragning ångrar den pågående dragningen. Korsande hörn och kollapsade former tillåts inte.

**Klar med formen** återgår till handtagen för rutans storlek. Formen sparas relativt bildrutan och följer med när dess storlek ändras. Bilder och textlager beskärs efter polygonen i sidvy, bildredigerare och PDF/PNG/JPEG-export. Punktstorleken på text påverkas inte av formvalet. Formen ingår i albumbackupen; äldre rutor är rektangulära. Sidbakgrunden behåller hela sidans form.

## Passa kanten mot en grannruta

Två polygonrutor kan dela samma celler i sidans rutnät. Placering, storleksändring och formändring kontrollerar polygonernas synliga konturer inklusive linjebredden. De omslutande rektanglarna får överlappa när formerna inte gör det.

För exemplet med ruta 5 till vänster om en sned ruta 1: markera ruta 5, välj **Grannruta → Ruta 1**, **Placera på sidan → Till vänster** och en marginal, exempelvis **2 mm**. Klicka **Passa kanten**. Ruta 5 utökas i bredd och får en högerkant parallell med ruta 1:s vänsterkant. Marginalen mäts vinkelrätt mellan de synliga ramarna. Motsvarande passning finns åt höger, ovanför och under.

Passningen ändrar endast den valda rutans utbredning och polygon. Grannrutan, rutans bild, textlager och läsordning behålls. Formen sparas med albumet, backupen och exporten. Passa kanten igen efter ändringar av grannrutan. Om formen inte ryms eller träffar en tredje ruta visas ett meddelande och ingen ändring görs.
