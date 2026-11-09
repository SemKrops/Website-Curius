// Leest de pagina's van de site in Genkgo en zet ze om in "blokken": stukjes
// inhoud met een vaste vorm (tekst, kaarten, personen, vacatures, agenda, ...).
// De nieuwe website tekent elk soort blok in de nieuwe stijl.
//
// Verandert Genkgo de opmaak van de site, dan moeten de stukjes hieronder die de
// HTML lezen mee veranderen. De tests in tests/lezen.test.mjs gebruiken echte
// HTML van curius.nl om dat te controleren.

import {
  absoluut, afbeeldingSrcset, bronPad, echteAfbeelding, grootsteAfbeelding, laadPagina, laadStuk, netjes, schoonHtml,
  tekstVan,
} from './html.mjs';

// ---------------------------------------------------------------------------
// Het menu

export function leesMenu(html) {
  const $ = laadPagina(html);
  const niveau = (ul) =>
    $(ul)
      .children('li')
      .map((_, li) => {
        const a = $(li).children('a').first();
        const href = absoluut(a.attr('href'));
        const sub = $(li).children('ul').first();
        return {
          titel: tekstVan($, a),
          pad: bronPad(href),
          href,
          kinderen: sub.length ? niveau(sub) : [],
        };
      })
      .get()
      .filter((item) => item.titel);
  return niveau($('nav.c-nav > ul').first());
}

// ---------------------------------------------------------------------------
// Kop, voet en de vaste onderdelen van elke pagina

export function leesAlgemeen(html) {
  const $ = laadPagina(html);
  const sociaal = $('header .c-social-links a, .c-footer .c-social-links a')
    .map((_, a) => ({ naam: tekstVan($, a), href: absoluut($(a).attr('href')) }))
    .get()
    .filter((s, i, lijst) => s.href && lijst.findIndex((t) => t.href === s.href) === i);
  const partners = $('article.c-banners a')
    .map((_, a) => ({
      naam: netjes($(a).find('img').attr('alt')) || netjes($(a).text()),
      logo: absoluut($(a).find('img').attr('src')),
      href: absoluut($(a).attr('href')),
    }))
    .get()
    .filter((p) => p.logo);
  const contactHtml = $('.c-footer__contact__item').first().html() ?? '';
  return { sociaal, partners, contact: leesContact(contactHtml) };
}

// De gegevens onderin de site: adres, telefoon, e-mail, KvK.
function leesContact(html) {
  const regels = String(html)
    .split(/<br\s*\/?>|<\/div>|\n/i)
    .map((r) => netjes(laadStuk(r).root().text()))
    .filter(Boolean);
  const uit = { regels };
  for (const r of regels) {
    if (/@/.test(r)) uit.email ??= r.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0];
    else if (/^tel/i.test(r)) uit.telefoon ??= r.replace(/^tel[.:]?\s*/i, '');
    else if (/k\.?v\.?k/i.test(r)) uit.kvk ??= r.replace(/^k\.?v\.?k\.?:?\s*/i, '');
    else if (/rekening|iban/i.test(r)) uit.rekening ??= r.replace(/^[^:]*:\s*/, '');
    else if (/^\d{4}\s?[a-z]{2}/i.test(r)) uit.postcode ??= r.replace(/,\s*/, ' ');
    else uit.adres ??= r;
  }
  return uit;
}

// ---------------------------------------------------------------------------
// Een pagina

export function leesPagina(html) {
  const $ = laadPagina(html);
  const main = $('main').first();
  const titel = tekstVan($, main.find('h1.c-page-title').first()) || netjes($('title').text()).replace(/\s*-\s*Curius$/i, '');
  const blokken = [];
  main.children().each((_, el) => leesElement($, el, blokken));
  const ogBeschrijving = netjes($('meta[name="description"]').attr('content'));
  return { titel, blokken: voegSamen(blokken), beschrijving: ogBeschrijving || undefined };
}

const isWikkel = ($el) =>
  $el.is('div, article, section') && $el.children().length > 0 && !$el.is('.text, .c-text, .description');

function voegHtml(blokken, html) {
  const schoon = schoonHtml(html ?? '');
  if (schoon) blokken.push({ type: 'html', html: schoon });
}

