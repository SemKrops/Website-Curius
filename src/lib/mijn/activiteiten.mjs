// Mijn activiteiten: waar je voor bent ingeschreven, en wat nu open is voor inschrijving.

import { datumDelen, tijdVak } from '../../bron/datum.mjs';
import { h, icoon, vul } from '../dom.mjs';
import { taal, tekst, vraag } from '../leden.mjs';
import { vraagWachtwoord } from '../ledenkop.mjs';
import { kop, laadRegel, leeg, toonFout } from './gedeeld.mjs';

// Een activiteit als regel, zoals in de agenda, met een link naar de pagina op de nieuwe site.
export function activiteitRij(a, gegevens) {
  const t = tekst();
  const d = datumDelen(a.start, taal());
  const tijd = tijdVak(a.start, a.eind, taal());
  const href = gegevens.activiteiten?.[a.id] ?? gegevens.activiteitenPagina;
  return h(
    'div',
    { class: 'agendapunt' },
    h('span', { class: 'datumtegel' }, h('small', {}, d.weekdag), h('b', {}, d.dag), h('small', {}, d.maand)),
    h(
      'div',
      {},
      h('h4', {}, h('a', { href }, a.titel)),
      h(
        'div',
        { class: 'agendapunt__meta' },
        tijd && h('span', {}, icoon('clock', 15), tijd),
        a.locatie && h('span', {}, icoon('pin', 15), a.locatie),
      ),
    ),
    h(
      'div',
      { class: 'agendapunt__labels' },
      a.ingeschreven
        ? h('span', { class: 'label label--ja' }, icoon('check', 14), t.ingeschreven)
        : a.inschrijvingOpen && h('span', { class: 'label label--open' }, t.inschrijvingOpen),
    ),
  );
}

export async function toon(vak, gegevens) {
  const t = tekst();
  vul(vak, laadRegel());
  try {
    let lijst = await vraag('/activiteiten');
    // Zonder de inlog op curius.nl weet de server niet waar je voor bent ingeschreven.
    if (lijst.some((a) => a.moetInloggen) && (await vraagWachtwoord(t.wachtwoordOpnieuwAlgemeen))) lijst = await vraag('/activiteiten');
    const mijn = lijst.filter((a) => a.ingeschreven);
    const open = lijst.filter((a) => !a.ingeschreven && a.inschrijvingOpen);
    vul(
      vak,
      h(
        'section',
        { class: 'mijn-blok' },
        kop(t.delen.activiteiten[0]),
        mijn.length ? h('div', { class: 'mijn-lijst' }, mijn.map((a) => activiteitRij(a, gegevens))) : leeg(t.geenInschrijvingen, 'calendar'),
      ),
      open.length > 0 &&
        h(
          'section',
          { class: 'mijn-blok' },
          kop(t.nuOpen, h('a', { class: 'pijllink', href: gegevens.activiteitenPagina }, t.alleActiviteiten, icoon('arrowRight', 18))),
          h('div', { class: 'mijn-lijst' }, open.map((a) => activiteitRij(a, gegevens))),
        ),
    );
  } catch (fout) {
    toonFout(vak, fout, () => toon(vak, gegevens));
  }
}
