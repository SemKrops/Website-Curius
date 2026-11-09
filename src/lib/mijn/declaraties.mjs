// Declaraties: je eigen declaraties en een nieuwe indienen, met dezelfde velden als het
// formulier op curius.nl. De server stuurt hem met jouw inlog naar de site, waar de
// penningmeester hem goedkeurt.

import { datumTekst, h, icoon, melding, metBezig, vul } from '../dom.mjs';
import { taal, tekst, vraag } from '../leden.mjs';
import { metSiteInlog } from '../ledenkop.mjs';
import { kop, laadRegel, leeg, toonFout } from './gedeeld.mjs';
import { leesBedrag } from './rekenen.mjs';

const MAX_UITGAVEN = 10;
const MAX_BESTAND = 10 * 1024 * 1024;
const MAX_TOTAAL = 25 * 1024 * 1024;
const SOORTEN = ['application/pdf', 'image/jpeg', 'image/png'];

const vandaag = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());

const euro = (bedrag) =>
  new Intl.NumberFormat(taal() === 'en' ? 'en-GB' : 'nl-NL', { style: 'currency', currency: 'EUR' }).format(bedrag);

// bericht: na het versturen de melding dat het gelukt is, boven de bijgewerkte lijst.
export async function toon(vak, _gegevens, bericht) {
  vul(vak, laadRegel());
  try {
    const gegevens = await metSiteInlog(() => vraag('/declaraties'));
    const lijst = h('section', { class: 'mijn-blok' });
    toonLijst(lijst, gegevens.declaraties ?? []);
    const nieuw = h('section', { class: 'mijn-blok', id: 'nieuw' });
    toonNieuw(nieuw, gegevens.voorinvullen ?? {}, () => toon(vak, _gegevens, melding(tekst().verstuurd, 'goed')));
    vul(vak, bericht ?? null, lijst, nieuw);
    bericht?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch (fout) {
    toonFout(vak, fout, () => toon(vak, _gegevens));
  }
}

function toonLijst(vak, declaraties) {
  const t = tekst();
  if (!declaraties.length) return vul(vak, kop(t.mijnDeclaraties), leeg(t.geenDeclaraties, 'receipt'));
  vul(
    vak,
    kop(t.mijnDeclaraties),
    h(
      'div',
      { class: 'tabel' },
      h(
        'table',
        { class: 'declaraties' },
        h('thead', {}, h('tr', {}, h('th', {}, t.hoedanigheid), h('th', {}, t.bedrag), h('th', {}, t.uitbetaaldOp))),
        h(
          'tbody',
          {},
          declaraties.map((d) =>
            h(
              'tr',
              {},
              h('td', {}, d.hoedanigheid),
              h('td', { class: 'getal' }, d.bedrag),
              h(
                'td',
                {},
                d.uitbetaaldOp
                  ? [h('span', { class: 'declaraties__kop' }, `${t.uitbetaaldOp} `), datumTekst(d.uitbetaaldOp, taal())]
                  : h('span', { class: 'label' }, t.nogNietUitbetaald),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

let teller = 0;

function invoerVeld(label, invoer, hint) {
  invoer.id ||= `decl-${++teller}`;
  return h('div', { class: 'veld' }, h('label', { for: invoer.id }, label), invoer, hint && h('p', { class: 'veld__hint' }, hint));
}

function uitgaveBlok(nummer, opWeg) {
  const t = tekst();
  const datum = h('input', { type: 'date', name: 'datum', required: true, max: vandaag(), value: vandaag() });
  const omschrijving = h('input', { name: 'omschrijving', required: true, maxlength: 200 });
  const bedrag = h('input', { name: 'bedrag', required: true, inputmode: 'decimal', placeholder: t.bedragPlaats, autocomplete: 'off' });
  const bonnen = h('input', { type: 'file', name: 'bonnetjes', multiple: true, required: true, accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png' });
  const titel = h('h3', {}, t.uitgave(nummer));
  const weg = h('button', { class: 'knop knop--zacht knop--klein', type: 'button', onclick: opWeg }, icoon('trash', 16), t.uitgaveWeg);
  const blok = h(
    'fieldset',
    { class: 'uitgave' },
    h('legend', { class: 'uitgave__kop' }, titel, weg),
    h('div', { class: 'formulier__rij' }, invoerVeld(t.datum, datum), invoerVeld(t.bedrag, bedrag)),
    invoerVeld(t.omschrijving, omschrijving),
    invoerVeld(t.bonnetjes, bonnen, t.bonnetjesHint),
  );
  blok.nummer = (n, kanWeg) => {
    titel.textContent = t.uitgave(n);
    weg.hidden = !kanWeg;
  };
  blok.lees = () => ({ datum: datum.value, omschrijving: omschrijving.value.trim(), bedrag: bedrag.value.trim(), bonnetjes: [...bonnen.files] });
  return blok;
}

function toonNieuw(vak, voorinvullen, klaar) {
  const t = tekst();
  const hoedanigheid = h('input', { name: 'hoedanigheid', required: true, maxlength: 200 });
  const iban = h('input', { name: 'iban', required: true, value: voorinvullen.iban ?? '', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'characters' });
  const tenNaamVan = h('input', { name: 'tenNaamVan', required: true, maxlength: 200, value: voorinvullen.tenNaamVan ?? '', autocomplete: 'name' });
  const toelichting = h('textarea', { name: 'toelichting', rows: 3, maxlength: 2000 });
  const verklaring = h('input', { type: 'checkbox', name: 'verklaring', required: true });
  const uitgaven = h('div', { class: 'uitgaven' });
  const erbij = h('button', { class: 'knop knop--rand knop--klein', type: 'button' }, icoon('plus', 17), t.uitgaveErbij);
  const totaal = h('p', { class: 'declaratie__totaal' });
  const meldingVak = h('div', { 'data-formmelding': '' });
  const knop = h('button', { class: 'knop knop--primair', type: 'submit' }, icoon('check', 18), t.versturen);

  const blokken = () => [...uitgaven.children];
  const hernummer = () => {
    blokken().forEach((b, i, alle) => b.nummer(i + 1, alle.length > 1));
    erbij.hidden = blokken().length >= MAX_UITGAVEN;
    rekenTotaal();
  };
  const nieuweUitgave = () => {
    const blok = uitgaveBlok(blokken().length + 1, () => {
      blok.remove();
      hernummer();
    });
    uitgaven.append(blok);
    hernummer();
    return blok;
  };
  function rekenTotaal() {
    const bedragen = blokken().map((b) => leesBedrag(b.lees().bedrag));
    const som = bedragen.filter((b) => !Number.isNaN(b)).reduce((a, b) => a + b, 0);
    totaal.textContent = som > 0 ? `${t.totaal}: ${euro(som)}` : '';
  }
  erbij.addEventListener('click', () => nieuweUitgave().querySelector('input')?.focus());

  const form = h(
    'form',
    { class: 'formulier', novalidate: true },
    invoerVeld(t.hoedanigheid, hoedanigheid, t.hoedanigheidHint),
    h('div', { class: 'formulier__rij' }, invoerVeld(t.iban, iban), invoerVeld(t.tenNaamVan, tenNaamVan)),
    invoerVeld(t.toelichting, toelichting, t.toelichtingHint),
    uitgaven,
    h('div', { class: 'knoppenrij knoppenrij--tussen' }, erbij, totaal),
    h('label', { class: 'keuze keuze--verklaring' }, verklaring, t.verklaring),
    meldingVak,
    h('div', { class: 'knoppenrij' }, knop),
  );
  form.addEventListener('input', (e) => {
    if (e.target.name === 'bedrag') rekenTotaal();
  });
  nieuweUitgave();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    vul(meldingVak);
    const ongeldig = [...form.elements].find((el) => el.willValidate && !el.checkValidity());
    if (ongeldig) return ongeldig.reportValidity();

    const regels = blokken().map((b) => b.lees());
    let samen = 0;
    for (const regel of regels) {
      if (Number.isNaN(leesBedrag(regel.bedrag))) return vul(meldingVak, melding(`${t.bedrag}: ${regel.bedrag}`));
      for (const bon of regel.bonnetjes) {
        if (!SOORTEN.includes(bon.type) && !/\.(pdf|jpe?g|png)$/i.test(bon.name)) return vul(meldingVak, melding(t.bonSoort(bon.name)));
        if (bon.size > MAX_BESTAND) return vul(meldingVak, melding(t.bonTeGroot(bon.name)));
        samen += bon.size;
      }
    }
    if (samen > MAX_TOTAAL) return vul(meldingVak, melding(t.bonnenTeGroot));

    const maakFormulier = () => {
      const data = new FormData();
      data.append(
        'gegevens',
        JSON.stringify({
          hoedanigheid: hoedanigheid.value.trim(),
          iban: iban.value.replace(/\s+/g, '').toUpperCase(),
          tenNaamVan: tenNaamVan.value.trim(),
          toelichting: toelichting.value.trim(),
          regels: regels.map(({ bonnetjes, ...regel }) => regel),
          verklaring: verklaring.checked,
        }),
      );
      regels.forEach((regel, i) => regel.bonnetjes.forEach((bon) => data.append(`bon_${i + 1}`, bon, bon.name)));
      return data;
    };
    try {
      await metBezig(knop, () => metSiteInlog(() => vraag('/declaraties', { methode: 'POST', body: maakFormulier() })));
      klaar();
    } catch (fout) {
      vul(meldingVak, melding(fout.message));
    }
  });

  vul(vak, kop(t.nieuweDeclaratie), form);
}
