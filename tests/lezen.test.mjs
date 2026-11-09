// Leest echte pagina's van curius.nl (opgeslagen in tests/voorbeelden). Gaat hier iets
// mis na een update van Genkgo, sla dan de nieuwe versie van die pagina op in
// tests/voorbeelden en pas src/bron/lezen.mjs aan.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { leesAlgemeen, leesMenu, leesPagina } from '../src/bron/lezen.mjs';

const voorbeeld = (naam) => readFileSync(new URL(`./voorbeelden/${naam}`, import.meta.url), 'utf8');
const blok = (pagina, type) => pagina.blokken.find((b) => b.type === type);
const isIso = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

test('het menu', () => {
  const menu = leesMenu(voorbeeld('home.html'));
  const titels = menu.map((k) => k.titel);
  for (const t of ['Vereniging', 'Activiteiten', 'Carrière', 'Onderwijs', 'Contact']) assert.ok(titels.includes(t), t);
  const vereniging = menu.find((k) => k.titel === 'Vereniging');
  assert.equal(vereniging.pad, 'nl/vereniging');
  assert.ok(vereniging.kinderen.length >= 5);
  assert.ok(vereniging.kinderen.every((k) => k.titel && k.href));
});

test('contactgegevens, partners en sociale media', () => {
  const { contact, partners, sociaal } = leesAlgemeen(voorbeeld('home.html'));
  assert.equal(contact.email, 'info@curius.nl');
  assert.equal(contact.adres, 'Jaffalaan 5');
  assert.equal(contact.postcode, '2628 BX Delft');
  assert.match(contact.kvk, /^\d{8}$/);
  assert.ok(partners.length > 0);
  assert.ok(partners.every((p) => p.logo.startsWith('https://')));
  assert.ok(sociaal.some((s) => s.href.includes('instagram.com')));
});

test('de homepagina: dia, snelkoppelingen en kaarten', () => {
  const p = leesPagina(voorbeeld('home.html'));
  assert.ok(blok(p, 'dias').dias.length >= 1);
  assert.ok(blok(p, 'snelkoppelingen').links.every((l) => l.titel && l.href));
});

test('de kalender', () => {
  const p = leesPagina(voorbeeld('kalender.html'));
  assert.equal(p.titel, 'Kalender');
  const items = blok(p, 'agenda').items;
  assert.ok(items.length > 10);
  for (const a of items) {
    assert.ok(a.id && a.titel, JSON.stringify(a));
    assert.ok(isIso(a.start), a.start);
    assert.match(a.href, /\/info\/\d+/);
  }
});

test('een activiteit', () => {
  const p = leesPagina(voorbeeld('activiteit.html'));
  assert.equal(p.titel, 'Curious 4 Business');
  const gegevens = Object.fromEntries(blok(p, 'gegevens').rijen.map((r) => [r.label, r.waarde]));
  assert.equal(gegevens.Locatie, 'Hotel Hoevevoorde');
  assert.match(gegevens.Datum, /16 november 2026/);
  assert.ok(blok(p, 'afbeelding').src.startsWith('https://'));
  assert.match(blok(p, 'html').html, /Hoevevoorde/);
});

test('het carrièreplatform', () => {
  const p = leesPagina(voorbeeld('vacatures.html'));
  const vacatures = blok(p, 'vacatures').vacatures;
  assert.ok(vacatures.length > 10);
  for (const v of vacatures) {
    assert.ok(v.titel && v.href, JSON.stringify(v));
    if (v.datum) assert.match(v.datum, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.ok(vacatures.some((v) => v.bedrijf && v.soort && v.logo));
});

test('commissies als kaarten', () => {
  const p = leesPagina(voorbeeld('commissies.html'));
  assert.equal(p.titel, 'Commissies 34e (2026-2027)');
  const kaarten = blok(p, 'kaarten').kaarten;
  assert.ok(kaarten.length > 10);
  assert.ok(kaarten.every((k) => k.titel && k.href.startsWith('https://www.curius.nl/nl/vereniging/commissies/')));
});
