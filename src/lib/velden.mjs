// Velden van een formulier van curius.nl tekenen en weer uitlezen. Welke velden er zijn
// (en welke keuzes) stelt het bestuur in Genkgo in; de Curius server leest ze van de
// site. Voor Mijn Curius (gegevens aanpassen) en voor de formulieren voor iedereen,
// zoals lid worden en contact (lib/formulier.mjs).

import { h } from './dom.mjs';
import { tekst } from './leden.mjs';

const INVOER_SOORT = { tekst: 'text', email: 'email', telefoon: 'tel', url: 'url', getal: 'text', datum: 'date', wachtwoord: 'password' };

// Zo weet de browser wat er in een veld hoort, zodat hij het zelf kan invullen. Op
// naam van het veld in Genkgo (zoals givenname), anders op soort.
const AUTOMATISCH = {
  givenname: 'given-name',
  middlename: 'additional-name',
  surname: 'family-name',
  mail: 'email',
  mobile: 'tel',
  street: 'street-address',
  postalcode: 'postal-code',
  city: 'address-level2',
  country: 'country-name',
  birthdate: 'bday',
  rq_uid: 'username',
};
const automatisch = (veld) =>
  AUTOMATISCH[veld.sleutel] ?? (veld.soort === 'email' ? 'email' : veld.soort === 'telefoon' ? 'tel' : veld.soort === 'wachtwoord' ? 'new-password' : undefined);

// Foto's en pdf's: meer stuurt de server niet door.
export const BESTANDSSOORTEN = 'image/jpeg,image/png,application/pdf';

// Op curius.nl zijn sommige korte velden een groot tekstvak, zoals Naam en E-mail bij
// contact (zo staan ze in Genkgo). Die tonen we als gewone regel.
const KORT = [
  [/e-?mail/i, 'email', 'email'],
  [/telefoon|phone|mobiel|mobile/i, 'tel', 'tel'],
  [/^(naam|name|voornaam|achternaam|first name|last name)$/i, 'text', 'name'],
];
export const kortTekstvak = (veld) => (veld.soort === 'tekstvak' ? KORT.find(([p]) => p.test(String(veld.label ?? '').trim())) : undefined);

export function veldInvoer(veld, id) {
  const t = tekst();
  const gemeen = { id, name: veld.sleutel, disabled: !!veld.alleenLezen, required: !!veld.verplicht };
  switch (veld.soort) {
    case 'tekstvak': {
      const kort = kortTekstvak(veld);
      if (kort) return h('input', { ...gemeen, type: kort[1], autocomplete: kort[2], value: String(veld.waarde ?? ''), maxlength: veld.max, placeholder: veld.voorbeeld });
      return h('textarea', { ...gemeen, rows: 5, maxlength: veld.max, placeholder: veld.voorbeeld }, String(veld.waarde ?? ''));
    }
    case 'lijst':
      // Een lege keuze bovenaan: "maak een keuze" als het verplicht is, anders een streepje.
      return h(
        'select',
        gemeen,
        h('option', { value: '', selected: !veld.waarde }, veld.verplicht ? t.maakKeuze : '—'),
        (veld.opties ?? []).filter((o) => o.waarde !== '').map((o) => h('option', { value: o.waarde, selected: o.waarde === veld.waarde }, o.label || o.waarde)),
      );
    case 'keuze':
      return h(
        'div',
        { class: 'keuzes', role: 'radiogroup', 'aria-labelledby': `${id}-label` },
        (veld.opties ?? []).map((o, i) =>
          h('label', { class: 'keuze' }, h('input', { type: 'radio', name: veld.sleutel, value: o.waarde, checked: o.waarde === veld.waarde, disabled: !!veld.alleenLezen, required: !!veld.verplicht, id: i ? undefined : id }), o.label),
        ),
      );
    case 'meerdere': {
      const gekozen = new Set(Array.isArray(veld.waarde) ? veld.waarde : []);
      return h(
        'div',
        { class: 'keuzes', role: 'group', 'aria-labelledby': `${id}-label` },
        (veld.opties ?? []).map((o, i) =>
          h('label', { class: 'keuze' }, h('input', { type: 'checkbox', name: veld.sleutel, value: o.waarde, checked: gekozen.has(o.waarde), disabled: !!veld.alleenLezen, id: i ? undefined : id }), o.label),
        ),
      );
    }
    case 'bestand':
      return h('input', { ...gemeen, type: 'file', accept: BESTANDSSOORTEN, multiple: !!veld.meerdere });
    default:
      return h('input', {
        ...gemeen,
        type: INVOER_SOORT[veld.soort] ?? 'text',
        inputmode: veld.soort === 'getal' ? 'decimal' : undefined,
        value: veld.soort === 'wachtwoord' ? undefined : String(veld.waarde ?? ''),
        maxlength: veld.max,
        pattern: veld.patroon,
        placeholder: veld.voorbeeld,
        autocomplete: automatisch(veld),
      });
  }
}

