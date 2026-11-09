// Maakt van de verzamelde site een geheel:
// * links naar pagina's die op de nieuwe site staan worden links binnen de nieuwe site;
// * links naar wat alleen op de oude site staat (inloggen, formulieren) gaan daarheen;
// * elke pagina krijgt een kruimelpad, haar plek in het menu en haar tegenhanger
//   in de andere taal.

import { absoluut, bronPad, echteAfbeelding, hashVan, laadStuk, platteTekst, samenvatting } from './html.mjs';
import { LEDEN_URL, TALEN } from './instellingen.mjs';
import { DETAILS, VASTE_PADEN, alleKnopen, herkenDetail, isLedenPad, taalVan } from './verzamelen.mjs';

export function koppel(ruw, { basis = '/' } = {}) {
  const site = structuredClone(ruw);
  basis = basis.endsWith('/') ? basis : basis + '/';
  site.basis = basis;
  const paginas = site.paginas;

  // Per taal en soort detailpagina: sleutel naar pad.
  const detailIndex = new Map();
  for (const pagina of Object.values(paginas)) {
    const detail = herkenDetail(pagina.pad);
    if (detail) detailIndex.set(`${pagina.taal}|${detail.sleutel}`, pagina.pad);
  }

  const interneLink = (pad, hash = '') => `${basis}${pad}/${hash}`;
  const oudeSite = (pad, hash = '') => `${LEDEN_URL}/${pad}${hash}`;

  // Een link van de oude site omzetten. `taal` is de taal van de pagina waar hij op staat.
  const zoek = (href, taal) => {
    const abs = absoluut(href);
    const pad = bronPad(abs);
    if (!pad) return { href: abs ?? href, extern: /^https?:/i.test(abs ?? '') };
    const hash = hashVan(abs);
    const detail = herkenDetail(pad);
    if (detail) {
      const doel = detailIndex.get(`${taal}|${detail.sleutel}`) ?? detailIndex.get(`${taalVan(pad)}|${detail.sleutel}`);
      if (doel) return { href: interneLink(doel, hash), pad: doel };
    }
    if (paginas[pad]) return { href: interneLink(pad, hash), pad };
    return { href: oudeSite(pad, hash), oud: true };
  };
  site.zoek = zoek;

  // Alle links in de blokken omzetten.
  for (const pagina of Object.values(paginas)) {
    for (const blok of pagina.blokken) zetLinksOm(blok, (href) => zoek(href, pagina.taal));
  }
  for (const taal of TALEN) {
    for (const partner of site.talen[taal].partners) partner.href = zoek(partner.href, taal).href;
  }

  // Het menu: elke knoop krijgt een link (binnen de site, naar buiten of naar het ledendeel).
  for (const taal of TALEN) {
    for (const { knoop } of alleKnopen(site.talen[taal].menu)) {
      if (knoop.extern) knoop.link = { href: knoop.extern, extern: true };
      else if (knoop.pad && paginas[knoop.pad]) knoop.link = { href: interneLink(knoop.pad), pad: knoop.pad };
      else if (knoop.pad) knoop.link = { href: oudeSite(knoop.pad), oud: true };
    }
    // Weg: pagina's die niet (meer) bestaan, en de knop Home (het logo is al de link naar home).
    site.talen[taal].menu = snoei(site.talen[taal].menu.filter((k) => k.pad !== taal));
  }

  // Kruimelpad en sectie voor pagina's uit het menu.
  for (const taal of TALEN) {
    for (const { knoop, ouders } of alleKnopen(site.talen[taal].menu)) {
      const pagina = knoop.pad && paginas[knoop.pad];
      if (!pagina || pagina.kruimels) continue;
      pagina.kruimels = ouders.filter((o) => o.link?.pad).map((o) => ({ titel: o.titel, href: o.link.href }));
      pagina.sectie = (ouders[0] ?? knoop).pad;
      pagina.menuTitel = knoop.titel;
      if (knoop.kinderen?.length) pagina.knoopKinderen = knoop.kinderen;
    }
  }

  // Kruimelpad voor de detailpagina's (en het nieuws, dat niet in het menu staat).
  for (const pagina of Object.values(paginas)) {
    if (pagina.kruimels || pagina.soort === 'home') continue;
    const detail = herkenDetail(pagina.pad);
    let ouderPad = detail?.soort.ouder[pagina.taal];
    // Een commissie met het jaar in het pad valt onder de pagina van dat jaar.
    const jaarPad = pagina.pad.split('/').slice(0, -1).join('/');
    if (detail?.soort.soort === 'commissie' && paginas[jaarPad]) ouderPad = jaarPad;
    while (ouderPad && !paginas[ouderPad]) ouderPad = ouderPad.split('/').slice(0, -1).join('/');
    const ouder = ouderPad && paginas[ouderPad];
    if (ouder && ouder.pad !== pagina.taal) {
      pagina.kruimels = [...(ouder.kruimels ?? []), { titel: ouder.menuTitel ?? ouder.titel, href: interneLink(ouder.pad) }];
      pagina.sectie = ouder.sectie ?? ouder.pad;
    } else {
      pagina.kruimels = [];
    }
  }

  // Hubpagina's: een pagina met onderliggende pagina's toont die als kaarten.
  for (const pagina of Object.values(paginas)) {
    if (!pagina.knoopKinderen) continue;
    pagina.kinderen = pagina.knoopKinderen
      .filter((k) => k.link)
      .map((k) => {
        const kind = k.link.pad && paginas[k.link.pad];
        const eersteTekst = kind?.blokken.find((b) => b.type === 'html');
        return {
          titel: k.titel,
          href: k.link.href,
          extern: !!k.link.extern || !!k.link.oud,
          leden: !!k.leden || kind?.soort === 'leden',
          samenvatting: eersteTekst ? samenvatting(eersteTekst.html, 140) : undefined,
          afbeelding: kind ? eersteAfbeelding(kind) : undefined,
          aantal: k.kinderen?.filter((kk) => kk.link).length || undefined,
        };
      });
    delete pagina.knoopKinderen;

    // Veel hubpagina's op de oude site herhalen de tekst van een onderliggende
    // pagina (Vereniging = Over Curius, Bestuur = Huidig bestuur). Dan tonen we
    // alleen een korte inleiding met een link naar die pagina.
    const tekst = pagina.blokken.find((b) => b.type === 'html');
    if (tekst) {
      for (const k of pagina.kinderen) {
        const kind = paginas[(k.href.slice(basis.length) || '').replace(/\/$/, '')];
        const kindTekst = kind?.blokken.find((b) => b.type === 'html');
        if (kindTekst && lijktOp(platteTekst(tekst.html), platteTekst(kindTekst.html))) {
          pagina.inleiding = { tekst: samenvatting(tekst.html, 260), href: k.href, titel: k.titel };
          pagina.blokken = pagina.blokken.filter((b) => b !== tekst);
          break;
        }
      }
    }

    // Heet de hubpagina hetzelfde als een onderliggende pagina (Bestuur heet op de oude
    // site "Huidig bestuur", Carrière "Career platform"), dan krijgt hij de naam uit het menu.
    const kindTitels = pagina.kinderen.map((k) => paginas[k.href.slice(basis.length).replace(/\/$/, '')]?.titel);
    if (pagina.menuTitel && (pagina.inleiding || kindTitels.includes(pagina.titel))) pagina.titel = pagina.menuTitel;
  }

  // Beschrijving (voor zoekmachines en het delen van links) en afbeelding.
  for (const pagina of Object.values(paginas)) {
    const tekst = pagina.blokken.find((b) => b.type === 'html');
    pagina.beschrijving ??= tekst ? samenvatting(tekst.html, 160) : pagina.inleiding?.tekst;
    pagina.afbeelding = pagina.activiteit?.poster ?? eersteAfbeelding(pagina);
  }

  // Activiteiten: de link naar de pagina op de nieuwe site, of anders naar de oude.
  for (const taal of TALEN) {
    for (const a of site.activiteiten[taal]) {
      a.href = a.pad ? interneLink(a.pad) : zoek(`${DETAILS[0].pad({ 1: a.id }, taal)}`, taal).href;
      a.inschrijfLink = oudeSite(DETAILS[0].pad({ 1: a.id }, taal));
    }
  }

  koppelTalen(site);

  // Vaste links per taal, voor in de kop en voet.
  site.links = {};
  for (const taal of TALEN) {
    const vast = VASTE_PADEN[taal];
    const link = (pad) => (paginas[pad] ? interneLink(pad) : oudeSite(pad));
    site.links[taal] = {
      home: interneLink(taal),
      activiteiten: link(vast.activiteiten),
      kalender: link(vast.kalender),
      archief: link(vast.archief),
      nieuws: link(vast.nieuws),
      contact: link(vast.contact),
      lidWorden: link(vast.lidWorden),
      leden: oudeSite(vast.leden),
      inloggen: `${LEDEN_URL}/login`,
      agendaFeed: `${basis}${taal}/agenda.ics`,
    };
  }
  return site;
}

