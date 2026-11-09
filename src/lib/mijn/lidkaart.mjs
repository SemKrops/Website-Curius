// De kaart van een lid: foto, naam en de gegevens die het lid laat zien, met de
// commissies waar het lid in zit of zat. Voor je eigen profiel en bij leden zoeken.

import { datumTekst, h, volledigeNaam } from '../dom.mjs';
import { taal, tekst, vraag } from '../leden.mjs';
import { gegevenRij, laadRegel, lidFoto } from './gedeeld.mjs';

export function lidGegevens(lid) {
  const t = tekst();
  const adres = lid.adres ? [lid.adres.straat, [lid.adres.postcode, lid.adres.plaats].filter(Boolean).join(' ')].filter(Boolean) : [];
  return h(
    'dl',
    { class: 'lidkaart__gegevens' },
    gegevenRij('mail', t.email, lid.email && h('a', { href: `mailto:${lid.email}` }, lid.email)),
    gegevenRij('phone', t.telefoon, lid.telefoon && h('a', { href: `tel:${lid.telefoon.replace(/[^\d+]/g, '')}` }, lid.telefoon)),
    gegevenRij('home', t.adres, adres.length ? adres.flatMap((r, i) => (i ? [h('br'), r] : [r])) : undefined),
    gegevenRij('cake', t.geboortedatum, lid.geboortedatum && datumTekst(lid.geboortedatum, taal())),
    gegevenRij('graduationCap', t.studie, lid.studie),
  );
}

export function lidKop(lid, { grootte = 'xl' } = {}) {
  const t = tekst();
  const onder = [lid.jaarlaag ? `${t.lidSinds} ${lid.jaarlaag}` : null, lid.lidnummer ? `${t.lidnummer} ${lid.lidnummer}` : null].filter(Boolean);
  return h(
    'div',
    { class: 'lidkaart__kop' },
    lidFoto(lid, { maat: 'groot', grootte }),
    h('div', {}, h('h2', { class: 'lidkaart__naam' }, volledigeNaam(lid)), onder.length ? h('p', { class: 'lidkaart__onder' }, onder.join(' · ')) : null),
  );
}

// De commissies van een lid, nieuwste jaar eerst, per jaar bij elkaar.
export function commissieLijst(lidId) {
  const vak = h('div', { class: 'commissies' }, laadRegel());
  vraag(`/leden/${encodeURIComponent(lidId)}/commissies`)
    .then((lijst) => {
      const t = tekst();
      if (!lijst?.length) return vak.replaceChildren(h('p', { class: 'zacht' }, t.geenCommissies));
      const perJaar = new Map();
      for (const m of lijst) {
        const jaar = m.jaar || '';
        if (!perJaar.has(jaar)) perJaar.set(jaar, []);
        perJaar.get(jaar).push(m);
      }
      vak.replaceChildren(
        ...[...perJaar].map(([jaar, leden]) =>
          h(
            'div',
            { class: 'commissies__jaar' },
            jaar && h('h4', {}, jaar),
            h(
              'ul',
              {},
              leden.map((m) => h('li', {}, h('span', {}, m.commissie?.naam ?? ''), m.functie ? h('span', { class: 'label' }, m.functie) : null)),
            ),
          ),
        ),
      );
    })
    .catch((fout) => vak.replaceChildren(h('p', { class: 'zacht' }, fout.message)));
  return vak;
}
