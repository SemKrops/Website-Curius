// De formulieren van curius.nl die iedereen mag invullen (lid worden, contact,
// wachtwoord vergeten), hier op de site zelf. De velden komen van de Curius server, die
// ze van curius.nl leest; versturen gaat ook via die server, met een eigen sessie op
// curius.nl. Zie server/formulieren.mjs in de repository van de app.
//
// Op curius.nl staat bij de meeste formulieren een som tegen robots. Die som laten we
// zien zoals de site hem geeft; de bezoeker rekent hem zelf uit.

import { h, icoon, melding, metBezig, vul, webAdres } from './dom.mjs';
import { tekst, vraag } from './leden.mjs';
import { bestandenVan, perGroep, veldBlok, waardenVan, zetWaarden } from './velden.mjs';

const MAX_BESTAND = 10 * 1024 * 1024;
const MAX_TOTAAL = 12 * 1024 * 1024;
// Adressen van de site in Genkgo: een link daarheen kan naar de pagina op deze site.
const CURIUS = /^(www\.)?curius\.nl$|\.genkgo\.app$/i;

// Een link uit de uitleg van het formulier. Staat die pagina ook op deze site, dan de
// link hierheen (de kaart maakt de bouw van de website: pad op curius.nl naar adres hier).
export function linkVoor(link, kaart = {}) {
  const adres = webAdres(link);
  if (!adres) return undefined;
  const u = new URL(adres);
  if (CURIUS.test(u.hostname)) {
    let pad = u.pathname;
    try {
      pad = decodeURIComponent(pad);
    } catch {
      // Dan het pad zoals het is.
    }
    pad = pad.replace(/^\/+|\/+$/g, '');
    if (Object.hasOwn(kaart, pad)) return kaart[pad];
  }
  return adres;
}

// De som zonder het = aan het eind: "vijftien plus dertien is =" wordt "vijftien plus dertien is".
export const somZonderIs = (vraag) => String(vraag ?? '').replace(/\s*=\s*$/, '').trim();

// De tekst op de knop zoals op curius.nl ("versturen"), met een hoofdletter.
export const knopTekst = (knop, standaard) => (knop ? knop[0].toLocaleUpperCase() + knop.slice(1) : standaard);

// Een melding van de site in regels: de eerste als kop, de rest als alinea's.
export const regelsVan = (tekst) =>
  String(tekst ?? '')
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);

// Wat er mis is met de gekozen bestanden, of niets.
export function bestandFout(bestanden, t) {
  let totaal = 0;
  for (const [, b] of bestanden) {
    if (!/^(image\/(jpeg|png)|application\/pdf)$/.test(b.type)) return t.bonSoort(b.name);
    if (b.size > MAX_BESTAND) return t.bonTeGroot(b.name);
    totaal += b.size;
  }
  return totaal > MAX_TOTAAL ? t.bestandenTeGroot : undefined;
}

const laadRegel = (t) => h('p', { class: 'laadregel' }, h('span', { class: 'draaier', 'aria-hidden': 'true' }), t.laden);

function leesKaart(vak) {
  try {
    const kaart = JSON.parse(vak.dataset.links || '{}');
    return kaart && typeof kaart === 'object' ? kaart : {};
  } catch {
    return {};
  }
}

// Start alle formulieren op de pagina, elk pas als het bijna in beeld is: elke keer
// openen haalt een pagina van curius.nl.
export function start() {
  for (const vak of document.querySelectorAll('[data-openbaar-formulier]')) {
    if (vak.dataset.gestart) continue;
    vak.dataset.gestart = '1';
    wanneerZichtbaar(vak, () => laad(vak));
  }
}

function wanneerZichtbaar(el, doe) {
  if (!('IntersectionObserver' in globalThis)) return doe();
  const kijker = new IntersectionObserver(
    (items) => {
      if (!items.some((i) => i.isIntersecting)) return;
      kijker.disconnect();
      doe();
    },
    { rootMargin: '600px 0px' },
  );
  kijker.observe(el);
}

const openen = (pad) => vraag(`/formulieren/${pad}`, { token: null });

// Kent de server formulieren nog niet (een oudere versie: die vraagt dan om in te
// loggen, of kent het adres niet), dan gaat het formulier zoals vroeger via de oude site.
const serverKentFormulierenNiet = (fout) => fout.status === 401 || (fout.status === 404 && fout.code !== 'geen_formulier');

async function laad(vak, eerder) {
  const t = tekst();
  vul(vak, laadRegel(t));
  try {
    toon(vak, await openen(vak.dataset.pad), eerder);
  } catch (fout) {
    if (serverKentFormulierenNiet(fout)) toonOudeSite(vak);
    else toonNietGeladen(vak, fout.message);
  }
}

