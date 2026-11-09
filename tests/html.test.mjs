// Het opschonen van de HTML van de oude site.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as cheerio from 'cheerio';
import { absoluut, bronPad, samenvatting, schoonHtml } from '../src/bron/html.mjs';

const laad = (html) => cheerio.load(html, null, false);

test('scripts, formulieren en onclick verdwijnen', () => {
  const uit = schoonHtml('<p onclick="x()">Hoi<script>alert(1)</script></p><form><input></form>');
  assert.match(uit, /Hoi/);
  assert.doesNotMatch(uit, /script|onclick|<form|<input/);
});

test('links en afbeeldingen worden volledig', () => {
  const $ = laad(schoonHtml('<p><a href="/nl/contact">Contact</a> <img src="/_/plaatje.png"></p>'));
  assert.equal($('a').attr('href'), 'https://www.curius.nl/nl/contact');
  assert.equal($('img').attr('src'), 'https://www.curius.nl/_/plaatje.png');
  assert.equal($('img').attr('loading'), 'lazy');
});

test('e-mailadressen worden klikbaar', () => {
  const $ = laad(schoonHtml('<p>Mail naar info@curius.nl of bel ons.</p>'));
  assert.equal($('a').attr('href'), 'mailto:info@curius.nl');
});

test('een gewone tabel blijft een tabel', () => {
  const $ = laad(schoonHtml('<table><tr><td>President</td><td>Lizzi</td></tr></table>'));
  assert.equal($('div.tabel > table').length, 1);
});

test('opmaaktabellen worden een raster, een tabel met één vak verdwijnt', () => {
  const html = `
    <table><tr><td>
      <table><tr>
        <td><table><tr><td>33e Bestuur</td><td>&nbsp;</td></tr><tr><td>President</td><td>Lars</td></tr></table></td>
        <td><img src="https://www.curius.nl/foto.jpg"></td>
      </tr></table>
    </td></tr></table>`;
  const $ = laad(schoonHtml(html));
  // Alleen het raster met de twee vakken blijft over, niet de tabel eromheen.
  assert.equal($('.raster').length, 1);
  assert.equal($('.raster > .raster__vak').length, 2);
  assert.equal($('.raster__vak--beeld img').length, 1);
  assert.equal($('.raster__vak .tabel table').length, 1);
});

test('samenvatting slaat koppen over en kort af', () => {
  assert.equal(samenvatting('<h2>Titel</h2><p>Dit is de tekst.</p>'), 'Dit is de tekst.');
  const lang = samenvatting(`<p>${'woord '.repeat(100)}</p>`, 60);
  assert.ok(lang.length <= 61, lang);
  assert.ok(lang.endsWith('…'));
});

test('absoluut en bronPad', () => {
  assert.equal(absoluut('/nl/vereniging'), 'https://www.curius.nl/nl/vereniging');
  assert.equal(bronPad('https://www.curius.nl/nl/vereniging/'), 'nl/vereniging');
  assert.equal(bronPad('https://www.example.com/x'), undefined);
});

test('geen code uit teksten: javascript links, onclick en ingesloten objecten verdwijnen', () => {
  const uit = schoonHtml(`
    <p><a href="javascript:alert(1)">een</a> <a href=" JaVa&#x09;script:alert(2)">twee</a> <a href="data:text/html,x">drie</a></p>
    <p><img src="x.png" onerror="alert(3)"><svg><a xlink:href="javascript:alert(4)">vier</a></svg></p>
    <object data="x.swf"></object><embed src="x.swf"><base href="https://kwaad.example/"><template><p>verborgen</p></template>
    <p><a href="/nl/contact" formaction="javascript:alert(5)">contact</a></p>`);
  assert.doesNotMatch(uit, /javascript|alert|onerror|xlink|data:text|<object|<embed|<base|<template|formaction/i);
  const $ = laad(uit);
  assert.equal($('a[href]').length, 1);
  assert.equal($('a[href]').attr('href'), 'https://www.curius.nl/nl/contact');
  assert.match($.text(), /een twee drie/);
});

test('absoluut weigert gevaarlijke adressen', () => {
  assert.equal(absoluut('javascript:alert(1)'), undefined);
  assert.equal(absoluut('  vbscript:msgbox'), undefined);
  assert.equal(absoluut('data:text/html;base64,PHNjcmlwdD4='), undefined);
  assert.equal(absoluut('mailto:info@curius.nl'), 'mailto:info@curius.nl');
  assert.equal(absoluut('http://curius.nl/nl/agenda'), 'https://www.curius.nl/nl/agenda');
});
