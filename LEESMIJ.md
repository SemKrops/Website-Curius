# Website Curius

De nieuwe website van S.V.T.B. Curius, de studievereniging van Technische Bestuurskunde in Delft.

De inhoud blijft gewoon in Genkgo staan en wordt daar ook aangepast. Deze site haalt elk uur alles op van
[curius.nl](https://www.curius.nl) en toont het in een nieuw ontwerp, met een overzichtelijk menu, zoeken over de
hele site en een agenda die je in je eigen kalender kunt zetten. Leden loggen in op de site zelf, via de server van
de Curius app.

## Hoe het werkt

1. **Ophalen.** De code in `src/bron` leest de pagina's van curius.nl: het menu, alle pagina's uit het menu, de
   activiteiten, het nieuws, de commissies, de vacatures en de partners. Een opgehaalde pagina wordt bewaard in
   `.cache/bron`. Lukt het ophalen een keer niet, dan wordt de vorige versie gebruikt.
2. **Omzetten.** Links naar de oude site worden links binnen de nieuwe site, Nederlandse en Engelse pagina's
   worden aan elkaar gekoppeld en elke pagina krijgt een kruimelpad.
3. **Bouwen.** [Astro](https://astro.build) maakt van elke pagina een HTML bestand. De adressen zijn hetzelfde als
   op de oude site (`/nl/...` en `/en/...`), dus oude links en QR codes blijven werken.
   [Pagefind](https://pagefind.app) maakt daarna de zoekindex.
4. **Publiceren.** GitHub Actions doet dit bij elke wijziging in de code en verder elk uur, en zet het resultaat
   op GitHub Pages (zie `.github/workflows/website.yml`).

## Inhoud aanpassen

Pas de inhoud aan in Genkgo, zoals je gewend bent. Binnen een uur staat het op de nieuwe site.

Moet het sneller? Ga naar het tabblad **Actions**, kies **Website** en klik op **Run workflow**.

## Leden

Leden loggen in op de nieuwe site met hun Curius account, net als in de app. Daarna kunnen ze:

* zich inschrijven en uitschrijven op de pagina van een activiteit, en zien wie er nog meer gaan;
* in **Mijn Curius** hun gegevens en pasfoto aanpassen, zien waar ze voor zijn ingeschreven, leden zoeken en een
  declaratie indienen;
* de fotoalbums bekijken (onder Media).

Iedereen (ook wie geen lid is) kan op de site zelf de formulieren invullen die op curius.nl staan: lid worden,
contact en wachtwoord vergeten. De velden komen van het formulier in Genkgo, dus een veld dat het bestuur daar
toevoegt, staat vanzelf ook op de nieuwe site. Versturen gaat via dezelfde server, die het formulier op curius.nl
invult. De som tegen robots van curius.nl staat er ook: die rekent de bezoeker zelf uit. Na het versturen ziet de
bezoeker de tekst die het bestuur in Genkgo bij het formulier onder Afhandeling heeft ingevuld.

Dit gaat allemaal via de server van de Curius app (de repository `studievereniging-curius`, map `server`). De
website zelf is een gewone site zonder database: pas als iemand inlogt, haalt de browser de gegevens op bij die
server. De browser bewaart alleen een sessie (een token), nooit het wachtwoord. De Genkgo API key staat alleen op de
server.

Goed om te weten:

* **Staat de server uit,** dan zien leden bij inloggen een melding dat er geen verbinding is. De rest van de site
  werkt gewoon.
* **Verloopt de inlog op curius.nl** (bijvoorbeeld na een herstart van de server), dan vraagt de site het
  wachtwoord nog een keer, net als de app.
* **Formulieren** werken pas als de server de nieuwste versie heeft (met `/formulieren`). Tot die tijd, en als
  de server even niet bereikbaar is, staat er een knop naar het formulier op de site in Genkgo.
* Op een computer zonder server kun je alles proberen met de proefserver, zie hieronder.

## Zelf draaien

Je hebt [Node.js](https://nodejs.org) 22.23.4 of nieuwer nodig.

```sh
npm install
npm run dev       # de site op http://localhost:4321, haalt de inhoud op bij het starten
npm run build     # de hele site in de map dist
npm test          # de tests
npm run verzamel  # alleen de inhoud ophalen, met een overzicht van wat er gevonden is
```

Tip voor tijdens het ontwikkelen: `BRON_CACHE_MINUTEN=120 npm run dev` gebruikt twee uur lang de bewaarde pagina's,
zodat niet bij elke start alles opnieuw wordt opgehaald.

### Inloggen proberen met de proefserver

De proefserver doet alsof hij de server van de app is, met verzonnen leden. Er gaat niets naar Genkgo.

```sh
npm run proefserver                                  # in een eigen venster, op http://localhost:4400
SERVER_URL=http://localhost:4400 npm run dev         # de site, met inloggen via de proefserver
```

Log in met gebruikersnaam `lid` en wachtwoord `curius`. Met `PROEF_SITE_VERLOPEN=1 npm run proefserver` doet hij
alsof de inlog op curius.nl verlopen is, zodat je kunt zien dat de site dan het wachtwoord nog een keer vraagt.

De formulieren (contact, lid worden, wachtwoord vergeten) werken ook met de proefserver. De velden staan in
`scripts/proefformulieren.json`, zoals de echte server ze van curius.nl leest. Wachtwoord vergeten kent alleen
`lid`. Typ ergens `verloopt` in een veld om te zien wat er gebeurt als een formulier te lang open heeft gestaan, en
start hem met `PROEF_FORMULIEREN_WEG=1` om te zien wat bezoekers zien als curius.nl even niet bereikbaar is.

## Instellingen

Alles werkt zonder instellingen. Aanpassen kan met deze omgevingsvariabelen:

| Variabele            | Standaard               | Wat het doet                                                        |
| -------------------- | ----------------------- | ------------------------------------------------------------------- |
| `BRON_URL`           | `https://www.curius.nl` | De site in Genkgo waar de inhoud vandaan komt.                      |
| `LEDEN_URL`          | gelijk aan `BRON_URL`   | Waar links heen gaan voor wat alleen in Genkgo staat.               |
| `SERVER_URL`         | de server van de app    | De Curius server waarmee leden inloggen (`https://curius.tailbb09ca.ts.net`). |
| `SITE_URL`           | GitHub Pages            | Het adres van de nieuwe site (vult GitHub Actions zelf in).         |
| `BASE_PATH`          | `/`                     | De map van de site op dat adres (vult GitHub Actions zelf in).      |
| `BRON_CACHE_MINUTEN` | `0`                     | Hoe lang een bewaarde pagina gebruikt wordt zonder opnieuw te halen. |
| `BRON_TEGELIJK`      | `4`                     | Hoeveel pagina's tegelijk worden opgehaald.                         |

In GitHub zet je `BRON_URL`, `LEDEN_URL` en `SERVER_URL` bij **Settings**, **Secrets and variables**, **Actions**,
tabblad **Variables**. Krijgt de server van de app een ander adres, pas dan `SERVER_URL` aan.

## Overstappen naar www.curius.nl

Als www.curius.nl naar deze nieuwe site moet wijzen:

1. Zorg dat de site in Genkgo bereikbaar blijft op een eigen adres, bijvoorbeeld `https://curius.genkgo.app`.
2. Zet in GitHub de variabelen `BRON_URL` en `LEDEN_URL` op dat adres (zie hierboven), en op de server van de app
   `SITE_URL` in `server/.env` ook (anders vinden de app en de formulieren curius.nl niet meer).
3. Vul bij **Settings**, **Pages** het eigen domein in en pas de DNS aan zoals GitHub daar uitlegt.

De nieuwe site gebruikt dezelfde adressen als de oude, dus links van buitenaf blijven werken.

## Goed om te weten

* **Elk uur bijwerken stopt na 60 dagen stilte.** GitHub zet de uurlijkse bouw uit als er 60 dagen niets in deze
  repository is veranderd. Je krijgt dan een mail. Zet hem weer aan in het tabblad **Actions** (of doe een kleine
  wijziging in de code).
* **Verandert Genkgo de opmaak van de oude site,** dan kan het lezen van een pagina misgaan. De tests in
  `tests/lezen.test.mjs` controleren dat met echte pagina's van curius.nl (in `tests/voorbeelden`). Mislukt de bouw,
  dan blijft de laatste goede versie van de site gewoon online.
* **Ontbrekende afbeeldingen.** Een paar afbeeldingen ontbreken op de oude site. De nieuwe site toont dan het
  borstbeeld van Curius in plaats van een kapot plaatje.

## Mappen

| Map                 | Inhoud                                                        |
| ------------------- | ------------------------------------------------------------- |
| `src/bron`          | Ophalen en lezen van curius.nl                                |
| `src/lib`           | Teksten, de agenda (`.ics`), inloggen en kleine hulpjes       |
| `src/lib/mijn`      | De pagina's van Mijn Curius (draaien in de browser)           |
| `scripts`           | Inhoud ophalen en de proefserver                              |
| `src/components`    | De onderdelen van het ontwerp: kop, menu, kaarten, voet       |
| `src/pages`         | Welke pagina's er gemaakt worden                              |
| `src/styles`        | Kleuren en opmaak                                             |
| `public`            | Logo's en het icoon van de site                               |
| `tests`             | De tests, met voorbeelden van echte pagina's                  |