export function veldBlok(veld, id) {
  const t = tekst();
  if (veld.soort === 'vinkje') {
    return h(
      'div',
      { class: 'veld veld--vinkje' },
      h(
        'label',
        { class: 'keuze' },
        h('input', { type: 'checkbox', id, name: veld.sleutel, checked: veld.waarde === true, disabled: !!veld.alleenLezen, required: !!veld.verplicht }),
        h('span', {}, veld.label, veld.verplicht && h('span', { class: 'veld__verplicht' }, ` (${t.verplicht})`)),
      ),
      veld.hint && h('p', { class: 'veld__hint' }, veld.hint),
    );
  }
  const meer = veld.soort === 'keuze' || veld.soort === 'meerdere';
  return h(
    'div',
    { class: 'veld' },
    h(meer ? 'span' : 'label', { class: 'veld__label', id: `${id}-label`, for: meer ? undefined : id }, veld.label, veld.verplicht && h('span', { class: 'veld__verplicht' }, ` (${t.verplicht})`)),
    veldInvoer(veld, id),
    veld.hint && h('p', { class: 'veld__hint' }, veld.hint),
  );
}

// De velden per kopje (fieldset), in de volgorde van het formulier.
export function perGroep(velden) {
  const groepen = new Map();
  for (const veld of velden) {
    const groep = veld.groep ?? '';
    if (!groepen.has(groep)) groepen.set(groep, []);
    groepen.get(groep).push(veld);
  }
  return groepen;
}

const elementenVan = (form, veld) => [...form.querySelectorAll(`[name="${CSS.escape(veld.sleutel)}"]`)];

// De waarden uit het formulier, in de vorm die de server terug wil. Zonder bestanden.
export function waardenVan(form, velden) {
  const waarden = {};
  for (const veld of velden) {
    if (veld.alleenLezen || veld.soort === 'bestand') continue;
    const els = elementenVan(form, veld);
    if (veld.soort === 'vinkje') waarden[veld.sleutel] = !!els[0]?.checked;
    else if (veld.soort === 'meerdere') waarden[veld.sleutel] = els.filter((e) => e.checked).map((e) => e.value);
    else if (veld.soort === 'keuze') waarden[veld.sleutel] = els.find((e) => e.checked)?.value ?? '';
    else waarden[veld.sleutel] = els[0]?.value ?? '';
  }
  return waarden;
}

// De gekozen bestanden per veld: [[sleutel, File], ...].
export function bestandenVan(form, velden) {
  return velden.filter((v) => v.soort === 'bestand').flatMap((veld) => [...(elementenVan(form, veld)[0]?.files ?? [])].map((b) => [veld.sleutel, b]));
}

// Zet eerder ingevulde waarden terug, bijvoorbeeld nadat het formulier opnieuw is geladen.
// Wachtwoorden en bestanden niet: die kiest de bezoeker opnieuw.
export function zetWaarden(form, velden, waarden) {
  for (const veld of velden) {
    if (!Object.hasOwn(waarden, veld.sleutel) || veld.soort === 'wachtwoord' || veld.soort === 'bestand') continue;
    const w = waarden[veld.sleutel];
    const els = elementenVan(form, veld);
    if (veld.soort === 'vinkje') els[0] && (els[0].checked = w === true);
    else if (veld.soort === 'meerdere') for (const e of els) e.checked = Array.isArray(w) && w.includes(e.value);
    else if (veld.soort === 'keuze') for (const e of els) e.checked = e.value === w;
    else if (els[0]) els[0].value = String(w ?? '');
  }
}
