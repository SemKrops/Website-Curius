// Hulpjes om HTML van de site in Genkgo te lezen en op te schonen.

import * as cheerio from 'cheerio';
import { BRON_URL, isBronHost } from './instellingen.mjs';

export const laadPagina = (html) => cheerio.load(html ?? '');
export const laadStuk = (html) => cheerio.load(html ?? '', null, false);

// Witruimte netjes: één spatie, geen spaties aan het begin of eind.
export const netjes = (tekst) => String(tekst ?? '').replace(/[\s ]+/g, ' ').trim();

export const tekstVan = ($, el) => netjes($(el).text());

// Een adres van de site (vaak relatief, zoals "f/files/..." of "/_/...") als volledig adres.
export function absoluut(href) {
  if (!href) return undefined;
  const schoon = String(href).trim();
  if (!schoon || /^(javascript|data):/i.test(schoon)) return undefined;
  if (/^(mailto|tel):/i.test(schoon)) return schoon;
  try {
    return new URL(schoon, BRON_URL + '/').href;
  } catch {
    return undefined;
  }
}

// Het pad van een pagina op de site, zonder slash aan het begin of eind:
// "https://www.curius.nl/nl/vereniging/" wordt "nl/vereniging". Alleen voor
// pagina's in het Nederlands of Engels op de site zelf, anders undefined.
export function bronPad(href) {
  const url = absoluut(href);
  if (!url || !/^https?:/i.test(url)) return undefined;
  const u = new URL(url);
  if (!isBronHost(u.host)) return undefined;
  const pad = decodeURIComponent(u.pathname).replace(/^\/+|\/+$/g, '');
  if (!/^(nl|en)(\/|$)/.test(pad)) return undefined;
  return pad;
}

export const hashVan = (href) => {
  const i = String(href ?? '').indexOf('#');
  return i >= 0 ? String(href).slice(i) : '';
};

// Zonder poster toont de site het logo; dat is geen echte afbeelding.
export const echteAfbeelding = (url) => (url && !/\/build\/img\//i.test(url) ? url : undefined);

// De scherpste versie van een afbeelding, uit srcset ("a.png 200w, b.png 1600w") of src.
export function grootsteAfbeelding($, img) {
  if (!img || !$(img).length) return undefined;
  const srcset = $(img).attr('srcset') ?? '';
  const src = $(img).attr('src');
  const kandidaten = srcset
    .split(',')
    .map((deel) => deel.trim().split(/\s+/))
    .filter(([url]) => url)
    .map(([url, breedte]) => ({ url, w: parseInt(breedte, 10) || 0 }));
  if (src) kandidaten.push({ url: src, w: Number(src.match(/\/resize\/(\d+)/)?.[1] ?? 1) });
  kandidaten.sort((a, b) => b.w - a.w);
  // Niet groter dan nodig: de versie van 800 pixels breed is scherp genoeg voor kaarten.
  const passend = kandidaten.find((k) => k.w > 0 && k.w <= 1000) ?? kandidaten[0];
  return echteAfbeelding(absoluut(passend?.url));
}

// Een versie van een afbeelding van een bepaalde breedte, als de site die heeft.
export function afbeeldingSrcset($, img) {
  const srcset = $(img).attr('srcset');
  if (!srcset) return undefined;
  return srcset
    .split(',')
    .map((deel) => deel.trim().split(/\s+/))
    .filter(([url, b]) => url && b)
    .map(([url, b]) => `${absoluut(url)} ${b}`)
    .join(', ');
}

const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|player\.vimeo\.com|google\.com)$/i;
const WEG_ATTRIBUTEN = new Set([
  'style', 'width', 'height', 'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'bgcolor',
  'class', 'face', 'size', 'color', 'frameborder', 'name', 'lang', 'dir', 'hspace', 'vspace', 'itemprop',
  'itemscope', 'itemtype', 'tabindex', 'sizes',
]);

const isLeeg = ($, el) => {
  const $el = $(el);
  if ($el.find('img, video, iframe, table, a[id]').length) return false;
  return netjes($el.text()) === '';
};

