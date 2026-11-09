// Datums lezen zoals ze op curius.nl staan, en netjes tonen in de tijd van Nederland.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leesDatumTekst, nederlandseTijd, periode, tijdVak } from '../src/bron/datum.mjs';

test('nederlandseTijd houdt rekening met zomer en wintertijd', () => {
  assert.equal(nederlandseTijd(2026, 1, 15, 12, 0).toISOString(), '2026-01-15T11:00:00.000Z');
  assert.equal(nederlandseTijd(2026, 7, 15, 12, 0).toISOString(), '2026-07-15T10:00:00.000Z');
  // De nacht waarin de zomertijd begint.
  assert.equal(nederlandseTijd(2026, 3, 29, 3, 0).toISOString(), '2026-03-29T01:00:00.000Z');
});

test('leesDatumTekst: meerdere dagen, zonder tijd', () => {
  assert.deepEqual(leesDatumTekst('maandag 16 november 2026 t/m dinsdag 17 november 2026'), {
    start: '2026-11-15T23:00:00.000Z',
    eind: '2026-11-17T22:59:00.000Z',
    heleDag: true,
  });
});

test('leesDatumTekst: zonder jaar, met begin en eindtijd', () => {
  assert.deepEqual(leesDatumTekst('09 november 20:00 - 22:00', new Date('2026-11-01T12:00:00Z')), {
    start: '2026-11-09T19:00:00.000Z',
    eind: '2026-11-09T21:00:00.000Z',
    heleDag: false,
  });
});

test('leesDatumTekst: Engelse maanden', () => {
  const d = leesDatumTekst('Thu 9 Apr, 12:45-13:30', new Date('2026-03-01T12:00:00Z'));
  assert.equal(d.start, '2026-04-09T10:45:00.000Z');
  assert.equal(d.eind, '2026-04-09T11:30:00.000Z');
});

test('leesDatumTekst: zonder jaar kiest hij het jaar dat het dichtst bij nu ligt', () => {
  assert.equal(leesDatumTekst('5 januari', new Date('2026-12-20T12:00:00Z')).start, '2027-01-04T23:00:00.000Z');
  assert.equal(leesDatumTekst('5 januari', new Date('2026-02-01T12:00:00Z')).start, '2026-01-04T23:00:00.000Z');
});

test('leesDatumTekst: geen datum', () => {
  assert.equal(leesDatumTekst('geen datum hier'), undefined);
  assert.equal(leesDatumTekst(undefined), undefined);
});

test('periode: 23:59 als eindtijd betekent geen eindtijd', () => {
  assert.equal(periode('2026-11-16T07:30:00.000Z', '2026-11-17T22:59:00.000Z', 'nl'), 'ma 16 nov, 08:30 tot di 17 nov');
  assert.equal(periode('2026-11-16T07:30:00.000Z', '2026-11-17T22:59:00.000Z', 'en'), 'Mon 16 Nov, 08:30 to Tue 17 Nov');
});

test('tijdVak', () => {
  assert.equal(tijdVak('2026-11-09T19:00:00.000Z', '2026-11-09T21:00:00.000Z'), '20:00 tot 22:00');
  assert.equal(tijdVak('2026-11-09T19:00:00.000Z', '2026-11-09T21:00:00.000Z', 'en'), '20:00 to 22:00');
  assert.equal(tijdVak('2026-11-09T19:00:00.000Z', '2026-11-09T22:59:00.000Z'), '20:00');
  // Om middernacht beginnen betekent: geen tijd ingevuld.
  assert.equal(tijdVak('2026-11-08T23:00:00.000Z'), '');
});
