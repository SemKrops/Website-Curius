// Bedragen lezen bij declaraties, het vierkant van een pasfoto en de adressen van Mijn Curius.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { webAdres } from '../src/lib/dom.mjs';
import { leesBedrag, middenVierkant } from '../src/lib/mijn/rekenen.mjs';
import { mijnCuriusPad, mijnCuriusPagina } from '../src/lib/mijncurius.mjs';

test('leesBedrag snapt komma, punt en euroteken', () => {
  assert.equal(leesBedrag('12,50'), 12.5);
  assert.equal(leesBedrag('12.50'), 12.5);
  assert.equal(leesBedrag('€ 1.234,56'), 1234.56);
  assert.equal(leesBedrag('1.234'), 1234);
  assert.equal(leesBedrag(' 7 '), 7);
});

test('leesBedrag: geen bedrag is NaN', () => {
  for (const fout of ['', null, 'abc', '12,505', '-5', '1,2,3', '12.5.0']) assert.ok(Number.isNaN(leesBedrag(fout)), String(fout));
});

test('middenVierkant: het vierkant in het midden, liggend en staand', () => {
  assert.deepEqual(middenVierkant(400, 200), { x: 0.25, y: 0, breedte: 0.5, hoogte: 1 });
  assert.deepEqual(middenVierkant(200, 400), { x: 0, y: 0.25, breedte: 1, hoogte: 0.5 });
  assert.deepEqual(middenVierkant(300, 300), { x: 0, y: 0, breedte: 1, hoogte: 1 });
  assert.equal(middenVierkant(0, 300), undefined);
});

test('Mijn Curius staat op dezelfde adressen als op de oude site', () => {
  assert.deepEqual(mijnCuriusPagina('/nl/mijn-curius/'), {
    deel: 'overzicht',
    icoon: 'user',
    nl: 'nl/mijn-curius',
    en: 'en/my-curius',
    taal: 'nl',
    pad: 'nl/mijn-curius',
  });
  assert.equal(mijnCuriusPagina('en/my-curius/reimbursements').deel, 'declaraties');
  assert.equal(mijnCuriusPagina('nl/media/photoalbum').deel, 'fotos');
  assert.equal(mijnCuriusPad('zoeken', 'en'), 'en/my-curius/member-search');
});

test('oude adressen van Mijn Curius verwijzen door, andere pagina\'s niet', () => {
  const oud = mijnCuriusPagina('nl/mijn-curius/ledenlijst');
  assert.equal(oud.deel, 'zoeken');
  assert.equal(oud.pad, 'nl/mijn-curius/leden-zoeken');
  assert.equal(oud.oud, 'nl/mijn-curius/ledenlijst');
  assert.equal(mijnCuriusPagina('nl/vereniging/bestuur'), undefined);
  assert.equal(mijnCuriusPagina(''), undefined);
});

test('webAdres: alleen http en https uit gegevens van de server worden een link', () => {
  assert.equal(webAdres('https://betalen.example/curius?id=5'), 'https://betalen.example/curius?id=5');
  assert.equal(webAdres('http://www.curius.nl/nl/forms/x'), 'http://www.curius.nl/nl/forms/x');
  for (const fout of ['javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'data:text/html,x', 'mailto:a@b.nl', '', null]) {
    assert.equal(webAdres(fout), undefined, String(fout));
  }
});
