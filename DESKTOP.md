# ComicBook AI — Windows-prototyp med Tauri 2

Desktopskalet kör samma React-app som webbversionen i ett eget fönster. Detta första steg behåller IndexedDB, återställningspunkter och albumbackup. Projektmappar och separata bildfiler är ett senare steg. StoryBook påverkas inte.

## Förbered datorn en gång

Installera följande enligt [Tauris Windows-förutsättningar](https://v2.tauri.app/start/prerequisites/#windows):

1. Node.js LTS med npm.
2. Microsoft C++ Build Tools med arbetsbelastningen **Desktop development with C++**, inklusive Windows SDK.
3. Rust via rustup, med standardverktygskedjan **MSVC** och Rust 1.90 eller senare. Uppdatera en äldre installation med `rustup update stable`.
4. Microsoft Edge WebView2 Runtime, om den inte redan finns på datorn.

Öppna en ny PowerShell efter installationen. Kontrollera med `node --version`, `npm --version`, `rustc --version` och `cargo --version`.

## Starta utvecklingsversionen

Kör i repositoryts rotmapp:

```powershell
npm install
npm run desktop:info
npm run desktop:dev
```

Tauri startar själv Vite på port 5176. Stäng en redan körande `npm run dev` innan du startar desktopkommandot. Första starten hämtar Rust-paket och kompilerar desktopappen och tar längre tid. Avsluta utvecklingskörningen med Ctrl+C i terminalen.

Vanlig webbutveckling fungerar fortsatt med `npm run dev`.

## Flytta över befintliga album

Webbläsaren, Tauri-utvecklingsfönstret och den installerade appen har skilda lagringsmiljöer. En tom startsida i desktopappen innebär inte att webbläsarens album har raderats.

1. Öppna det befintliga albumet i den vanliga webbläsaren.
2. Välj **Backup → Create backup… / Skapa säkerhetskopia…** och behåll filen.
3. Öppna desktopappen och välj **Restore backup… / Återställ säkerhetskopia…**.
4. Kontrollera manus, sidor, bilder och panelpool. Stäng och starta desktopappen igen och kontrollera att albumet finns kvar.

Gör detta per album. Egna stilmallar, AI-inställningar och andra appinställningar följer inte automatiskt med albumbackupen. Utvecklingsversionens album överförs inte automatiskt till releaseversionen heller; använd samma backupflöde.

Appens identifierare `com.ocedo.comicbookai` ska behållas vid framtida uppdateringar. Ändra inte WebView-profil eller origin för att flytta data. Fortsätt skapa separata backupfiler även i desktopappen. Tauri-skalet löser inte i sig orsaken till den tidigare rapporterade projektförlusten.

## Bygg en Windows-installationsfil

Kör på Windows efter att förutsättningarna ovan installerats:

```powershell
npm run desktop:build
```

Kommandot bygger frontend, Rust-appen och en NSIS-installationsfil i `src-tauri/target/release/bundle/nsis/`. Installationen gäller aktuell användare. Om WebView2 saknas hämtar installationsprogrammet dess bootstrapper, vilket kräver internet. Den installerade appens lokala redigering kräver ingen Vite-server.

Prototypen är osignerad; Windows kan visa en varning om okänd utgivare. Kodsignering och automatisk uppdatering ingår inte i detta steg. Cargo skapar `src-tauri/Cargo.lock` vid första Rust-bygget; låsfilen ska därefter checkas in efter ett verifierat Windows-bygge för reproducerbara Rust-beroenden.

## Kontrollera före skarp användning

Den första Windows-körningen ska verifiera:

- Skapa ett testalbum med text, bilder, omslag och förgrundsbild. Stäng/starta appen och kontrollera innehållet.
- Skapa en backup, kontrollera att filen faktiskt sparas, och återställ den som ett separat album. Testa även lokal återställning.
- Dra paneler inom sidan, till panelpoolen och till en annan sida. HTML-dragning är uttryckligen aktiverad genom `dragDropEnabled: false` i Tauri-konfigurationen.
- Exportera PNG, PDF och IDML/ZIP och öppna de sparade filerna. Hämtningsdialog och destination ska kontrolleras i WebView2.
- Prova färgväljare, textredigering, typsnitt och stilbilder/lightbox.
- Starta appen en andra gång: det redan öppna fönstret ska fokuseras, utan en andra redigeringsinstans.
- Testa installerad version separat, inklusive omstart och lokal redigering utan internet.

Lokal AI använder samma användarvalda adresser som webbversionen. AI-serverns CORS-inställningar behöver tillåta appens origin: `http://tauri.localhost` i den paketerade Windows-appen och `http://localhost:5176` under utveckling. Se [LOCAL_AI.md](LOCAL_AI.md). Ingen AI-anropning startar enbart för att appen öppnas.

## Säkerhetsgränser och byggstatus

Frontend får inga native-rättigheter för filsystem, terminal eller processer. Filval och hämtningar använder befintliga WebView-funktioner. CSP tillåter lokala resurser och inbäddade bilder; HTTP/HTTPS-anslutningar tillåts för användarvalda AI-servrar. CORS gäller fortfarande. Endast utvecklingspolicyn tillåter Vites inline-skript och lokala WebSocket för omladdning.

Desktopkonfigurationen och webbbygget kan kontrolleras utan Rust. Denna första implementation har inte kompilerats eller körts som Windows-app i utvecklingsmiljön, där Rust och Windows saknas. En färdig eller testad installationsfil ingår därför inte ännu. Följ kontrollistan ovan innan riktiga album används som enda kopia.
