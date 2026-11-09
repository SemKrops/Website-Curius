# Website Curius

De nieuwe website van S.V.T.B. Curius, de studievereniging van Technische Bestuurskunde in Delft.

De inhoud blijft gewoon in Genkgo staan en wordt daar ook aangepast. Deze site haalt elk uur alles op van
[curius.nl](https://www.curius.nl) en toont het in een nieuw ontwerp, met een overzichtelijk menu, zoeken over de
hele site en een agenda die je in je eigen kalender kunt zetten.

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

Inloggen, Mijn Curius, inschrijven voor activiteiten en formulieren blijven in Genkgo. De knoppen daarvoor op de
nieuwe site gaan naar de site in Genkgo.

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

## Instellingen

Alles werkt zonder instellingen. Aanpassen kan met deze omgevingsvariabelen:

| Variabele            | Standaard               | Wat het doet                                                        |
| -------------------- | ----------------------- | ------------------------------------------------------------------- |
| `BRON_URL`           | `https://www.curius.nl` | De site in Genkgo waar de inhoud vandaan komt.                      |
| `LEDEN_URL`          | gelijk aan `BRON_URL`   | Waar leden inloggen en zich inschrijven.                            |
| `SITE_URL`           | GitHub Pages            | Het adres van de nieuwe site (vult GitHub Actions zelf in).         |
| `BASE_PATH`          | `/`                     | De map van de site op dat adres (vult GitHub Actions zelf in).      |
| `BRON_CACHE_MINUTEN` | `0`                     | Hoe lang een bewaarde pagina gebruikt wordt zonder opnieuw te halen. |
| `BRON_TEGELIJK`      | `4`                     | Hoeveel pagina's tegelijk worden opgehaald.                         |

In GitHub zet je `BRON_URL` en `LEDEN_URL` bij **Settings**, **Secrets and variables**, **Actions**, tabblad
**Variables**.

## Overstappen naar www.curius.nl

Als www.curius.nl naar deze nieuwe site moet wijzen:

1. Zorg dat de site in Genkgo bereikbaar blijft op een eigen adres, bijvoorbeeld `https://curius.genkgo.app`.
2. Zet in GitHub de variabelen `BRON_URL` en `LEDEN_URL` op dat adres (zie hierboven).
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
| `src/lib`           | Teksten, de agenda (`.ics`) en kleine hulpjes                 |
| `src/components`    | De onderdelen van het ontwerp: kop, menu, kaarten, voet       |
| `src/pages`         | Welke pagina's er gemaakt worden                              |
| `src/styles`        | Kleuren en opmaak                                             |
| `public`            | Logo's en het icoon van de site                               |
| `tests`             | De tests, met voorbeelden van echte pagina's                  |