function toonOudeSite(vak) {
  const t = tekst();
  const reserve = webAdres(vak.dataset.reserve);
  if (!reserve) return toonNietGeladen(vak, t.ietsMis);
  vul(
    vak,
    h(
      'div',
      { class: 'melding' },
      icoon('file', 24),
      h(
        'div',
        {},
        h('p', {}, t.formulierElders),
        h('a', { class: 'knop knop--primair knop--klein', href: reserve, rel: 'noopener' }, t.formulierOpenen, icoon('external', 16)),
      ),
    ),
  );
}

// Het formulier kan niet worden geladen (de server is even weg, of de site). Dan nog een
// keer proberen, of het formulier op de oude site.
function toonNietGeladen(vak, uitleg) {
  const t = tekst();
  const reserve = webAdres(vak.dataset.reserve);
  vul(
    vak,
    h(
      'div',
      { class: 'melding', role: 'alert' },
      icoon('alert', 24),
      h(
        'div',
        {},
        h('h3', {}, t.formulierNietGeladen),
        h('p', {}, uitleg),
        h(
          'div',
          { class: 'knoppenrij' },
          h('button', { class: 'knop knop--primair knop--klein', type: 'button', onclick: () => laad(vak) }, t.opnieuw),
          reserve && h('a', { class: 'knop knop--rand knop--klein', href: reserve, rel: 'noopener' }, t.formulierOudeSite, icoon('external', 16)),
        ),
      ),
    ),
  );
}

// De som: de vraag als tekst (of als afbeelding), en een vakje voor het antwoord.
function somBlok(veld, robot, id) {
  const t = tekst();
  const vraagDeel = robot.vraag
    ? h('label', { class: 'som__vraag', for: id }, somZonderIs(robot.vraag))
    : h('label', { class: 'som__vraag', for: id }, h('img', { src: robot.afbeelding, alt: t.somAfbeelding }));
  return h(
    'div',
    { class: 'veld veld--som', 'data-som': '' },
    h('span', { class: 'veld__label' }, t.somKop, h('span', { class: 'veld__verplicht' }, ` (${t.verplicht})`)),
    h(
      'div',
      { class: 'som' },
      vraagDeel,
      h('span', { 'aria-hidden': 'true' }, '='),
      h('input', {
        id,
        name: veld.sleutel,
        type: 'text',
        class: 'som__antwoord',
        inputmode: 'numeric',
        pattern: veld.patroon ?? '[0-9]{1,2}',
        maxlength: 3,
        autocomplete: 'off',
        required: true,
        placeholder: '?',
      }),
    ),
  );
}

// Een som die we niet kunnen laten zien, kan niemand beantwoorden.
const kanSomTonen = (robot) => !robot || Boolean(robot.vraag) || /^data:image\//.test(robot.afbeelding ?? '');

