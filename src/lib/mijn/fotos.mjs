// Het fotoalbum: alle albums, de foto's van een album en een foto over het hele scherm.
// Het adres onthoudt het album (?album=12), zodat terug in de browser gewoon werkt.

import { datumTekst, h, icoon, vul } from '../dom.mjs';
import { taal, tekst, vraag } from '../leden.mjs';
import { metSiteInlog } from '../ledenkop.mjs';
import { kop, laadRegel, leeg, toonFout } from './gedeeld.mjs';

let albums = null;

export function toon(vak) {
  const toonHuidig = () => {
    const id = new URLSearchParams(location.search).get('album');
    return id ? toonAlbum(vak, id) : toonAlbums(vak);
  };
  addEventListener('popstate', toonHuidig);
  toonHuidig();
}

function naar(vak, id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set('album', id);
  else url.searchParams.delete('album');
  history.pushState(null, '', url);
  return id ? toonAlbum(vak, id) : toonAlbums(vak);
}

async function toonAlbums(vak) {
  const t = tekst();
  vul(vak, laadRegel());
  try {
    albums ??= await metSiteInlog(() => vraag('/albums'));
    if (!albums.length) return vul(vak, leeg(t.geenAlbums, 'camera'));
    vul(
      vak,
      h(
        'div',
        { class: 'albums' },
        albums.map((a) =>
          h(
            'a',
            {
              class: 'album',
              href: `?album=${encodeURIComponent(a.id)}`,
              onclick: (e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
                e.preventDefault();
                naar(vak, a.id);
              },
            },
            h('span', { class: 'album__omslag' }, a.omslagUrl ? h('img', { src: a.omslagUrl, alt: '', loading: 'lazy', decoding: 'async' }) : icoon('camera', 32)),
            h('span', { class: 'album__tekst' }, h('strong', {}, a.titel), a.datum && h('span', {}, datumTekst(a.datum, taal()))),
          ),
        ),
      ),
    );
  } catch (fout) {
    albums = null;
    toonFout(vak, fout, () => toonAlbums(vak));
  }
}

async function toonAlbum(vak, id) {
  const t = tekst();
  const terug = h(
    'a',
    {
      class: 'pijllink pijllink--terug',
      href: location.pathname,
      onclick: (e) => {
        e.preventDefault();
        naar(vak, null);
      },
    },
    icoon('chevronLeft', 18),
    t.alleAlbums,
  );
  vul(vak, terug, laadRegel());
  vak.scrollIntoView?.({ block: 'start' });
  try {
    const album = await metSiteInlog(() => vraag(`/albums/${encodeURIComponent(id)}`));
    const fotos = album.fotos ?? [];
    vul(
      vak,
      terug,
      kop(album.titel, h('span', { class: 'zacht' }, [album.datum && datumTekst(album.datum, taal()), t.aantalFotos(fotos.length)].filter(Boolean).join(' · '))),
      fotos.length
        ? h(
            'ul',
            { class: 'fotos' },
            fotos.map((f, i) =>
              h(
                'li',
                {},
                h(
                  'button',
                  { type: 'button', class: 'fotos__knop', 'aria-label': t.foto(i + 1, fotos.length), onclick: () => groot(fotos, i) },
                  h('img', { src: f.klein, alt: '', loading: 'lazy', decoding: 'async' }),
                ),
              ),
            ),
          )
        : leeg(t.geenFotos, 'image'),
    );
  } catch (fout) {
    vul(vak, terug);
    const foutVak = h('div');
    vak.append(foutVak);
    toonFout(foutVak, fout, () => toonAlbum(vak, id));
  }
}

// Een foto over het hele scherm, met vorige en volgende (ook met de pijltjestoetsen en
// door te vegen op een telefoon).
function groot(fotos, start) {
  const t = tekst();
  let i = start;
  const beeld = h('img', { class: 'fotovenster__beeld', alt: '' });
  const teller = h('p', { class: 'fotovenster__teller' });
  const vorige = h('button', { class: 'fotovenster__pijl fotovenster__pijl--vorige', type: 'button', 'aria-label': t.vorige, onclick: () => ga(-1) }, icoon('chevronLeft', 28));
  const volgende = h('button', { class: 'fotovenster__pijl fotovenster__pijl--volgende', type: 'button', 'aria-label': t.volgende, onclick: () => ga(1) }, icoon('chevronRight', 28));
  const d = h(
    'dialog',
    { class: 'fotovenster', 'aria-label': t.foto(start + 1, fotos.length) },
    beeld,
    vorige,
    volgende,
    teller,
    h('button', { class: 'fotovenster__sluit', type: 'button', 'aria-label': t.sluiten, onclick: () => d.close() }, icoon('close', 24)),
  );
  function toonFoto() {
    beeld.src = fotos[i].groot;
    teller.textContent = t.foto(i + 1, fotos.length);
    d.setAttribute('aria-label', t.foto(i + 1, fotos.length));
    vorige.hidden = i === 0;
    volgende.hidden = i === fotos.length - 1;
    // De volgende alvast laden.
    if (fotos[i + 1]) new Image().src = fotos[i + 1].groot;
  }
  function ga(stap) {
    const nieuw = i + stap;
    if (nieuw < 0 || nieuw >= fotos.length) return;
    i = nieuw;
    toonFoto();
  }
  d.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') ga(-1);
    if (e.key === 'ArrowRight') ga(1);
  });
  let veegStart = null;
  d.addEventListener('touchstart', (e) => (veegStart = e.touches[0]?.clientX ?? null), { passive: true });
  d.addEventListener('touchend', (e) => {
    const eind = e.changedTouches[0]?.clientX;
    if (veegStart !== null && eind !== undefined && Math.abs(eind - veegStart) > 50) ga(eind < veegStart ? 1 : -1);
    veegStart = null;
  });
  d.addEventListener('close', () => d.remove());
  // Het venster vult het hele scherm: een klik naast de foto sluit het.
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  toonFoto();
  document.body.append(d);
  d.showModal();
}
