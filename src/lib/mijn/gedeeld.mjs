// Onderdelen die meerdere pagina's van Mijn Curius gebruiken.

import { h, icoon, initialen, melding, vul } from '../dom.mjs';
import { fotoAdres, LedenFout, tekst } from '../leden.mjs';

export const laadRegel = () => h('p', { class: 'laadregel' }, h('span', { class: 'draaier', 'aria-hidden': 'true' }), tekst().laden);

// Een foutmelding met een knop om het opnieuw te proberen. Bij een verlopen sessie
// (401) is de pagina al uitgelogd, dan hoeft er niets te staan.
export function toonFout(vak, fout, opnieuw) {
  if (fout instanceof LedenFout && fout.status === 401) return vul(vak);
  return vul(
    vak,
    h(
      'div',
      { class: 'foutblok' },
      melding(fout?.message || tekst().ietsMis),
      opnieuw && h('button', { class: 'knop knop--rand knop--klein', type: 'button', onclick: opnieuw }, tekst().opnieuw),
    ),
  );
}

// De foto van een lid: eerst de letters, de foto zodra hij in beeld komt.
export function lidFoto(lid, { maat = 'klein', grootte = 'm' } = {}) {
  const el = h('span', { class: `lidfoto lidfoto--${grootte}`, 'aria-hidden': 'true' }, h('span', {}, initialen(lid?.voornaam, lid?.achternaam)));
  if (!lid?.fotoUrl) return el;
  const laad = () =>
    fotoAdres(lid.fotoUrl, maat).then((url) => {
      if (url) el.append(h('img', { src: url, alt: '' }));
    });
  if (typeof IntersectionObserver === 'undefined') {
    laad();
    return el;
  }
  const kijker = new IntersectionObserver(
    (items) => {
      if (!items.some((i) => i.isIntersecting)) return;
      kijker.disconnect();
      laad();
    },
    { rootMargin: '300px' },
  );
  kijker.observe(el);
  return el;
}

// Een kopje boven een stuk van de pagina.
export const kop = (titel, ...extra) => h('div', { class: 'sectie__kop' }, h('h2', {}, titel), ...extra);

// Een rij in een lijst met gegevens (zoals E-mail of Telefoon), met een icoon.
export function gegevenRij(naam, label, inhoud) {
  if (inhoud === undefined || inhoud === null || inhoud === '') return null;
  return h('div', { class: 'infokaart__rij' }, icoon(naam, 20), h('div', {}, h('dt', {}, label), h('dd', {}, inhoud)));
}

export const leeg = (tekst, naam = 'sparkles') => h('div', { class: 'leeg' }, icoon(naam, 28), h('p', {}, tekst));