// Weg uit het menu: pagina's die niet (meer) bestaan en knoppen zonder link (zoals Inloggen).
function snoei(menu) {
  return menu
    .filter((k) => !k.weg)
    .map((k) => ({ ...k, kinderen: snoei(k.kinderen ?? []) }))
    .filter((k) => k.link || k.kinderen.length);
}

function zetLinksOm(blok, zoek) {
  if (blok.type === 'html') {
    const $ = laadStuk(blok.html);
    $('a[href]').each((_, a) => {
      const doel = zoek($(a).attr('href'));
      $(a).attr('href', doel.href);
      if (doel.extern) $(a).attr('rel', 'noopener');
    });
    blok.html = $.html();
  }
  for (const lijst of [blok.kaarten, blok.items, blok.bedrijven, blok.vacatures, blok.rijen, blok.links, blok.dias]) {
    for (const item of lijst ?? []) {
      if (!item.href) continue;
      const doel = zoek(item.href);
      item.href = doel.href;
      item.intern = !!doel.pad;
      if (doel.pad) item.pad = doel.pad;
    }
  }
  if (blok.meer?.href) blok.meer.href = zoek(blok.meer.href).href;
}

function eersteAfbeelding(pagina) {
  for (const blok of pagina.blokken) {
    if (blok.type === 'afbeelding' || blok.type === 'logo') return blok.src;
    if (blok.type === 'html') {
      const src = blok.html.match(/<img[^>]+src="([^"]+)"/)?.[1];
      if (echteAfbeelding(src)) return src.replace(/&amp;/g, '&');
    }
    if (blok.type === 'kaarten') {
      const metBeeld = blok.kaarten.find((k) => k.afbeelding);
      if (metBeeld) return metBeeld.afbeelding;
    }
  }
  return undefined;
}