// Schone HTML voor op de nieuwe site: zonder opmaak uit de editor van Genkgo
// (vaste breedtes, lettertypes, kleuren), met volledige adressen en lazy loading.
export function schoonHtml(html) {
  const $ = laadStuk(html);
  $('script, style, noscript, form, input, button, select, textarea, link, meta').remove();

  // Video's uit de editor: alleen de video zelf bewaren.
  $('div.ckeditor-html5-video').each((_, el) => {
    $(el).replaceWith(`<figure class="video">${$(el).find('video').toString()}</figure>`);
  });

  // Ingesloten pagina's: YouTube en Vimeo blijven, de rest wordt een gewone link.
  $('iframe').each((_, el) => {
    const src = absoluut($(el).attr('src'));
    let host = '';
    try {
      host = new URL(src).host;
    } catch {
      // geen geldig adres
    }
    if (src && VIDEO_HOSTS.test(host)) {
      $(el).attr('src', src).attr('loading', 'lazy').attr('allowfullscreen', '');
      $(el).wrap('<figure class="video"></figure>');
    } else if (src) {
      $(el).replaceWith(`<p><a href="${src}">Bekijk de inhoud</a></p>`);
    } else {
      $(el).remove();
    }
  });

  $('*').each((_, el) => {
    for (const naam of Object.keys(el.attribs ?? {})) {
      if (WEG_ATTRIBUTEN.has(naam) || naam.startsWith('on') || naam.startsWith('data-')) $(el).removeAttr(naam);
    }
  });

  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const abs = absoluut(href);
      if (abs) $(el).attr('href', abs);
      else $(el).removeAttr('href');
    }
    // Een anker zonder link (<a id="boeken"></a>) blijft alleen als doel.
    if (!$(el).attr('href') && !$(el).attr('id')) $(el).replaceWith($(el).contents());
  });

  $('img').each((_, el) => {
    const src = absoluut($(el).attr('src'));
    if (!src) return void $(el).remove();
    $(el).attr('src', src).attr('loading', 'lazy').attr('decoding', 'async');
    if (!$(el).attr('alt')) $(el).attr('alt', '');
    $(el).removeAttr('srcset');
  });

  $('video, source').each((_, el) => {
    const src = absoluut($(el).attr('src'));
    if (src) $(el).attr('src', src);
    $(el).attr('preload', 'metadata');
  });

  // Tabellen: een tabel met tabellen of alleen plaatjes erin is opmaak, geen
  // tabel. Die wordt een raster dat ook op een telefoon past.
  $('table')
    .get()
    .reverse()
    .forEach((tabel) => {
      const $t = $(tabel);
      const cellen = $t.children('tbody, thead').children('tr').children('td, th').add($t.children('tr').children('td, th'));
      const metInhoud = cellen.filter((_, c) => !isLeeg($, c));
      const alleenBeeld =
        metInhoud.length > 0 && metInhoud.get().every((c) => $(c).find('img').length && netjes($(c).text()) === '');
      const isOpmaak = $t.find('table').length > 0 || alleenBeeld;
      if (isOpmaak && metInhoud.length === 1) {
        // Maar één vak: de tabel was alleen een omhulsel (op de oude site soms vele lagen diep).
        $t.replaceWith($(metInhoud[0]).contents());
      } else if (isOpmaak) {
        const raster = $(`<div class="raster${alleenBeeld ? ' raster--beeld' : ''}"></div>`);
        metInhoud.each((_, c) => {
          const beeld = $(c).find('img').length > 0 && netjes($(c).text()) === '';
          raster.append($(`<div class="raster__vak${beeld ? ' raster__vak--beeld' : ''}"></div>`).append($(c).contents()));
        });
        $t.replaceWith(raster);
      } else {
        $t.wrap('<div class="tabel"></div>');
      }
    });

  // Alinea's met meerdere plaatjes naast elkaar.
  $('p').each((_, el) => {
    const $p = $(el);
    if ($p.find('img').length >= 2 && netjes($p.text()) === '') $p.addClass('beelden');
  });

  // Lege alinea's en losse <br> aan het begin of eind weg.
  $('p, div, span, strong, em, h2, h3, h4').each((_, el) => {
    if (isLeeg($, el) && !$(el).find('br').length) $(el).remove();
  });
  $('p').each((_, el) => {
    const $p = $(el);
    while ($p.contents().first().is('br')) $p.contents().first().remove();
    while ($p.contents().last().is('br')) $p.contents().last().remove();
    if (isLeeg($, el)) $p.remove();
  });

  maakEmailLinks($);
  return $.html().trim();
}

// E-mailadressen in gewone tekst (zoals president@curius.nl in een tabel) klikbaar maken.
function maakEmailLinks($) {
  const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
  const HEEFT_EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
  $.root()
    .find('*')
    .addBack()
    .contents()
    .filter((_, n) => n.type === 'text' && HEEFT_EMAIL.test(n.data) && !$(n).closest('a').length)
    .each((_, n) => {
      EMAIL.lastIndex = 0;
      const veilig = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const html = veilig(n.data).replace(EMAIL, (adres) => `<a href="mailto:${adres}">${adres}</a>`);
      $(n).replaceWith(html);
    });
}

// Platte tekst uit HTML, bijvoorbeeld voor een samenvatting.
export function platteTekst(html) {
  const $ = laadStuk(String(html ?? '').replace(/<(br|\/p|\/h\d|\/li|\/td)\b[^>]*>/gi, ' $&'));
  return netjes($.root().text());
}

export function samenvatting(html, max = 160) {
  // Koppen tellen niet mee: "Over Curius" boven de eerste alinea hoort niet in een samenvatting.
  const tekst = platteTekst(String(html ?? '').replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ')) || platteTekst(html);
  if (tekst.length <= max) return tekst;
  const kort = tekst.slice(0, max);
  return kort.slice(0, Math.max(kort.lastIndexOf(' '), max - 20)).replace(/[\s,.;:!?–-]+$/, '') + '…';
}
