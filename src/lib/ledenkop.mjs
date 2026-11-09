// Op elke pagina: de knop Mijn Curius in de kop (met je naam als je bent ingelogd), het
// venster om in te loggen en het venster dat je wachtwoord nog een keer vraagt.

import { h, icoon, initialen, melding, metBezig, vul } from './dom.mjs';
import { bijSessie, inloggen, moetOpnieuwInloggen, opnieuwOpSite, sessie, tekst } from './leden.mjs';

// --- De kop -----------------------------------------------------------------------------

export function toonKop(s = sessie()) {
  document.documentElement.toggleAttribute('data-ingelogd', !!s);
  for (const knop of document.querySelectorAll('[data-ledenknop]')) {
    knop.toggleAttribute('data-ingelogd', !!s);
    const naam = knop.querySelector('[data-ledenknop-naam]');
    const letters = knop.querySelector('[data-ledenknop-letters]');
    if (naam) naam.textContent = s ? s.voornaam || tekst().mijnCurius : '';
    if (letters) letters.textContent = s ? initialen(s.voornaam, s.achternaam) : '';
    if (s) knop.title = `${tekst().ingelogdAls} ${[s.voornaam, s.achternaam].filter(Boolean).join(' ')}`.trim();
    else knop.removeAttribute('title');
  }
}

// --- Inloggen ---------------------------------------------------------------------------

// Elk formulier met data-inlogformulier: in het venster en op de pagina's van Mijn Curius.
function koppelFormulier(form) {
  if (form.dataset.gekoppeld) return;
  form.dataset.gekoppeld = '1';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const vak = form.querySelector('[data-formmelding]');
    vul(vak);
    const gebruikersnaam = form.elements.gebruikersnaam.value.trim();
    const wachtwoord = form.elements.wachtwoord.value;
    if (!gebruikersnaam || !wachtwoord) {
      vul(vak, melding(tekst().vulInlogIn));
      (gebruikersnaam ? form.elements.wachtwoord : form.elements.gebruikersnaam).focus();
      return;
    }
    try {
      await metBezig(form.querySelector('[type=submit]'), () => inloggen(gebruikersnaam, wachtwoord));
      form.reset();
    } catch (fout) {
      vul(vak, melding(fout.message));
      form.elements.wachtwoord.select();
    }
  });
}

const venster = () => document.querySelector('[data-inlogvenster]');
let naInloggen = null;

// Opent het venster om in te loggen. Geeft de sessie als het lid inlogt, of null als het
// venster dicht gaat zonder in te loggen.
export function openInloggen(reden) {
  const s = sessie();
  const v = venster();
  if (s || !v) return Promise.resolve(s);
  v.querySelector('[data-inlog-reden]').textContent = reden ?? tekst().inlogUitleg;
  if (!v.open) v.showModal();
  v.querySelector('input[name=gebruikersnaam]')?.focus();
  return new Promise((klaar) => {
    naInloggen?.(null);
    naInloggen = klaar;
  });
}

// --- Je wachtwoord nog een keer ---------------------------------------------------------

export function vraagWachtwoord(reden = tekst().wachtwoordOpnieuwAlgemeen) {
  return new Promise((klaar) => {
    const t = tekst();
    let gelukt = false;
    const vak = h('div', { 'data-formmelding': '' });
    const invoer = h('input', { type: 'password', name: 'wachtwoord', autocomplete: 'current-password', required: true, id: 'opnieuw-wachtwoord' });
    const knop = h('button', { class: 'knop knop--primair knop--breed', type: 'submit' }, t.doorgaan);
    const form = h(
      'form',
      { class: 'inlogformulier', novalidate: true },
      h('div', { class: 'veld' }, h('label', { for: 'opnieuw-wachtwoord' }, t.wachtwoord), invoer),
      vak,
      knop,
    );
    const d = h(
      'dialog',
      { class: 'venster', 'aria-labelledby': 'opnieuw-kop' },
      h('div', { class: 'venster__binnen' }, h('h2', { id: 'opnieuw-kop' }, t.inloggen), h('p', {}, reden), form),
      h('button', { class: 'venster__sluit knop knop--rand knop--icoon', type: 'button', 'aria-label': t.sluiten, onclick: () => d.close() }, icoon('close', 20)),
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      vul(vak);
      if (!invoer.value) return invoer.focus();
      try {
        await metBezig(knop, () => opnieuwOpSite(invoer.value));
        gelukt = true;
        d.close();
      } catch (fout) {
        vul(vak, melding(fout.message));
        invoer.select();
        // Helemaal uitgelogd (de sessie is verlopen): dan heeft dit venster geen zin meer.
        if (fout.status === 401) d.close();
      }
    });
    d.addEventListener('close', () => {
      d.remove();
      klaar(gelukt);
    });
    sluitBijKlikNaast(d);
    document.body.append(d);
    d.showModal();
    invoer.focus();
  });
}

// Doet de taak; zegt de server dat de inlog op curius.nl verlopen is, dan eerst het
// wachtwoord vragen en het nog een keer proberen.
export async function metSiteInlog(taak, reden) {
  try {
    return await taak();
  } catch (fout) {
    if (!moetOpnieuwInloggen(fout) || !(await vraagWachtwoord(reden))) throw fout;
    return taak();
  }
}

// --- Vensters ---------------------------------------------------------------------------

// Een klik op de donkere achtergrond naast een venster sluit het.
export function sluitBijKlikNaast(d) {
  d.addEventListener('click', (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    const binnen = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!binnen) d.close();
  });
}

function start() {
  toonKop();
  document.querySelectorAll('form[data-inlogformulier]').forEach(koppelFormulier);
  const v = venster();
  if (v) {
    sluitBijKlikNaast(v);
    v.addEventListener('close', () => {
      const klaar = naInloggen;
      naInloggen = null;
      klaar?.(sessie());
    });
  }
  document.addEventListener('click', (e) => {
    const sluit = e.target.closest?.('[data-sluit-venster]');
    if (sluit) sluit.closest('dialog')?.close();
    const open = e.target.closest?.('[data-open-inloggen]');
    if (open) {
      e.preventDefault();
      openInloggen();
    }
  });
  bijSessie((s) => {
    toonKop(s);
    if (s && v?.open) v.close();
  });
}

start();
