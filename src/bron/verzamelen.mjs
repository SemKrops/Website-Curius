// Verzamelt de hele site: het menu, alle pagina's uit het menu, en de pagina's
// waar die naar verwijzen (activiteiten, commissies, partnerbedrijven,
// vacatures en nieuws). Het resultaat is één object met alles wat de nieuwe
// website nodig heeft.

import { leesDatumTekst } from './datum.mjs';
import { bronPad, platteTekst } from './html.mjs';
import { BRON_URL, TALEN } from './instellingen.mjs';
import { leesAlgemeen, leesMenu, leesPagina } from './lezen.mjs';
import { haal, naarUrl, teller } from './ophalen.mjs';

// Vaste plekken op de site, per taal.
export const VASTE_PADEN = {
  nl: {
    activiteiten: 'nl/activiteiten',
    kalender: 'nl/activiteiten/kalender',
    archief: 'nl/activiteiten/archief',
    nieuws: 'nl/nieuws',
    leden: 'nl/mijn-curius',
    contact: 'nl/contact',
    lidWorden: 'nl/vereniging/lid-worden',
  },
  en: {
    activiteiten: 'en/events',
    kalender: 'en/events/calendar',
    archief: 'en/events/archive',
    nieuws: 'en/news',
    leden: 'en/my-curius',
    contact: 'en/contact',
    lidWorden: 'en/association/become-a-member',
  },
};

// Soorten pagina's die niet in het menu staan maar waar wel naar gelinkt wordt.
// `voor` is het begin van het pad per taal; `ouder` de pagina waar hij onder valt.
export const DETAILS = [
  {
    soort: 'activiteit',
    patroon: /^(?:nl\/activiteiten|en\/events)\/info\/(\d+)(?:-([^/]*))?$/,
    sleutel: (m) => m[1],
    pad: (m, taal) => `${taal === 'nl' ? 'nl/activiteiten' : 'en/events'}/info/${m[1]}${m[2] ? '-' + m[2] : ''}`,
    ouder: { nl: 'nl/activiteiten', en: 'en/events' },
  },
  {
    soort: 'commissie',
    patroon: /^(nl|en)\/(?:vereniging\/commissies|association\/committees)\/(?:([^/]+)\/)?(\d+)$/,
    sleutel: (m) => m[3],
    // Het jaar ("commissies-34e-2026-2027") heet in elke taal anders; alleen meenemen in dezelfde taal.
    pad: (m, taal) =>
      `${taal === 'nl' ? 'nl/vereniging/commissies' : 'en/association/committees'}/${m[1] === taal && m[2] ? m[2] + '/' : ''}${m[3]}`,
    ouder: { nl: 'nl/vereniging/commissies', en: 'en/association/committees' },
  },
  {
    soort: 'bedrijf',
    patroon: /^(?:nl\/carriere\/partnerbedrijven|en\/career\/partner-companies)\/([^/]+)$/,
    sleutel: (m) => m[1],
    pad: (m, taal) => `${taal === 'nl' ? 'nl/carriere/partnerbedrijven' : 'en/career/partner-companies'}/${m[1]}`,
    ouder: { nl: 'nl/carriere/partnerbedrijven', en: 'en/career/partner-companies' },
  },
  {
    soort: 'vacature',
    patroon: /^(?:nl\/carriere\/vacatures|en\/career\/vacancies)\/([^/]+)$/,
    sleutel: (m) => m[1],
    pad: (m, taal) => `${taal === 'nl' ? 'nl/carriere/vacatures' : 'en/career/vacancies'}/${m[1]}`,
    ouder: { nl: 'nl/carriere/carriere-platform', en: 'en/career/career-platform' },
  },
  {
    soort: 'nieuws',
    patroon: /^(nl\/nieuws|en\/news)\/([^/]+)$/,
    sleutel: (m) => m[2],
    // Nieuwsberichten hebben per taal een eigen adres; alleen volgen in dezelfde taal.
    pad: (m, taal) => (m[1].startsWith(taal) ? `${m[1]}/${m[2]}` : undefined),
    ouder: { nl: 'nl/nieuws', en: 'en/news' },
  },
];

export function herkenDetail(pad) {
  for (const soort of DETAILS) {
    const m = String(pad ?? '').match(soort.patroon);
    if (m) return { soort, m, sleutel: `${soort.soort}:${soort.sleutel(m)}` };
  }
  return undefined;
}

export const isLedenPad = (pad) => /^(nl\/mijn-curius|en\/my-curius)(\/|$)/.test(pad ?? '');
export const taalVan = (pad) => (String(pad).startsWith('en') ? 'en' : 'nl');

export function* alleKnopen(menu, ouders = []) {
  for (const knoop of menu) {
    yield { knoop, ouders };
    yield* alleKnopen(knoop.kinderen ?? [], [...ouders, knoop]);
  }
}