function toon(vak, formulier, { waarden, bericht } = {}) {
  const t = tekst();
  const kaart = leesKaart(vak);
  const pad = vak.dataset.pad;
  const naam = vak.id || 'formulier';
  let { code, robot } = formulier;
  let velden = formulier.velden ?? [];
  const uitleg = formulier.uitleg ?? [];
  if (!kanSomTonen(robot)) return toonNietGeladen(vak, t.somOnleesbaar);

  const isSom = (veld) => robot && veld.sleutel === robot.sleutel;
  const uitlegBij = (groep) =>
    uitleg
      .filter((u) => (u.groep ?? '') === groep)
      .map((u) =>
        h(
          'p',
          { class: 'formulier__uitleg' },
          (u.delen ?? []).map((d) => {
            const href = d.link && linkVoor(d.link, kaart);
            return href ? h('a', { href }, d.tekst) : d.tekst;
          }),
        ),
      );
  const groepen = perGroep(velden);
  // Uitleg bij een kopje zonder velden komt bovenaan.
  const losseUitleg = [...new Set(uitleg.map((u) => u.groep ?? ''))].filter((g) => g && !groepen.has(g));

  const meldingVak = h('div', { 'data-formmelding': '', 'aria-live': 'polite' });
  const knop = h('button', { class: 'knop knop--primair', type: 'submit' }, icoon('check', 18), knopTekst(formulier.knop, t.versturen));
  const form = h(
    'form',
    { class: 'formulier', novalidate: true },
    uitlegBij(''),
    losseUitleg.map((g) => h('fieldset', {}, h('legend', {}, g), uitlegBij(g))),
    [...groepen].map(([groep, lijst]) => {
      const blokken = lijst.map((veld) => (isSom(veld) ? somBlok(veld, robot, `${naam}-som`) : veldBlok(veld, `${naam}-${velden.indexOf(veld)}`)));
      const somGroep = lijst.some(isSom) && lijst.length === 1;
      return groep ? h('fieldset', { 'data-somgroep': somGroep || undefined }, h('legend', {}, groep), uitlegBij(groep), blokken) : blokken;
    }),
    meldingVak,
    h('div', { class: 'knoppenrij' }, knop),
  );
  if (waarden) zetWaarden(form, velden, waarden);
  if (bericht) vul(meldingVak, bericht);

  // Een nieuwe som van de site (na een fout antwoord), of geen som meer.
  function zetSom(nieuw) {
    const oud = form.querySelector('[data-som]');
    if (nieuw) {
      let veld = velden.find((v) => v.sleutel === nieuw.sleutel);
      if (!veld) velden = [...velden, (veld = { sleutel: nieuw.sleutel, soort: 'tekst', verplicht: true })];
      const blok = somBlok(veld, nieuw, `${naam}-som`);
      if (oud) oud.replaceWith(blok);
      else meldingVak.before(h('fieldset', { 'data-somgroep': '' }, h('legend', {}, t.somKop), blok));
    } else if (oud) {
      const groep = oud.closest('[data-somgroep]');
      (groep ?? oud).remove();
      velden = velden.filter((v) => v.sleutel !== robot?.sleutel);
    }
    robot = nieuw;
  }

  // Na een fout van de server: de melding, en waar nodig een nieuwe som of het formulier opnieuw.
  async function naFout(fout) {
    const extra = fout.gegevens ?? {};
    const nieuweSom = (r) => (r ? ` ${t.nieuweSom}` : '');
    if (fout.status === 410 || (fout.status === 422 && extra.opnieuw === false)) {
      // Het formulier is verlopen: opnieuw openen. Zijn de velden hetzelfde, dan blijft alles staan.
      try {
        const nieuw = await openen(pad);
        const sleutels = (lijst, r) => JSON.stringify(lijst.filter((v) => v.sleutel !== r?.sleutel).map((v) => [v.sleutel, v.soort]));
        if (sleutels(nieuw.velden ?? [], nieuw.robot) === sleutels(velden, robot) && (!nieuw.robot || robot)) {
          code = nieuw.code;
          zetSom(nieuw.robot);
          vul(meldingVak, melding(fout.message + nieuweSom(nieuw.robot)));
        } else {
          toon(vak, nieuw, { waarden: waardenVan(form, velden), bericht: melding(fout.message + nieuweSom(nieuw.robot)) });
        }
      } catch (nogEen) {
        vul(meldingVak, melding(nogEen.message));
      }
      return;
    }
    if (fout.status === 422) {
      if (Object.hasOwn(extra, 'robot')) zetSom(extra.robot);
      vul(meldingVak, ...regelsVan(fout.message).map((r) => melding(r)), robot ? melding(t.nieuweSom, 'info') : null);
      return;
    }
    vul(meldingVak, melding(fout.message));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    vul(meldingVak);
    // Twee wachtwoorden (wachtwoord en nog een keer): die moeten hetzelfde zijn.
    const wachtwoorden = velden.filter((v) => v.soort === 'wachtwoord').map((v) => form.querySelector(`[name="${CSS.escape(v.sleutel)}"]`));
    if (wachtwoorden.length === 2) wachtwoorden[1].setCustomValidity(wachtwoorden[0].value === wachtwoorden[1].value ? '' : t.wachtwoordenAnders);
    const ongeldig = [...form.elements].find((el) => el.willValidate && !el.checkValidity());
    if (ongeldig) {
      ongeldig.reportValidity();
      return;
    }
    const bestanden = bestandenVan(form, velden);
    const mis = bestandFout(bestanden, t);
    if (mis) return vul(meldingVak, melding(mis));

    const body = new FormData();
    body.set('code', code);
    body.set('gegevens', JSON.stringify(waardenVan(form, velden)));
    for (const [sleutel, bestand] of bestanden) body.append(`bestand:${sleutel}`, bestand, bestand.name);
    try {
      const antwoord = await metBezig(knop, () => vraag(`/formulieren/${pad}`, { methode: 'POST', body, token: null }));
      toonVerstuurd(vak, antwoord?.melding);
    } catch (fout) {
      await naFout(fout);
      meldingVak.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
  });

  // Het tweede wachtwoord weer goed zodra iemand het aanpast.
  form.addEventListener('input', (e) => {
    if (e.target?.type === 'password') e.target.setCustomValidity('');
  });

  vul(vak, form);
}

function toonVerstuurd(vak, tekstNa) {
  const t = tekst();
  const [kop, ...rest] = regelsVan(tekstNa);
  const blok = h(
    'div',
    { class: 'melding melding--goed', role: 'status', tabindex: '-1' },
    icoon('check', 24),
    h('div', {}, h('h3', {}, kop ?? t.formulierVerstuurd), rest.map((r) => h('p', {}, r))),
  );
  vul(vak, blok);
  blok.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  blok.focus?.({ preventScroll: true });
}
