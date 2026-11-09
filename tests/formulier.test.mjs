// De formulieren voor iedereen (lid worden, contact): wat de bouw van een formulier op
// curius.nl onthoudt (src/bron/lezen.mjs) en de hulpjes van src/lib/formulier.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { leesPagina } from '../src/bron/lezen.mjs';
import { lt } from '../src/lib/ledenteksten.mjs';
import { bestandFout, knopTekst, linkVoor, regelsVan, somZonderIs } from '../src/lib/formulier.mjs';

const voorbeeld = (naam) => readFileSync(new URL(`./voorbeelden/${naam}`, import.meta.url), 'utf8');

test('lid worden: de bouw onthoudt waar het formulier staat en de links in de uitleg', () => {
  const p = leesPagina(voorbeeld('lid-worden.html'));
  const formulieren = p.blokken.filter((b) => b.type === 'formulier');
  assert.equal(formulieren.length, 1);
  assert.deepEqual(formulieren[0], {
    type: 'formulier',
    pad: 'en/forms/become-member',
    links: [{ van: 'en/terms-conditions', href: 'http://www.Curius.nl/en/terms-conditions' }],
  });
  // Geen velden of beveiligingscode in de pagina: die komen pas in de browser van de server.
  assert.ok(!JSON.stringify(p).includes('weggehaald'));
});

test('links in de uitleg gaan naar de pagina op deze site als die er is', () => {
  const kaart = { 'en/terms-conditions': '/Website-Curius/en/terms-conditions/' };
  assert.equal(linkVoor('http://www.curius.nl/en/terms-conditions', kaart), '/Website-Curius/en/terms-conditions/');
  assert.equal(linkVoor('https://curius.genkgo.app/en/terms-conditions/', kaart), '/Website-Curius/en/terms-conditions/');
  // Een pagina die hier niet staat, en een andere website: de link zoals hij is.
  assert.equal(linkVoor('https://www.curius.nl/nl/iets-anders', kaart), 'https://www.curius.nl/nl/iets-anders');
  assert.equal(linkVoor('https://www.tudelft.nl/', kaart), 'https://www.tudelft.nl/');
  // Nooit iets anders dan http of https.
  assert.equal(linkVoor('javascript:alert(1)', kaart), undefined);
  assert.equal(linkVoor('data:text/html,hoi', kaart), undefined);
  // Een kaart is geen object met rare sleutels.
  assert.equal(linkVoor('https://www.curius.nl/__proto__', kaart), 'https://www.curius.nl/__proto__');
});

test('de som, de knop en de melding netjes', () => {
  assert.equal(somZonderIs('vijftien plus dertien is ='), 'vijftien plus dertien is');
  assert.equal(somZonderIs('twelve plus five equals ='), 'twelve plus five equals');
  assert.equal(knopTekst('versturen', 'Versturen'), 'Versturen');
  assert.equal(knopTekst('aanvragen', 'Versturen'), 'Aanvragen');
  assert.equal(knopTekst(undefined, 'Versturen'), 'Versturen');
  assert.deepEqual(regelsVan('Bedankt voor je bericht!\n\n We nemen contact op. \n'), ['Bedankt voor je bericht!', 'We nemen contact op.']);
  assert.deepEqual(regelsVan(undefined), []);
});

test('bestanden: alleen jpg, png en pdf, niet te groot', () => {
  const t = lt('nl');
  const bestand = (name, type, size) => ['photo', { name, type, size }];
  assert.equal(bestandFout([bestand('ik.jpg', 'image/jpeg', 1000)], t), undefined);
  assert.equal(bestandFout([bestand('ik.heic', 'image/heic', 1000)], t), 'ik.heic is geen jpg, png of pdf.');
  assert.equal(bestandFout([bestand('groot.png', 'image/png', 11 * 1024 * 1024)], t), 'groot.png is groter dan 10 MB.');
  assert.equal(bestandFout([bestand('a.pdf', 'application/pdf', 7 * 1024 * 1024), bestand('b.pdf', 'application/pdf', 7 * 1024 * 1024)], t), t.bestandenTeGroot);
});