// Twee tekstblokken na elkaar worden één blok.
function voegSamen(blokken) {
  const uit = [];
  for (const blok of blokken) {
    const vorige = uit[uit.length - 1];
    if (blok.type === 'html' && vorige?.type === 'html') vorige.html += '\n' + blok.html;
    else uit.push(blok);
  }
  return uit;
}

// Een formulier voor iedereen: de website laat het zelf zien via de Curius server
// (lib/formulier.mjs), die de velden van curius.nl leest. Hier alleen op welke pagina
// het formulier staat (uit het adres waar het naartoe gaat, zoals nl/contact!920) en de
// links in de uitleg, zodat die straks naar pagina's op deze site kunnen.
export function leesFormulier($, $el) {
  const actie = String($el.find('form').first().attr('action') ?? '');
  const pad = actie.replace(/[!?#].*$/, '').replace(/^\/+|\/+$/g, '');
  const links = [];
  $el.find('a[href]').each((_, a) => {
    const href = $(a).attr('href');
    const van = bronPad(href);
    if (van && !links.some((l) => l.van === van)) links.push({ van, href });
  });
  return { type: 'formulier', pad: /^(nl|en)\/[\w/.-]+$/.test(pad) ? pad : undefined, links };
}

function leesElement($, el, blokken) {
  const $el = $(el);
  if (el.type !== 'tag') return;
  if ($el.is('h1.c-page-title, .c-breadcrumb, .event__login-question, .c-image-slider-nav-A, script, style')) return;

  if ($el.is('article.text, section.c-text, .c-committee__text, .c-blog-article__message')) return voegHtml(blokken, $el.html());
  if ($el.is('ul.o-tiles')) return leesTegels($, $el, blokken);
  if ($el.is('table.c-meta-table')) return leesMetaTabel($, $el, blokken);
  if ($el.is('img')) {
    const src = grootsteAfbeelding($, el);
    if (src) blokken.push({ type: 'afbeelding', src, alt: netjes($el.attr('alt')) });
    return;
  }
  if ($el.is('.c-image-slider-A')) return leesDias($, $el, blokken);
  if ($el.is('.c-quicklinks')) return leesSnelkoppelingen($, $el, blokken);
  if ($el.is('.career.companies')) return leesBedrijven($, $el, blokken);
  if ($el.is('.career-search-container')) return leesVacatureZoeker($, $el, blokken);
  if ($el.is('.career-profile, .career-element')) return leesCarriereProfiel($, $el, blokken);
  if ($el.is('.career-profile-items')) return leesVacatureGroepen($, $el, blokken);
  if ($el.is('.c-fullcalendar')) return blokken.push({ type: 'agenda', items: leesKalender($, $el) });
  // Een formulier voor iedereen (zoals contact, lid worden of wachtwoord vergeten).
  if ($el.is('.customform, #changepassword')) return blokken.push(leesFormulier($, $el));
  if ($el.is('.c-blog-article__header')) {
    const datum = tekstVan($, $el.find('.c-blog-article__time'));
    if (datum) blokken.push({ type: 'datum', tekst: datum });
    return;
  }
  if ($el.is('.o-module')) {
    // Een blok met een kop ("Activiteiten") en een link onderaan ("Bekijk alle activiteiten").
    const kop = $el.children('.o-module__heading').first();
    const link = $el.children('.o-module__link').first();
    const binnen = [];
    $el.children().not(kop).not(link).each((_, kind) => leesElement($, kind, binnen));
    if (binnen.length && kop.length) binnen[0].titel ??= tekstVan($, kop);
    if (binnen.length && link.length) binnen[binnen.length - 1].meer = { tekst: tekstVan($, link), href: absoluut(link.attr('href')) };
    blokken.push(...binnen);
    return;
  }
  if ($el.is('h2, h3, h4') && $el.hasClass('c-module-heading')) return blokken.push({ type: 'kop', tekst: tekstVan($, $el) });
  if (isWikkel($el)) {
    $el.children().each((_, kind) => leesElement($, kind, blokken));
    return;
  }
  voegHtml(blokken, $.html(el));
}

// Tegels: kaarten (activiteiten, nieuws, commissies), personen of downloads.
function leesTegels($, $ul, blokken) {
  const items = $ul.children('li').children('article');
  if (!items.length) return;
  const eerste = items.first();

  if (eerste.is('.c-person')) {
    const personen = [];
    const downloads = [];
    items.each((_, art) => {
      const $a = $(art);
      const titelLink = $a.find('.c-person__title a').first();
      const foto = echteAfbeelding(absoluut($a.find('img').attr('src')));
      if (titelLink.length) {
        downloads.push({ titel: tekstVan($, titelLink), href: absoluut(titelLink.attr('href')), afbeelding: foto });
      } else {
        personen.push({
          naam: tekstVan($, $a.find('.c-person__title')),
          rol: tekstVan($, $a.find('.c-person__role')) || undefined,
          foto,
        });
      }
    });
    if (downloads.length) blokken.push({ type: 'downloads', items: downloads });
    if (personen.length) blokken.push({ type: 'personen', personen });
    return;
  }

  const kaarten = items
    .map((_, art) => {
      const $a = $(art);
      const img = $a.find('img').first();
      return {
        titel: tekstVan($, $a.find('.o-card__title, .o-flag__title').first()),
        ondertitel: tekstVan($, $a.find('.o-card__subtitle, .o-flag__subtitle').first()) || undefined,
        voet: tekstVan($, $a.find('.o-card__footer, .o-flag__footer').first()) || undefined,
        href: absoluut($a.find('a.o-card__link, a.o-flag__link, a').first().attr('href')),
        afbeelding: grootsteAfbeelding($, img),
        srcset: echteAfbeelding(absoluut(img.attr('src'))) ? afbeeldingSrcset($, img) : undefined,
      };
    })
    .get()
    .filter((k) => k.titel);
  if (kaarten.length) blokken.push({ type: 'kaarten', kaarten });
}

function leesMetaTabel($, $tabel, blokken) {
  const rijen = $tabel
    .find('tr')
    .map((_, tr) => {
      const label = tekstVan($, $(tr).find('th').first());
      const td = $(tr).find('td').first();
      const link = td.find('a').first();
      return { label, waarde: tekstVan($, td), href: link.length ? absoluut(link.attr('href')) : undefined };
    })
    .get()
    .filter((r) => r.label && r.waarde);
  if (rijen.length) blokken.push({ type: 'gegevens', rijen });
}

function leesDias($, $el, blokken) {
  const dias = $el
    .find('.c-image-slide-B')
    .map((_, dia) => {
      const $d = $(dia);
      const link = $d.find('a.c-image-slide-B__link, a.c-image-slide-B__btn').first();
      const img = $d.find('img').first();
      return {
        titel: tekstVan($, $d.find('.c-image-slide-B__title')),
        tekst: netjes($d.find('.c-image-slide-B__txt').text()) || undefined,
        knop: tekstVan($, $d.find('.c-image-slide-B__btn')) || undefined,
        href: absoluut(link.attr('href')),
        afbeelding: grootsteAfbeelding($, img),
      };
    })
    .get()
    .filter((d) => d.titel || d.afbeelding);
  if (dias.length) blokken.push({ type: 'dias', dias });
}

function leesSnelkoppelingen($, $el, blokken) {
  const links = $el
    .find('a')
    .map((_, a) => ({ titel: tekstVan($, a), href: absoluut($(a).attr('href')) }))
    .get()
    .filter((l) => l.titel && l.href);
  if (links.length) blokken.push({ type: 'snelkoppelingen', titel: tekstVan($, $el.find('.c-quicklinks__title')), links });
}

function leesBedrijven($, $el, blokken) {
  const bedrijven = $el
    .find('.company-list__item a.career-item, a.career-item')
    .map((_, a) => ({
      naam: tekstVan($, $(a).find('.name')),
      logo: echteAfbeelding(absoluut($(a).find('img').attr('src'))),
      beschrijving: tekstVan($, $(a).find('.description')) || undefined,
      href: absoluut($(a).attr('href')),
    }))
    .get()
    .filter((b) => b.naam);
  if (bedrijven.length) blokken.push({ type: 'bedrijven', bedrijven });
}

const leesDatumAttribuut = (tekst) => {
  // " 11/05/2026" (Engels: maand/dag) of " 05-11-2026" (Nederlands: dag-maand).
  const m = String(tekst ?? '').trim().match(/^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/);
  if (!m) return undefined;
  const [dag, maand] = m[2] === '/' ? [+m[3], +m[1]] : [+m[1], +m[3]];
  return `${m[4]}-${String(maand).padStart(2, '0')}-${String(dag).padStart(2, '0')}`;
};

function leesVacatureZoeker($, $el, blokken) {
  const vacatures = $el
    .find('.career-list a.career-item')
    .map((_, a) => {
      const $a = $(a);
      const zonderLabel = (sel) => netjes($a.find(sel).clone().children('em').remove().end().text()) || undefined;
      return {
        titel: tekstVan($, $a.find('.name')),
        href: absoluut($a.attr('href')),
        bedrijf: tekstVan($, $a.find('.company-name')) || undefined,
        logo: echteAfbeelding(absoluut($a.find('img').attr('src'))),
        locatie: zonderLabel('.location'),
        niveau: zonderLabel('.field'),
        soort: zonderLabel('.type'),
        samenvatting: tekstVan($, $a.find('.description')).replace(/\s*\.\.\.$/, '…') || undefined,
        datum: leesDatumAttribuut($a.attr('data-publish-at')),
      };
    })
    .get()
    .filter((v) => v.titel);
  if (vacatures.length) blokken.push({ type: 'vacatures', vacatures });
}

function leesVacatureGroepen($, $el, blokken) {
  $el.find('h4').each((_, h4) => {
    const soort = tekstVan($, h4);
    const vacatures = $(h4)
      .nextAll('ul.career-list')
      .first()
      .find('a.career-item')
      .map((_, a) => ({
        titel: tekstVan($, $(a).find('.career-item-name')),
        href: absoluut($(a).attr('href')),
        niveau: tekstVan($, $(a).find('.career-item-field')) || undefined,
        soort,
        datum: leesDatumAttribuut($(a).attr('data-publish-at')),
      }))
      .get()
      .filter((v) => v.titel);
    if (vacatures.length) blokken.push({ type: 'vacatures', titel: soort, vacatures });
  });
}

// Profiel van een partnerbedrijf, of een vacature: logo, gegevens en beschrijving.
function leesCarriereProfiel($, $el, blokken) {
  const logo = echteAfbeelding(absoluut($el.find('.logo img').first().attr('src')));
  if (logo) blokken.push({ type: 'logo', src: logo, alt: netjes($el.find('.logo img').attr('alt')) });
  const rijen = [];
  $el.find('dl.main-info dt').each((_, dt) => {
    const dd = $(dt).next('dd');
    const link = dd.find('a').first();
    rijen.push({ label: tekstVan($, dt), waarde: tekstVan($, dd), href: link.length ? absoluut(link.attr('href')) : undefined });
  });
  if (rijen.filter((r) => r.waarde).length) blokken.push({ type: 'gegevens', rijen: rijen.filter((r) => r.waarde) });
  const beschrijving = $el.children('.description').first();
  if (beschrijving.length) voegHtml(blokken, beschrijving.html());
}

// De kalender (nl/activiteiten/kalender): alle activiteiten met begin- en eindtijd.
//   <div data-begindate="2026-10-06T13:30:00+02:00" data-enddate="..." data-can-apply="1"
//        data-type="curius"><a href="en/events/info/1107-...">Titel</a><p>...</p></div>
export function leesKalender($, $el) {
  return $el
    .find('div[data-begindate]')
    .map((_, div) => {
      const $d = $(div);
      const a = $d.find('a').first();
      const href = absoluut(a.attr('href'));
      const id = bronPad(href)?.match(/\/info\/(\d+)/)?.[1];
      const tekst = $d.children('p').map((_, p) => $.html(p)).get().join('\n');
      return {
        id,
        titel: tekstVan($, a),
        href,
        start: $d.attr('data-begindate') || undefined,
        eind: $d.attr('data-enddate') || undefined,
        kanInschrijven: $d.attr('data-can-apply') === '1',
        soort: netjes($d.attr('data-type')) || undefined,
        html: tekst ? schoonHtml(tekst) : undefined,
      };
    })
    .get()
    .filter((a) => a.id && a.start);
}
