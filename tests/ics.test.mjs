// De agenda om te abonneren (agenda.ics) moet volgens de standaard zijn, anders weigeren
// Google Agenda of Outlook hem.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agenda, evenement } from '../src/lib/ics.mjs';

const nu = new Date('2026-11-09T12:00:00Z');

test('een volledige agenda', () => {
  const ics = agenda(
    [
      { id: 1, titel: 'Borrel, met; tekens', start: '2026-11-12T17:30:00.000Z', eind: '2026-11-12T22:00:00.000Z', locatie: 'TB-Café' },
      { id: 2, titel: 'Weekend', start: '2026-11-15T23:00:00.000Z', eind: '2026-11-17T22:59:00.000Z' },
    ],
    { naam: 'Curius', urlVan: (a) => `https://example.com/${a.id}/`, nu },
  );
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  // Alleen CRLF als regeleinde en geen regel langer dan 75 bytes.
  assert.doesNotMatch(ics.replace(/\r\n/g, ''), /[\r\n]/);
  for (const regel of ics.split('\r\n')) assert.ok(new TextEncoder().encode(regel).length <= 75, regel);
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2);
  assert.match(ics, /SUMMARY:Borrel\\, met\\; tekens/);
  assert.match(ics, /DTSTART:20261112T173000Z/);
});

test('een activiteit zonder tijd is een hele dag', () => {
  const ics = evenement({ id: 2, titel: 'Weekend', start: '2026-11-15T23:00:00.000Z', eind: '2026-11-17T22:59:00.000Z' }, { nu });
  assert.match(ics, /DTSTART;VALUE=DATE:20261116/);
  // De einddatum telt bij een hele dag niet mee, dus de dag erna.
  assert.match(ics, /DTEND;VALUE=DATE:20261118/);
});

test('zonder eindtijd duurt een activiteit drie uur', () => {
  const ics = evenement({ id: 3, titel: 'Lezing', start: '2026-11-12T17:30:00.000Z', eind: '2026-11-12T22:59:00.000Z' }, { nu });
  assert.match(ics, /DTSTART:20261112T173000Z/);
  assert.match(ics, /DTEND:20261112T203000Z/);
});

test('lange omschrijvingen worden afgebroken', () => {
  const ics = evenement({ id: 4, titel: 'Iets', start: '2026-11-12T17:30:00.000Z', samenvatting: 'é'.repeat(200) }, { nu });
  for (const regel of ics.split('\r\n')) assert.ok(new TextEncoder().encode(regel).length <= 75, regel);
  assert.match(ics, /\r\n é/);
});