// Alle links in de blokken van een pagina (als volledige adressen).
export function* linksIn(blokken) {
  for (const blok of blokken ?? []) {
    if (blok.type === 'html') for (const m of blok.html.matchAll(/href="([^"]+)"/g)) yield m[1].replace(/&amp;/g, '&');
    for (const lijst of [blok.kaarten, blok.items, blok.bedrijven, blok.vacatures, blok.rijen, blok.links, blok.dias]) {
      for (const item of lijst ?? []) if (item.href) yield item.href;
    }
    if (blok.meer?.href) yield blok.meer.href;
  }
}

// Het studiejaar loopt van september tot en met augustus.
function eindjaarHuidigStudiejaar(nu) {
  return nu.getMonth() >= 8 ? nu.getFullYear() + 1 : nu.getFullYear();
}

// Pagina's die bijna nooit veranderen hoeven niet elk uur opnieuw opgehaald te worden.
function bewaartijdVoor(pad, nu, activiteiten) {
  const jaar = pad.match(/commiss\w*-\d+\w*-(\d{4})-(\d{4})\//);
  if (jaar && +jaar[2] < eindjaarHuidigStudiejaar(nu)) return 7 * 24 * 60;
  const activiteit = pad.match(/\/info\/(\d+)/)?.[1];
  const eind = activiteit && activiteiten.get(activiteit);
  if (eind && Date.parse(eind) < nu.getTime() - 14 * 24 * 3600_000) return 7 * 24 * 60;
  return undefined;
}

const isNaarHome = (antwoord, pad) => {
  if (!antwoord.url) return false;
  const uit = new URL(antwoord.url).pathname.replace(/^\/+|\/+$/g, '');
  return uit !== pad && ['', 'nl', 'en'].includes(uit);
};

export async function verzamel({ nu = new Date(), log = console.log } = {}) {
  const begin = Date.now();
  const site = { gemaakt: nu.toISOString(), bron: BRON_URL, talen: {}, paginas: {} };

  // 1. De homepagina's: het menu en de vaste onderdelen.
  for (const taal of TALEN) {
    const antwoord = await haal(taal);
    if (antwoord.status !== 200) {
      throw new Error(`De homepagina (${taal}) van ${BRON_URL} kon niet worden geladen (${antwoord.fout ?? antwoord.status}).`);
    }
    const menu = leesMenu(antwoord.html);
    if (!menu.length) throw new Error(`Geen menu gevonden op ${naarUrl(taal)}. Is de opmaak van de site veranderd?`);
    const home = leesPagina(antwoord.html);
    site.talen[taal] = { menu, ...leesAlgemeen(antwoord.html) };
    site.paginas[taal] = { pad: taal, taal, soort: 'home', titel: 'Home', blokken: home.blokken, bron: naarUrl(taal) };
  }

  // 2. Alle pagina's uit het menu, plus het nieuws (dat niet in het menu staat).
  const laad = async (pad, taal, titel, knoop, bewaarMinuten) => {
    const antwoord = await haal(pad, bewaarMinuten ? { bewaarMinuten } : undefined);
    if (antwoord.extern) {
      if (knoop) knoop.extern = antwoord.extern;
      return undefined;
    }
    if (antwoord.status === 401 || antwoord.status === 403) {
      if (knoop) knoop.leden = true;
      site.paginas[pad] = { pad, taal, soort: 'leden', titel: titel ?? pad, blokken: [], bron: naarUrl(pad) };
      return site.paginas[pad];
    }
    if (antwoord.status !== 200 || isNaarHome(antwoord, pad)) {
      if (knoop) knoop.weg = true;
      if (antwoord.status !== 404 && antwoord.status !== 200) log(`[bron] ${pad}: ${antwoord.fout ?? antwoord.status}`);
      return undefined;
    }
    const gelezen = leesPagina(antwoord.html);
    site.paginas[pad] = {
      pad,
      taal,
      soort: 'pagina',
      titel: gelezen.titel || titel || pad,
      blokken: gelezen.blokken,
      beschrijving: gelezen.beschrijving,
      bron: naarUrl(pad),
    };
    return site.paginas[pad];
  };

  const taken = [];
  for (const taal of TALEN) {
    for (const { knoop } of alleKnopen(site.talen[taal].menu)) {
      if (!knoop.pad || knoop.pad === taal || site.paginas[knoop.pad]) continue;
      if (isLedenPad(knoop.pad)) {
        knoop.leden = true;
        continue;
      }
      if (herkenDetail(knoop.pad)) continue;
      taken.push(laad(knoop.pad, taal, knoop.titel, knoop));
    }
    taken.push(laad(VASTE_PADEN[taal].nieuws, taal, taal === 'nl' ? 'Nieuws' : 'News'));
  }
  await Promise.all(taken);

  // 3. De pagina's waar naar gelinkt wordt, in een paar rondes (een vacature
  //    linkt naar het bedrijf, een bedrijf naar zijn vacatures).
  const eindTijden = new Map();
  for (const taal of TALEN) {
    for (const blok of site.paginas[VASTE_PADEN[taal].kalender]?.blokken ?? []) {
      for (const item of blok.type === 'agenda' ? blok.items : []) eindTijden.set(item.id, item.eind ?? item.start);
    }
  }
  const gezien = new Set();
  for (let ronde = 1; ronde <= 3; ronde++) {
    // Per taal en sleutel het beste pad: het langste (met het jaar erin, bij commissies).
    const nodig = new Map();
    for (const pagina of Object.values(site.paginas)) {
      for (const href of linksIn(pagina.blokken)) {
        const pad = bronPad(href);
        const detail = pad && herkenDetail(pad);
        if (!detail) continue;
        const doelPad = detail.soort.pad(detail.m, pagina.taal);
        if (!doelPad) continue;
        const sleutel = `${pagina.taal}|${detail.sleutel}`;
        if (gezien.has(sleutel)) continue;
        const huidig = nodig.get(sleutel);
        if (!huidig || doelPad.length > huidig.pad.length) nodig.set(sleutel, { pad: doelPad, taal: pagina.taal, soort: detail.soort.soort });
      }
    }
    if (!nodig.size) break;
    await Promise.all(
      [...nodig.entries()].map(async ([sleutel, { pad, taal, soort }]) => {
        gezien.add(sleutel);
        const pagina = await laad(pad, taal, undefined, undefined, bewaartijdVoor(pad, nu, eindTijden));
        if (pagina && pagina.soort === 'pagina') pagina.soort = soort;
      }),
    );
  }

  // 4. Activiteiten: kalender, lijsten en detailpagina's samengevoegd.
  site.activiteiten = {};
  for (const taal of TALEN) site.activiteiten[taal] = verzamelActiviteiten(site, taal, nu);

  const aantal = Object.keys(site.paginas).length;
  log(
    `[bron] ${aantal} pagina's verzameld in ${Math.round((Date.now() - begin) / 1000)} s ` +
      `(${teller.opgehaald} opgehaald, ${teller.uitCache} uit de cache, ${teller.fouten} mislukt).`,
  );
  return site;
}

function verzamelActiviteiten(site, taal, nu) {
  const perId = new Map();
  const neem = (id) => {
    if (!perId.has(id)) perId.set(id, { id });
    return perId.get(id);
  };

  // De kalender: begin, eind, of je je kunt inschrijven en een korte tekst.
  for (const blok of site.paginas[VASTE_PADEN[taal].kalender]?.blokken ?? []) {
    if (blok.type !== 'agenda') continue;
    for (const item of blok.items) {
      Object.assign(neem(item.id), {
        titel: item.titel,
        start: item.start,
        eind: item.eind,
        kanInschrijven: item.kanInschrijven,
        soort: item.soort,
        samenvattingHtml: item.html,
      });
    }
  }

  // Kaarten op de home, de activiteitenlijst en het archief: poster en "Inschrijving geopend".
  const lijsten = [taal, VASTE_PADEN[taal].activiteiten, VASTE_PADEN[taal].archief];
  for (const pad of lijsten) {
    for (const blok of site.paginas[pad]?.blokken ?? []) {
      if (blok.type !== 'kaarten') continue;
      for (const kaart of blok.kaarten) {
        const detail = herkenDetail(bronPad(kaart.href));
        if (detail?.soort.soort !== 'activiteit') continue;
        const a = neem(detail.m[1]);
        a.titel ??= kaart.titel;
        a.poster ??= kaart.afbeelding;
        a.srcset ??= kaart.srcset;
        if (kaart.voet) a.inschrijvingOpen = /inschrijving geopend|registration open/i.test(kaart.voet);
        if (!a.start && kaart.ondertitel) Object.assign(a, leesDatumTekst(kaart.ondertitel, nu));
      }
    }
  }

  // De pagina van de activiteit zelf: locatie, organisator, poster en het pad op de nieuwe site.
  for (const pagina of Object.values(site.paginas)) {
    if (pagina.soort !== 'activiteit' || pagina.taal !== taal) continue;
    const id = pagina.pad.match(/\/info\/(\d+)/)?.[1];
    const a = neem(id);
    a.pad = pagina.pad;
    a.titel ??= pagina.titel;
    const gegevens = pagina.blokken.find((b) => b.type === 'gegevens');
    const veld = (...namen) => gegevens?.rijen.find((r) => namen.includes(r.label.toLowerCase()))?.waarde;
    a.locatie = veld('locatie', 'location');
    a.organisator = veld('georganiseerd door', 'organised by', 'organized by');
    a.categorie = veld('type');
    const poster = pagina.blokken.find((b) => b.type === 'afbeelding');
    a.poster ??= poster?.src;
    if (!a.start) Object.assign(a, leesDatumTekst(veld('datum', 'date'), nu) ?? {});
    // Op de pagina zelf tonen we de poster en gegevens apart, niet als losse blokken.
    pagina.blokken = pagina.blokken.filter((b) => b !== gegevens && b !== poster);
    pagina.activiteit = a;
  }

  return [...perId.values()]
    .filter((a) => a.id && a.titel && a.start)
    .map((a) => ({
      ...a,
      samenvatting: a.samenvattingHtml ? platteTekst(a.samenvattingHtml) : undefined,
    }))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