const woorden = (tekst) => new Set(tekst.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let samen = 0;
  for (const w of a) if (b.has(w)) samen++;
  return samen / (a.size + b.size - samen);
}
// Hoeveel twee korte teksten op elkaar lijken (0 tot 1), zoals "Assortiment" en "Assortment".
function gelijkend(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a === b) return 1;
  const vorige = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let links = i;
    let schuin = i - 1;
    for (let j = 1; j <= b.length; j++) {
      const boven = vorige[j];
      const nieuw = Math.min(boven + 1, links + 1, schuin + (a[i - 1] === b[j - 1] ? 0 : 1));
      schuin = boven;
      vorige[j] = links = nieuw;
    }
  }
  return 1 - vorige[b.length] / Math.max(a.length, b.length, 1);
}

const lijktOp = (a, b) => a.length > 40 && overlap(woorden(a), woorden(b)) > 0.85;

// ---------------------------------------------------------------------------
// Welke pagina in het Engels hoort bij welke pagina in het Nederlands?
//
// De oude site zegt dat nergens. Voor activiteiten, commissies, bedrijven en
// vacatures is het nummer of de naam in het adres gelijk. Voor de pagina's uit
// het menu vergelijken we de menu's: per niveau zoeken we de paren die het
// meest op elkaar lijken (dezelfde afbeeldingen, e-mailadressen, links en
// jaartallen, en evenveel onderliggende pagina's).

