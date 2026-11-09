// Instellingen voor het ophalen van de inhoud van de huidige site.
//
// Alles kan worden aangepast met omgevingsvariabelen (bijvoorbeeld in GitHub
// Actions). Zonder variabele gelden de standaardwaarden hieronder.

const lees = (naam, standaard) => (process.env[naam] ?? '').trim() || standaard;
const zonderSlash = (url) => url.replace(/\/+$/, '');

// De site waar de inhoud vandaan komt: de site in Genkgo. Wijst curius.nl later
// naar deze nieuwe website, zet dan BRON_URL op https://curius.genkgo.app.
export const BRON_URL = zonderSlash(lees('BRON_URL', 'https://www.curius.nl'));

// Waar links naartoe gaan voor wat (nog) alleen op de site in Genkgo werkt, zoals de
// formulieren. Standaard hetzelfde als BRON_URL.
export const LEDEN_URL = zonderSlash(lees('LEDEN_URL', BRON_URL));

// De server van de Curius app. Daarmee loggen leden in op de website, schrijven ze
// zich in voor activiteiten en werkt Mijn Curius. De Genkgo API key staat alleen op
// die server, nooit in de website.
export const SERVER_URL = zonderSlash(lees('SERVER_URL', 'https://curius.tailbb09ca.ts.net'));

// Opgehaalde pagina's worden bewaard in deze map. Mislukt het ophalen van een
// pagina, dan gebruikt de bouw de laatst bewaarde versie.
export const CACHE_MAP = lees('BRON_CACHE_MAP', '.cache/bron');

// Hoe lang een bewaarde pagina goed blijft (in minuten). 0: altijd opnieuw
// ophalen. Handig tijdens het ontwikkelen: BRON_CACHE_MINUTEN=120.
export const CACHE_MINUTEN = Number(lees('BRON_CACHE_MINUTEN', '0')) || 0;

// Hoeveel pagina's tegelijk worden opgehaald. Niet te hoog: het is de site van Curius.
export const MAX_TEGELIJK = Math.max(1, Number(lees('BRON_TEGELIJK', '4')) || 4);

export const TALEN = ['nl', 'en'];

// Adressen die bij de site in Genkgo horen. Links daarheen worden, als de pagina
// op de nieuwe site bestaat, een link binnen de nieuwe site.
const HOSTS = new Set(['www.curius.nl', 'curius.nl', 'curius.genkgo.app']);
for (const url of [BRON_URL, LEDEN_URL]) {
  try {
    HOSTS.add(new URL(url).host);
  } catch {
    // Een ongeldig adres: dan geldt alleen de standaardlijst.
  }
}
export const isBronHost = (host) => HOSTS.has(String(host).toLowerCase());
