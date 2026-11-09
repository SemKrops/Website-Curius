// Mijn profiel: je kaart zoals andere leden hem zien, je pasfoto en het formulier om je
// gegevens aan te passen. Het formulier komt van curius.nl (welke velden er zijn, stelt
// het bestuur in Genkgo in), via de Curius server.

import { h, icoon, melding, metBezig, vul } from '../dom.mjs';
import { sessie, tekst, vergeetFotos, vraag, zetNaam } from '../leden.mjs';
import { metSiteInlog } from '../ledenkop.mjs';
import { kop, laadRegel, toonFout } from './gedeeld.mjs';
import { commissieLijst, lidGegevens, lidKop } from './lidkaart.mjs';
import { middenVierkant } from './rekenen.mjs';
import { perGroep, veldBlok, waardenVan } from '../velden.mjs';

const MAX_FOTO = 20 * 1024 * 1024;

export async function toon(vak) {
  const t = tekst();
  const kaart = h('section', { class: 'lidkaart lidkaart--eigen' }, laadRegel());
  const foto = h('section', { class: 'mijn-blok', id: 'pasfoto' });
  const formulier = h('section', { class: 'mijn-blok', id: 'gegevens' }, kop(t.gegevensAanpassen), laadRegel());
  vul(vak, kaart, foto, formulier);
  laadKaart(kaart, foto);
  laadFormulier(formulier);
}

async function laadKaart(kaart, fotoVak) {
  const t = tekst();
  const { lidId } = sessie();
  try {
    const lid = await vraag(`/leden/${encodeURIComponent(lidId)}`);
    zetNaam(lid);
    vul(kaart, lidKop(lid), lidGegevens(lid), h('h3', { class: 'lidkaart__subkop' }, t.commissies), commissieLijst(lidId));
    toonFotoKiezer(fotoVak, kaart);
  } catch (fout) {
    toonFout(kaart, fout, () => laadKaart(kaart, fotoVak));
  }
}

// --- Pasfoto ----------------------------------------------------------------------------

async function maten(bestand) {
  try {
    const beeld = await createImageBitmap(bestand);
    const m = { breedte: beeld.width, hoogte: beeld.height };
    beeld.close?.();
    return m;
  } catch {
    return {};
  }
}

function toonFotoKiezer(vak, kaart) {
  const t = tekst();
  const meldingVak = h('div', { 'data-formmelding': '' });
  const invoer = h('input', { type: 'file', accept: 'image/jpeg,image/png', id: 'pasfoto-bestand', class: 'verborgen-invoer' });
  const knop = h('label', { class: 'knop knop--rand', for: 'pasfoto-bestand' }, icoon('upload', 18), t.fotoKiezen);
  invoer.addEventListener('change', async () => {
    const bestand = invoer.files?.[0];
    invoer.value = '';
    vul(meldingVak);
    if (!bestand) return;
    if (!/^image\/(jpeg|png)$/.test(bestand.type)) return vul(meldingVak, melding(t.fotoSoort));
    if (bestand.size > MAX_FOTO) return vul(meldingVak, melding(t.fotoTeGroot));
    const { breedte, hoogte } = await maten(bestand);
    const uitsnede = middenVierkant(breedte, hoogte);
    knop.setAttribute('aria-busy', 'true');
    try {
      const lid = await metSiteInlog(() => {
        const form = new FormData();
        form.append('foto', bestand, bestand.name || 'pasfoto.jpg');
        if (uitsnede) form.append('uitsnede', JSON.stringify(uitsnede));
        return vraag('/profiel/foto', { methode: 'PUT', body: form });
      });
      vergeetFotos();
      kaart.querySelector('.lidkaart__kop')?.replaceWith(lidKop(lid));
      vul(meldingVak, melding(t.fotoOpgeslagen, 'goed'));
    } catch (fout) {
      vul(meldingVak, melding(fout.message));
    } finally {
      knop.removeAttribute('aria-busy');
    }
  });
  vul(vak, kop(t.pasfoto), h('p', { class: 'zacht' }, t.fotoUitleg), h('div', { class: 'knoppenrij' }, invoer, knop), meldingVak);
}

// --- Gegevens aanpassen -----------------------------------------------------------------

async function laadFormulier(vak) {
  const t = tekst();
  try {
    const formulier = await metSiteInlog(() => vraag('/profiel'));
    toonFormulier(vak, formulier);
  } catch (fout) {
    vul(vak, kop(t.gegevensAanpassen));
    const fouten = h('div');
    vak.append(fouten);
    toonFout(fouten, fout, () => laadFormulier(vak));
  }
}

function toonFormulier(vak, formulier, bericht) {
  const t = tekst();
  const velden = formulier?.velden ?? [];
  const meldingVak = h('div', { 'data-formmelding': '' }, bericht);
  const knop = h('button', { class: 'knop knop--primair', type: 'submit' }, icoon('check', 18), t.opslaan);
  const form = h(
    'form',
    { class: 'formulier', novalidate: true },
    [...perGroep(velden)].map(([groep, lijst]) => {
      const blokken = lijst.map((veld) => veldBlok(veld, `veld-${velden.indexOf(veld)}`));
      return groep ? h('fieldset', {}, h('legend', {}, groep), blokken) : blokken;
    }),
    meldingVak,
    h('div', { class: 'knoppenrij' }, knop),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    vul(meldingVak);
    const ongeldig = [...form.elements].find((el) => el.willValidate && !el.checkValidity());
    if (ongeldig) {
      ongeldig.reportValidity();
      return;
    }
    try {
      const nieuw = await metBezig(knop, () => metSiteInlog(() => vraag('/profiel', { methode: 'PUT', body: { waarden: waardenVan(form, velden) } })));
      toonFormulier(vak, nieuw, melding(t.opgeslagen, 'goed'));
      vak.querySelector('[data-formmelding]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (fout) {
      vul(meldingVak, melding(fout.message));
    }
  });
  vul(vak, kop(t.gegevensAanpassen), h('p', { class: 'zacht' }, t.gegevensUitleg), form);
}