function koppelTalen(site) {
  const { paginas } = site;
  const zet = (a, b) => {
    if (paginas[a] && paginas[b]) {
      paginas[a].ander ??= site.basis + b + '/';
      paginas[b].ander ??= site.basis + a + '/';
    }
  };
  zet('nl', 'en');

  const perSleutel = new Map();
  for (const pagina of Object.values(paginas)) {
    const detail = herkenDetail(pagina.pad);
    if (!detail) continue;
    const paar = perSleutel.get(detail.sleutel) ?? {};
    paar[pagina.taal] = pagina.pad;
    perSleutel.set(detail.sleutel, paar);
  }
  for (const paar of perSleutel.values()) if (paar.nl && paar.en) zet(paar.nl, paar.en);

  const kenmerken = new Map();
  const kenmerkenVan = (knoop) => {
    if (kenmerken.has(knoop)) return kenmerken.get(knoop);
    const set = new Set();
    for (const getal of knoop.titel.match(/\d{2,4}/g) ?? []) set.add('t:' + getal);
    const pagina = knoop.pad && paginas[knoop.pad];
    for (const blok of pagina?.blokken ?? []) {
      const tekst = JSON.stringify(blok);
      for (const m of tekst.matchAll(/(?:src|href|afbeelding|foto|logo|poster)\\?"?[:=]\\?"([^"\\]+)/g)) {
        const url = m[1];
        if (/^mailto:/i.test(url)) set.add(url.toLowerCase());
        else if (/\.(png|jpe?g|gif|webp|pdf|mp4)/i.test(url) || /\/image$/.test(url)) set.add('b:' + url.split('/').slice(-3).join('/'));
        else if (/^https?:/i.test(url) && !bronPad(url)) set.add('l:' + url.replace(/^https?:\/\/(www\.)?/, ''));
      }
      for (const getal of tekst.match(/\b\d{4,}\b/g) ?? []) set.add('g:' + getal);
      for (const m of tekst.matchAll(/(?:info|commissies|committees)\/(?:[^/"]+\/)?(\d{3,})/g)) set.add('d:' + m[1]);
    }
    for (const kind of knoop.kinderen ?? []) for (const k of kenmerkenVan(kind)) set.add(k);
    kenmerken.set(knoop, set);
    return set;
  };

  const score = (a, b) => {
    let s = overlap(kenmerkenVan(a), kenmerkenVan(b));
    if ((a.kinderen?.length ?? 0) === (b.kinderen?.length ?? 0)) s += 0.15;
    if (gelijkend(a.titel, b.titel) > 0.75) s += 0.5;
    const getallenA = (a.titel.match(/\d+/g) ?? []).join(' ');
    if (getallenA && getallenA === (b.titel.match(/\d+/g) ?? []).join(' ')) s += 0.5;
    if (a.pad && b.pad && a.pad.split('/').pop() === b.pad.split('/').pop()) s += 0.5;
    if (!!a.extern === !!b.extern && a.extern) s += a.extern === b.extern ? 1 : 0;
    return s;
  };

  const koppelNiveau = (lijstA, lijstB) => {
    const paren = [];
    for (const a of lijstA) for (const b of lijstB) paren.push({ a, b, s: score(a, b) });
    paren.sort((x, y) => y.s - x.s);
    const bezetA = new Set();
    const bezetB = new Set();
    const gekoppeld = [];
    for (const { a, b, s } of paren) {
      if (s < 0.2 || bezetA.has(a) || bezetB.has(b)) continue;
      bezetA.add(a);
      bezetB.add(b);
      gekoppeld.push([a, b]);
    }
    // Blijft er aan beide kanten precies één over, dan horen die bij elkaar.
    const restA = lijstA.filter((a) => !bezetA.has(a));
    const restB = lijstB.filter((b) => !bezetB.has(b));
    if (restA.length === 1 && restB.length === 1) gekoppeld.push([restA[0], restB[0]]);
    for (const [a, b] of gekoppeld) {
      if (a.pad && b.pad) zet(a.pad, b.pad);
      if (a.kinderen?.length && b.kinderen?.length) koppelNiveau(a.kinderen, b.kinderen);
    }
  };
  koppelNiveau(site.talen.nl.menu, site.talen.en.menu);
  // Het nieuws staat niet in het menu.
  zet(VASTE_PADEN.nl.nieuws, VASTE_PADEN.en.nieuws);

  // Zonder tegenhanger gaat de taalknop naar de homepagina van de andere taal.
  for (const pagina of Object.values(paginas)) {
    pagina.ander ??= site.basis + (pagina.taal === 'nl' ? 'en' : 'nl') + '/';
    if (isLedenPad(pagina.pad)) pagina.leden = true;
  }
}
