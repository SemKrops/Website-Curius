// Een nep Curius server om inloggen, inschrijven en Mijn Curius te testen zonder de
// echte server (die op een pc van de faculteit staat). Met verzonnen leden, dezelfde
// adressen en dezelfde vormen als de echte server (zie de server in de repository van
// de app). Starten:
//
//   npm run proefserver                       (op http://localhost:4400)
//   SERVER_URL=http://localhost:4400 npm run dev
//
// Inloggen met gebruikersnaam lid en wachtwoord curius. Met PROEF_SITE_VERLOPEN=1 doet
// de server alsof de inlog op curius.nl verlopen is, zodat de website om je wachtwoord vraagt.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const POORT = Number(process.env.PORT ?? 4400);
const GEBRUIKER = 'lid';
const WACHTWOORD = 'curius';
let siteVerlopen = process.env.PROEF_SITE_VERLOPEN === '1';

const VOORNAMEN = ['Sem', 'Lotte', 'Daan', 'Emma', 'Lucas', 'Julia', 'Thijs', 'Sophie', 'Bram', 'Noor', 'Jesse', 'Fleur', 'Ruben', 'Sanne', 'Milan', 'Eva', 'Jan', 'Anna', 'Koen', 'Lieke'];
const ACHTERNAMEN = ['de Vries', 'Jansen', 'van den Berg', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder', 'de Groot', 'Bos', 'Vos', 'Peters', 'Hendriks'];
const COMMISSIES = ['BarCo 17.0', 'Activiteitencommissie', 'Onderwijscommissie', 'Externe Commissie', 'Almanak', 'Lustrumcommissie'];

const leden = new Map();
for (let i = 0; i < 48; i++) {
  const id = String(1000 + i);
  leden.set(id, {
    id,
    voornaam: VOORNAMEN[i % VOORNAMEN.length],
    achternaam: ACHTERNAMEN[(i * 7) % ACHTERNAMEN.length],
    lidnummer: String(2400 + i),
    jaarlaag: 2021 + (i % 6),
    email: `lid${i}@student.tudelft.nl`,
    telefoon: i % 3 ? `06 ${String(12345678 + i * 1111).slice(0, 8)}` : undefined,
    studie: i % 4 ? 'Technische Bestuurskunde' : 'Complex Systems Engineering and Management',
    geboortedatum: i % 5 === 0 ? `2004-${String((new Date().getMonth() + 1)).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}` : `200${i % 6}-0${(i % 9) + 1}-1${i % 9}`,
    fotoVersie: i % 4 === 3 ? undefined : 'a1',
  });
}
const IK = '1000';
leden.get(IK).adres = { straat: 'Jaffalaan 5', postcode: '2628 BX', plaats: 'Delft' };

const kaart = (l) => ({ ...l, fotoVersie: undefined, fotoUrl: l.fotoVersie ? `/leden/${l.id}/foto?v=${l.fotoVersie}` : undefined });

const sessies = new Map();

// Activiteiten: uit de laatste bouw van de website (.cache/site.json), anders een paar verzonnen.
let activiteiten = [];
try {
  const site = JSON.parse(readFileSync(new URL('../.cache/site.json', import.meta.url), 'utf8'));
  activiteiten = site.activiteiten.nl.map((a) => ({ id: a.id, titel: a.titel, soort: a.soort ?? 'curius', start: a.start, eind: a.eind, locatie: a.locatie, kan: a.kanInschrijven !== false }));
} catch {
  const dag = (n) => new Date(Date.now() + n * 86400_000).toISOString();
  activiteiten = [1, 2, 3].map((n) => ({ id: String(900 + n), titel: `Proefactiviteit ${n}`, soort: 'curius', start: dag(n * 3), kan: true }));
}
const ingeschreven = new Set();
const deelnemers = (id) => ['Lotte Jansen', 'Daan Bakker', 'Emma Visser'].slice(0, Number(id) % 4).concat(ingeschreven.has(id) ? ['Sem de Vries'] : []);

function activiteit(a, metDetail = true) {
  const id = a.id;
  const betaald = Number(id) % 5 === 0;
  return {
    id,
    titel: a.titel,
    soort: a.soort,
    start: a.start,
    eind: a.eind,
    locatie: a.locatie,
    inschrijvingOpen: a.kan && Date.parse(a.eind ?? a.start) > Date.now(),
    viaSite: Number(id) % 11 === 0 ? true : undefined,
    url: `https://www.curius.nl/nl/activiteiten/info/${id}`,
    ingeschreven: ingeschreven.has(id),
    maxDeelnemers: Number(id) % 3 === 0 ? 40 : undefined,
    aantalIngeschreven: metDetail && !siteVerlopen ? deelnemers(id).length : undefined,
    deelnemers: metDetail && !siteVerlopen ? deelnemers(id).map((naam) => ({ naam })) : undefined,
    betaalUrl: betaald && ingeschreven.has(id) ? 'https://www.example.com/betalen' : undefined,
    moetInloggen: siteVerlopen || undefined,
  };
}

const profiel = {
  velden: [
    { sleutel: 'voornaam', soort: 'tekst', label: 'Voornaam', waarde: 'Sem', verplicht: true, groep: 'Persoonsgegevens' },
    { sleutel: 'achternaam', soort: 'tekst', label: 'Achternaam', waarde: 'de Vries', verplicht: true, groep: 'Persoonsgegevens' },
    { sleutel: 'geboortedatum', soort: 'datum', label: 'Geboortedatum', waarde: '2005-10-14', groep: 'Persoonsgegevens' },
    { sleutel: 'email', soort: 'email', label: 'E-mailadres', waarde: 'lid0@student.tudelft.nl', verplicht: true, groep: 'Contact' },
    { sleutel: 'telefoon', soort: 'telefoon', label: 'Telefoon', waarde: '06 12345678', groep: 'Contact' },
    { sleutel: 'studie', soort: 'lijst', label: 'Studie', waarde: 'tb', opties: [{ waarde: 'tb', label: 'Technische Bestuurskunde' }, { waarde: 'cosem', label: 'CoSEM' }, { waarde: 'epa', label: 'EPA' }], groep: 'Studie' },
    { sleutel: 'jaar', soort: 'keuze', label: 'Studiejaar', waarde: '2', opties: [{ waarde: '1', label: '1' }, { waarde: '2', label: '2' }, { waarde: '3', label: '3' }, { waarde: 'm', label: 'Master' }], groep: 'Studie' },
    { sleutel: 'nieuwsbrief', soort: 'vinkje', label: 'Ik wil de nieuwsbrief ontvangen', waarde: true, groep: 'Voorkeuren' },
    { sleutel: 'interesses', soort: 'meerdere', label: 'Interesses', waarde: ['borrels'], opties: [{ waarde: 'borrels', label: 'Borrels' }, { waarde: 'carriere', label: 'Carrière' }, { waarde: 'reizen', label: 'Reizen' }], groep: 'Voorkeuren' },
    { sleutel: 'lidnummer', soort: 'tekst', label: 'Lidnummer', waarde: '2400', alleenLezen: true, groep: 'Persoonsgegevens' },
  ],
  url: 'https://www.curius.nl/nl/mijn-curius/mijn-profiel/profiel-bewerken',
};

const declaraties = [
  { id: '359', hoedanigheid: 'Barco', bedrag: '€ 28,16', uitbetaaldOp: '2026-08-11' },
  { id: '360', hoedanigheid: 'Activiteitencommissie', bedrag: '€ 112,40' },
];

const ALBUMS = [
  { id: '81', titel: 'Kroegentocht', datum: '2026-10-02', aantal: 14 },
  { id: '80', titel: 'Introductieweekend', datum: '2026-09-12', aantal: 23 },
  { id: '79', titel: 'Gala', datum: '2026-05-20', aantal: 0 },
];

class Fout extends Error {
  constructor(status, melding, code) {
    super(melding);
    this.status = status;
    this.code = code;
  }
}

const KLEUREN = ['#98012e', '#24477a', '#2e5e2e', '#7f4c00', '#4e2f86', '#6e0021'];
function svg(tekst, kleur, b = 320, hh = 320) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${b}" height="${hh}" viewBox="0 0 ${b} ${hh}"><rect width="100%" height="100%" fill="${kleur}"/><text x="50%" y="54%" font-family="sans-serif" font-size="${Math.round(hh / 4)}" fill="#fff" text-anchor="middle">${tekst}</text></svg>`;
}

