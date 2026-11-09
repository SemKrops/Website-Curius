// Mijn Curius: welkom, de onderdelen, je komende activiteiten en wie er jarig is.

import { h, icoon, volledigeNaam, vul } from '../dom.mjs';
import { sessie, tekst, uitloggen, vraag } from '../leden.mjs';
import { MIJN_CURIUS } from '../mijncurius.mjs';
import { activiteitRij } from './activiteiten.mjs';
import { kop, laadRegel, lidFoto } from './gedeeld.mjs';

export async function toon(vak, gegevens) {
  const t = tekst();
  const s = sessie();
  const welkom = h(
    'div',
    { class: 'welkom' },
    lidFoto(s, { maat: 'groot', grootte: 'l' }),
    h('div', { class: 'welkom__tekst' }, h('h2', {}, `${t.hoi} ${s.voornaam ?? ''}`.trim()), h('p', { class: 'zacht', 'data-welkom-onder': '' })),
    h('button', { class: 'knop knop--rand knop--klein', type: 'button', onclick: () => uitloggen() }, icoon('logout', 17), t.uitloggen),
  );
  const tegels = h(
    'div',
    { class: 'hubkaarten hubkaarten--mijn' },
    MIJN_CURIUS.filter((m) => m.deel !== 'overzicht').map((m) =>
      h(
        'a',
        { class: 'hubkaart', href: gegevens.links[m.deel] },
        h('span', { class: 'hubkaart__icoon' }, icoon(m.icoon, 22)),
        h('span', { class: 'hubkaart__tekst' }, h('strong', {}, t.delen[m.deel][0]), h('span', {}, t.delen[m.deel][1])),
        icoon('arrowRight', 18),
      ),
    ),
  );
  const activiteiten = h('section', { class: 'mijn-blok', hidden: true });
  const jarig = h('section', { class: 'mijn-blok', hidden: true });
  vul(vak, welkom, tegels, activiteiten, jarig);

  // Je eigen kaart: met de foto en de jaarlaag.
  vraag(`/leden/${encodeURIComponent(s.lidId)}`)
    .then((lid) => {
      welkom.querySelector('.lidfoto').replaceWith(lidFoto(lid, { maat: 'groot', grootte: 'l' }));
      const onder = [lid.jaarlaag ? `${t.lidSinds} ${lid.jaarlaag}` : null, lid.studie].filter(Boolean).join(' · ');
      welkom.querySelector('[data-welkom-onder]').textContent = onder;
    })
    .catch(() => {});

  // Waar je voor bent ingeschreven. Is de inlog op curius.nl verlopen, dan staat dat op
  // de pagina Mijn activiteiten; hier laten we het dan weg.
  vul(activiteiten, kop(t.delen.activiteiten[0]), laadRegel());
  activiteiten.hidden = false;
  vraag('/activiteiten')
    .then((lijst) => {
      const mijn = (lijst ?? []).filter((a) => a.ingeschreven);
      if (lijst?.some((a) => a.moetInloggen) || !mijn.length) return (activiteiten.hidden = true);
      vul(
        activiteiten,
        kop(
          t.delen.activiteiten[0],
          h('a', { class: 'pijllink', href: gegevens.links.activiteiten }, t.alleActiviteiten, icoon('arrowRight', 18)),
        ),
        h('div', { class: 'mijn-lijst' }, mijn.slice(0, 3).map((a) => activiteitRij(a, gegevens))),
      );
    })
    .catch(() => (activiteiten.hidden = true));

  // Vandaag jarig.
  vraag('/leden/jarig')
    .then((leden) => {
      if (!leden?.length) return;
      vul(
        jarig,
        kop(t.jarig),
        h(
          'ul',
          { class: 'jarig' },
          leden.map((l) => h('li', {}, lidFoto(l, { grootte: 's' }), h('span', {}, volledigeNaam(l)), icoon('cake', 18))),
        ),
      );
      jarig.hidden = false;
    })
    .catch(() => {});
}
