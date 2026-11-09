// Alles voor leden gaat via de Curius server: dezelfde server als die van de Curius app
// (repository studievereniging-curius, map server). De website zelf weet niets van leden.
// Pas als iemand inlogt, haalt de browser de gegevens op bij de server.
//
// De sessie is een token, geen wachtwoord. Die staat in localStorage, zodat je op elke
// pagina ingelogd blijft. Het wachtwoord zelf bewaren we nergens.

import { lt } from './ledenteksten.mjs';

const SLEUTEL = 'curius.sessie';
const WACHTTIJD_MS = 20_000;
// Bonnetjes en foto's uploaden kan op mobiel internet even duren.
const WACHTTIJD_UPLOAD_MS = 120_000;

const html = () => globalThis.document?.documentElement;
export const taal = () => (html()?.lang === 'en' ? 'en' : 'nl');
export const tekst = () => lt(taal());
const server = () => String(html()?.dataset?.server ?? '').replace(/\/+$/, '');

// Een fout van de server, met de melding in de taal van de pagina. De code zegt soms wat
// er moet gebeuren, zoals site_inloggen: vraag het wachtwoord nog een keer.
// Met `gegevens` het hele antwoord van de server, zoals de nieuwe som bij een formulier.
export class LedenFout extends Error {
  constructor(melding, status = 0, code = undefined, gegevens = undefined) {
    super(melding);
    this.status = status;
    this.code = code;
    this.gegevens = gegevens;
  }
}

// --- De sessie ----------------------------------------------------------------------

const kanaal = new EventTarget();
let inGeheugen = null; // als localStorage niet werkt, zoals in sommige privévensters

export function sessie() {
  try {
    const ruw = globalThis.localStorage?.getItem(SLEUTEL);
    if (ruw === undefined) return inGeheugen;
    const s = ruw ? JSON.parse(ruw) : null;
    return s && typeof s.token === 'string' && s.lidId ? s : null;
  } catch {
    return inGeheugen;
  }
}

function zetSessie(nieuw) {
  inGeheugen = nieuw;
  try {
    if (nieuw) globalThis.localStorage?.setItem(SLEUTEL, JSON.stringify(nieuw));
    else globalThis.localStorage?.removeItem(SLEUTEL);
  } catch {
    // Dan blijft hij alleen op deze pagina bewaard.
  }
  kanaal.dispatchEvent(new Event('sessie'));
}

// Roept f aan als iemand inlogt of uitlogt, ook in een ander tabblad.
export function bijSessie(f) {
  const luister = () => f(sessie());
  kanaal.addEventListener('sessie', luister);
  return () => kanaal.removeEventListener('sessie', luister);
}
globalThis.addEventListener?.('storage', (e) => {
  if (e.key === SLEUTEL) kanaal.dispatchEvent(new Event('sessie'));
});

// --- Verzoeken aan de server --------------------------------------------------------

export async function vraag(pad, { methode = 'GET', body, token = sessie()?.token, wachttijd } = {}) {
  const formulier = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = { 'Accept-Language': taal() };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !formulier) headers['Content-Type'] = 'application/json';
  const stop = new AbortController();
  const wekker = setTimeout(() => stop.abort(), wachttijd ?? (formulier ? WACHTTIJD_UPLOAD_MS : WACHTTIJD_MS));
  let res;
  try {
    res = await fetch(`${server()}${pad}`, {
      method: methode,
      headers,
      body: formulier ? body : body === undefined ? undefined : JSON.stringify(body),
      signal: stop.signal,
    });
  } catch {
    throw new LedenFout(tekst().geenVerbinding);
  } finally {
    clearTimeout(wekker);
  }
  if (!res.ok) {
    let melding = tekst().ietsMis;
    let code;
    let gegevens;
    try {
      const antwoord = await res.json();
      if (antwoord?.melding) melding = antwoord.melding;
      code = antwoord?.code;
      if (antwoord && typeof antwoord === 'object') gegevens = antwoord;
    } catch {
      // Geen JSON: dan de algemene melding.
    }
    // De sessie is verlopen (of iemand is geen lid meer): dan uitgelogd.
    if (res.status === 401 && token && token === sessie()?.token) zetSessie(null);
    throw new LedenFout(melding, res.status, code, gegevens);
  }
  if (res.status === 204) return null;
  return /json/i.test(res.headers.get('content-type') ?? '') ? res.json() : res.blob();
}

export const metJson = (methode, body) => ({ methode, body });

// --- Inloggen en uitloggen -------------------------------------------------------------

export async function inloggen(gebruikersnaam, wachtwoord) {
  // Zonder token: een fout wachtwoord mag een sessie die er al is niet weggooien.
  const { token, lidId } = await vraag('/inloggen', { ...metJson('POST', { gebruikersnaam, wachtwoord }), token: null });
  // De naam voor in de kop. Lukt dat niet, dan ben je toch ingelogd.
  const lid = await vraag(`/leden/${encodeURIComponent(lidId)}`, { token }).catch(() => null);
  zetSessie({ token, lidId: String(lidId), voornaam: lid?.voornaam, achternaam: lid?.achternaam });
  return sessie();
}

export async function uitloggen() {
  const s = sessie();
  zetSessie(null);
  if (s) await vraag('/uitloggen', { methode: 'POST', token: s.token }).catch(() => {});
}

// Werk de naam in de sessie bij (bijvoorbeeld na het aanpassen van je profiel).
export function zetNaam({ voornaam, achternaam }) {
  const s = sessie();
  if (s) zetSessie({ ...s, voornaam, achternaam });
}

// --- De inlog op curius.nl ------------------------------------------------------------
//
// Inschrijven, je profiel, declaraties en foto's gaan via de site in Genkgo, met je eigen
// inlog daar. Die logt de server bij het inloggen ook in, maar die inlog kan verlopen
// (bijvoorbeeld als de server opnieuw is opgestart). Dan zegt de server site_inloggen en
// vragen we het wachtwoord nog een keer.

export const opnieuwOpSite = (wachtwoord) => vraag('/activiteiten/inloggen', metJson('POST', { wachtwoord }));
export const moetOpnieuwInloggen = (e) => e instanceof LedenFout && e.code === 'site_inloggen';

// --- Foto's van leden -----------------------------------------------------------------
//
// Een foto van een lid vraagt de sessie mee, dus geen gewone <img src>: we halen hem op
// en maken er een tijdelijk adres van.

const fotos = new Map();
export function fotoAdres(fotoUrl, maat = 'klein') {
  if (!fotoUrl) return Promise.resolve(null);
  const pad = `${fotoUrl}${fotoUrl.includes('?') ? '&' : '?'}maat=${maat}`;
  if (!fotos.has(pad)) {
    fotos.set(
      pad,
      vraag(pad)
        .then((blob) => (blob instanceof Blob ? URL.createObjectURL(blob) : null))
        .catch(() => {
          fotos.delete(pad);
          return null;
        }),
    );
  }
  return fotos.get(pad);
}
export const vergeetFotos = () => fotos.clear();
