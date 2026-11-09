// Leden zoeken: op naam, met per lid de gegevens die het lid laat zien en de commissies.

import { h, icoon, volledigeNaam, vul } from '../dom.mjs';
import { tekst, vraag } from '../leden.mjs';
import { sluitBijKlikNaast } from '../ledenkop.mjs';
import { laadRegel, leeg, lidFoto, toonFout } from './gedeeld.mjs';
import { commissieLijst, lidGegevens, lidKop } from './lidkaart.mjs';

const MIN_LETTERS = 3;

export function toon(vak) {
  const t = tekst();
  const invoer = h('input', {
    type: 'search',
    id: 'leden-zoek',
    name: 'zoek',
    placeholder: t.zoekPlaats,
    autocomplete: 'off',
    spellcheck: 'false',
    enterkeyhint: 'search',
  });
  const uitslag = h('div', { class: 'zoekuitslag', 'aria-live': 'polite' }, h('p', { class: 'zacht' }, t.zoekMin));
  const form = h(
    'form',
    { class: 'ledenzoeker', role: 'search', onsubmit: (e) => (e.preventDefault(), zoek(true)) },
    h('label', { for: 'leden-zoek' }, t.zoekLabel),
    h('div', { class: 'ledenzoeker__veld' }, icoon('search', 20), invoer),
  );
  vul(vak, form, uitslag);

  let wekker;
  let ronde = 0;
  let laatste = '';
  async function zoek(meteen = false) {
    clearTimeout(wekker);
    const q = invoer.value.trim();
    if (q === laatste && !meteen) return;
    if (q.replace(/\s+/g, '').length < MIN_LETTERS) {
      laatste = q;
      ronde++;
      return vul(uitslag, h('p', { class: 'zacht' }, t.zoekMin));
    }
    if (!meteen) {
      wekker = setTimeout(() => zoek(true), 300);
      return;
    }
    laatste = q;
    const deze = ++ronde;
    vul(uitslag, laadRegel());
    try {
      const leden = await vraag(`/leden?zoek=${encodeURIComponent(q)}`);
      if (deze !== ronde) return;
      // Het adres onthoudt de zoekopdracht, zodat terug in de browser weer hier uitkomt.
      history.replaceState(null, '', `?zoek=${encodeURIComponent(q)}`);
      if (!leden.length) return vul(uitslag, leeg(t.geenLeden, 'search'));
      vul(
        uitslag,
        h('p', { class: 'zacht' }, t.aantalGevonden(leden.length)),
        h(
          'ul',
          { class: 'ledenlijst' },
          leden.map((lid) =>
            h(
              'li',
              {},
              h(
                'button',
                { class: 'lidtegel', type: 'button', onclick: () => toonLid(lid) },
                lidFoto(lid, { grootte: 'm' }),
                h('span', { class: 'lidtegel__tekst' }, h('strong', {}, volledigeNaam(lid)), h('span', {}, [lid.studie, lid.jaarlaag ? `${t.lidSinds} ${lid.jaarlaag}` : null].filter(Boolean).join(' · '))),
                icoon('chevronRight', 18),
              ),
            ),
          ),
        ),
      );
    } catch (fout) {
      if (deze === ronde) toonFout(uitslag, fout, () => zoek(true));
    }
  }
  invoer.addEventListener('input', () => zoek());

  const vooraf = new URLSearchParams(location.search).get('zoek');
  if (vooraf) {
    invoer.value = vooraf;
    zoek(true);
  }
  invoer.focus({ preventScroll: true });
}

// Een lid in een venster: alle gegevens die het lid laat zien en de commissies.
function toonLid(lid) {
  const t = tekst();
  const d = h(
    'dialog',
    { class: 'venster venster--breed', 'aria-label': volledigeNaam(lid) },
    h(
      'div',
      { class: 'venster__binnen lidkaart' },
      lidKop(lid),
      lidGegevens(lid),
      h('h3', { class: 'lidkaart__subkop' }, t.commissies),
      commissieLijst(lid.id),
    ),
    h('button', { class: 'venster__sluit knop knop--rand knop--icoon', type: 'button', 'aria-label': t.sluiten, onclick: () => d.close() }, icoon('close', 20)),
  );
  d.addEventListener('close', () => d.remove());
  sluitBijKlikNaast(d);
  document.body.append(d);
  d.showModal();
  // De volledige kaart: bij het zoeken krijg je soms minder gegevens dan op de kaart zelf.
  vraag(`/leden/${encodeURIComponent(lid.id)}`)
    .then((volledig) => {
      if (!d.open) return;
      d.querySelector('.lidkaart__gegevens').replaceWith(lidGegevens(volledig));
    })
    .catch(() => {});
}