async function body(req) {
  const delen = [];
  for await (const d of req) delen.push(d);
  return Buffer.concat(delen);
}
async function json(req) {
  try {
    return JSON.parse((await body(req)).toString('utf8') || '{}');
  } catch {
    throw new Fout(400, 'Verzoek is geen geldige JSON.');
  }
}
async function formulier(req) {
  const data = await body(req);
  return new Request('http://proef/', { method: 'POST', headers: { 'content-type': req.headers['content-type'] ?? '' }, body: data }).formData();
}

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function routes(req, url) {
  const pad = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;
  const deel = pad.split('/').slice(1).map(decodeURIComponent);
  await wacht(150 + Math.random() * 250);

  if (pad === '/' && m === 'GET') return { naam: 'Curius proefserver', status: '/status' };
  if (pad === '/inloggen' && m === 'POST') {
    const { gebruikersnaam, wachtwoord } = await json(req);
    if (!gebruikersnaam || !wachtwoord) throw new Fout(400, 'Vul je gebruikersnaam en wachtwoord in.');
    if (gebruikersnaam !== GEBRUIKER || wachtwoord !== WACHTWOORD) throw new Fout(401, 'Gebruikersnaam of wachtwoord klopt niet.');
    const token = randomBytes(16).toString('hex');
    sessies.set(token, IK);
    return { token, lidId: IK };
  }

  // Foto's van albums: geen sessie nodig (zoals de foto's op curius.nl).
  if (deel[0] === 'proef' && deel[1] === 'foto') {
    const [n] = deel[2].split('.');
    const groot = url.searchParams.get('maat') === 'groot';
    return { bestand: { type: 'image/svg+xml', data: svg(`#${n}`, KLEUREN[Number(n) % KLEUREN.length], groot ? 1200 : 320, groot ? 800 : 320) } };
  }

  const token = (req.headers.authorization ?? '').match(/^Bearer\s+(.+)$/i)?.[1];
  const lidId = sessies.get(token);
  if (!lidId) throw new Fout(401, 'Je sessie is verlopen. Log opnieuw in.');

  if (pad === '/uitloggen' && m === 'POST') {
    sessies.delete(token);
    return null;
  }
  if (pad === '/ik') return { lidId, admin: false, commissies: [] };

  if (deel[0] === 'leden') {
    if (deel.length === 1) {
      const q = (url.searchParams.get('zoek') ?? '').toLowerCase().trim();
      if (q.length < 3) return [];
      return [...leden.values()].filter((l) => `${l.voornaam} ${l.achternaam}`.toLowerCase().includes(q)).slice(0, 30).map(kaart);
    }
    if (deel[1] === 'jarig') {
      const vandaag = new Date().toISOString().slice(5, 10);
      return [...leden.values()].filter((l) => l.geboortedatum?.slice(5) === vandaag).map(kaart);
    }
    const lid = leden.get(deel[1]);
    if (!lid) throw new Fout(404, 'Lid niet gevonden.');
    if (deel.length === 2) return kaart(lid);
    if (deel[2] === 'foto') {
      if (!lid.fotoVersie) throw new Fout(404, 'Dit lid heeft geen foto.');
      const groot = url.searchParams.get('maat') === 'groot';
      return { bestand: { type: 'image/svg+xml', data: svg(`${lid.voornaam[0]}${lid.achternaam.split(' ').pop()[0]}`, KLEUREN[Number(lid.id) % KLEUREN.length], groot ? 1280 : 320, groot ? 1280 : 320) } };
    }
    if (deel[2] === 'commissies') {
      const n = Number(lid.id) % 4;
      return Array.from({ length: n }, (_, i) => ({
        commissieId: String(i),
        lidId: lid.id,
        jaar: `${2026 - i}-${2027 - i}`,
        functie: i === 0 ? 'Voorzitter' : undefined,
        commissie: { id: String(i), naam: COMMISSIES[(Number(lid.id) + i) % COMMISSIES.length] },
      }));
    }
  }

  if (deel[0] === 'activiteiten') {
    if (deel.length === 1 && m === 'GET') return activiteiten.filter((a) => Date.parse(a.eind ?? a.start) > Date.now() - 86400_000).map((a) => activiteit(a, false));
    if (deel[1] === 'inloggen' && m === 'POST') {
      const { wachtwoord } = await json(req);
      if (wachtwoord !== WACHTWOORD) throw new Fout(400, 'Wachtwoord klopt niet.');
      siteVerlopen = false;
      return null;
    }
    const a = activiteiten.find((x) => x.id === deel[1]) ?? { id: deel[1], titel: `Activiteit ${deel[1]}`, soort: 'curius', start: new Date(Date.now() + 5 * 86400_000).toISOString(), kan: true };
    if (deel.length === 2 && m === 'GET') return activiteit(a);
    if (deel[2] === 'inschrijving') {
      if (siteVerlopen) throw new Fout(403, 'Log opnieuw in op curius.nl om je in of uit te schrijven.', 'site_inloggen');
      if (m === 'POST') ingeschreven.add(a.id);
      else ingeschreven.delete(a.id);
      return activiteit(a);
    }
  }

  if (pad === '/profiel' && m === 'GET') {
    if (siteVerlopen) throw new Fout(403, 'Log opnieuw in op curius.nl om je profiel aan te passen.', 'site_inloggen');
    return profiel;
  }
  if (pad === '/profiel' && m === 'PUT') {
    const { waarden } = await json(req);
    for (const veld of profiel.velden) if (!veld.alleenLezen && veld.sleutel in waarden) veld.waarde = waarden[veld.sleutel];
    const ik = leden.get(IK);
    ik.voornaam = String(waarden.voornaam ?? ik.voornaam);
    ik.achternaam = String(waarden.achternaam ?? ik.achternaam);
    return profiel;
  }
  if (pad === '/profiel/foto' && m === 'PUT') {
    const form = await formulier(req);
    if (!(form.get('foto') instanceof Blob)) throw new Fout(400, 'Stuur een foto mee.');
    const ik = leden.get(IK);
    ik.fotoVersie = randomBytes(3).toString('hex');
    return kaart(ik);
  }

  if (pad === '/declaraties' && m === 'GET') {
    if (siteVerlopen) throw new Fout(403, 'Log opnieuw in op curius.nl om te declareren.', 'site_inloggen');
    return { declaraties, voorinvullen: { iban: 'NL91ABNA0417164300', tenNaamVan: 'S. de Vries' } };
  }
  if (pad === '/declaraties' && m === 'POST') {
    const form = await formulier(req);
    const invoer = JSON.parse(String(form.get('gegevens') ?? '{}'));
    if (!invoer.hoedanigheid) throw new Fout(400, 'Vul je hoedanigheid in (commissie of orgaan).');
    if (invoer.verklaring !== true) throw new Fout(400, 'Vink aan dat je het formulier naar waarheid hebt ingevuld.');
    for (let n = 1; n <= invoer.regels.length; n++) if (!form.getAll(`bon_${n}`).length) throw new Fout(400, `Uitgave ${n}: voeg een bonnetje of factuur toe.`);
    const som = invoer.regels.reduce((s, r) => s + Number(String(r.bedrag).replace(/\./g, '').replace(',', '.')), 0);
    declaraties.unshift({ hoedanigheid: invoer.hoedanigheid, bedrag: `€ ${som.toFixed(2).replace('.', ',')}` });
    return { declaraties };
  }

  if (deel[0] === 'albums') {
    if (siteVerlopen) throw new Fout(403, 'Log opnieuw in op curius.nl om de albums te zien.', 'site_inloggen');
    const adres = (n, maat) => `http://localhost:${POORT}/proef/foto/${n}.svg?maat=${maat}`;
    if (deel.length === 1) return ALBUMS.map((a) => ({ id: a.id, titel: a.titel, datum: a.datum, omslagUrl: a.aantal ? adres(Number(a.id) * 100, 'klein') : undefined }));
    const album = ALBUMS.find((a) => a.id === deel[1]);
    if (!album) throw new Fout(404, 'Album niet gevonden.');
    return { id: album.id, titel: album.titel, datum: album.datum, fotos: Array.from({ length: album.aantal }, (_, i) => ({ klein: adres(Number(album.id) * 100 + i, 'klein'), groot: adres(Number(album.id) * 100 + i, 'groot') })) };
  }

  throw new Fout(404, 'Onbekend adres.');
}

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept-Language');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return void res.writeHead(204).end();
  const url = new URL(req.url, 'http://localhost');
  try {
    const antwoord = await routes(req, url);
    if (antwoord?.bestand) {
      res.writeHead(200, { 'Content-Type': antwoord.bestand.type, 'Cache-Control': 'private, max-age=3600' });
      res.end(antwoord.bestand.data);
    } else if (antwoord === null || antwoord === undefined) {
      res.writeHead(204).end();
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(antwoord));
    }
  } catch (e) {
    const status = e instanceof Fout ? e.status : 500;
    if (!(e instanceof Fout)) console.error(e);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(e.code ? { melding: e.message, code: e.code } : { melding: e.message }));
  } finally {
    if (!process.env.STIL) console.log(`${req.method} ${url.pathname} ${res.statusCode}`);
  }
}).listen(POORT, () => console.log(`Curius proefserver op http://localhost:${POORT} (inloggen: ${GEBRUIKER} / ${WACHTWOORD})`));
