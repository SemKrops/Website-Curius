// Kleine hulpjes om in de browser stukjes pagina te maken. Tekst gaat altijd als tekst
// (nooit als HTML), zodat een naam of omschrijving nooit code kan worden.

import { svgIcoon } from './iconen.mjs';

// h('a', { href: '/x', class: 'knop' }, 'Tekst', h('span', {}, 'meer'))
export function h(tag, eigenschappen = {}, ...kinderen) {
  const el = document.createElement(tag);
  for (const [naam, waarde] of Object.entries(eigenschappen ?? {})) {
    if (waarde === undefined || waarde === null || waarde === false) continue;
    if (naam.startsWith('on') && typeof waarde === 'function') el.addEventListener(naam.slice(2).toLowerCase(), waarde);
    else if (naam === 'dataset') Object.assign(el.dataset, waarde);
    // Getallen en objecten als eigenschap; tekst en true als attribuut (zo werken checked en
    // selected ook voordat het element op de pagina staat).
    else if (naam in el && !['list', 'form', 'type'].includes(naam) && !['string', 'boolean'].includes(typeof waarde)) el[naam] = waarde;
    else el.setAttribute(naam === 'className' ? 'class' : naam, waarde === true ? '' : String(waarde));
  }
  voegToe(el, kinderen);
  return el;
}

function voegToe(el, kinderen) {
  for (const kind of kinderen.flat(Infinity)) {
    if (kind === undefined || kind === null || kind === false) continue;
    el.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
}

// Een icoon uit lib/iconen.mjs als element.
export function icoon(naam, grootte = 20) {
  const sjabloon = document.createElement('template');
  sjabloon.innerHTML = svgIcoon(naam, grootte);
  return sjabloon.content.firstElementChild;
}

// Een webadres uit gegevens van de server als link: alleen http en https, nooit javascript:.
export function webAdres(url) {
  if (!url) return undefined;
  try {
    const u = new URL(String(url), globalThis.location?.href);
    return /^https?:$/.test(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}

// Vervang de inhoud van een element.
export function vul(el, ...kinderen) {
  el.replaceChildren();
  voegToe(el, kinderen);
  return el;
}

export const initialen = (voornaam, achternaam) =>
  [voornaam, String(achternaam ?? '').split(/\s+/).filter((w) => /^\p{Lu}/u.test(w)).pop() ?? achternaam]
    .map((w) => String(w ?? '').trim()[0] ?? '')
    .join('')
    .toUpperCase() || '?';

export const volledigeNaam = (lid) => [lid?.voornaam, lid?.achternaam].filter(Boolean).join(' ');

// Een datum als "14 oktober 2005" of "14 October 2005".
export function datumTekst(iso, taal, opties = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!iso) return '';
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(datum.getTime())) return String(iso);
  return new Intl.DateTimeFormat(taal === 'en' ? 'en-GB' : 'nl-NL', { timeZone: 'Europe/Amsterdam', ...opties }).format(datum);
}

// Een melding in een vak: fout (rood), goed (groen) of gewoon.
export function melding(tekst, soort = 'fout') {
  return h('p', { class: `formmelding formmelding--${soort}`, role: soort === 'fout' ? 'alert' : 'status' }, icoon(soort === 'goed' ? 'check' : 'alert', 18), h('span', {}, tekst));
}

// Een knop die even "bezig" laat zien zolang de taak loopt.
export async function metBezig(knop, taak) {
  knop.disabled = true;
  knop.setAttribute('aria-busy', 'true');
  try {
    return await taak();
  } finally {
    knop.disabled = false;
    knop.removeAttribute('aria-busy');
  }
}
