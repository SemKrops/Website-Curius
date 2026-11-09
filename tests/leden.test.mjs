// Inloggen en verzoeken aan de Curius server (src/lib/leden.mjs), met een nagemaakte
// browser: localStorage, de pagina en fetch.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { lt } from '../src/lib/ledenteksten.mjs';

const opslag = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k) => (opslag.has(k) ? opslag.get(k) : null),
    setItem: (k, v) => opslag.set(k, String(v)),
    removeItem: (k) => opslag.delete(k),
  },
});
const pagina = { lang: 'nl', dataset: { server: 'https://server.test/' } };
globalThis.document = { documentElement: pagina };

let verzoeken = [];
let antwoorden = [];
globalThis.fetch = async (url, opties) => {
  verzoeken.push({ url, ...opties });
  const a = antwoorden.shift();
  if (a instanceof Error) throw a;
  return a;
};
const json = (gegevens, status = 200) =>
  new Response(JSON.stringify(gegevens), { status, headers: { 'content-type': 'application/json' } });

const leden = await import('../src/lib/leden.mjs');
const { LedenFout, bijSessie, inloggen, moetOpnieuwInloggen, sessie, uitloggen, vraag } = leden;

beforeEach(() => {
  opslag.clear();
  verzoeken = [];
  antwoorden = [];
  pagina.lang = 'nl';
});

test('inloggen bewaart het token en de naam, niet het wachtwoord', async () => {
  let gemeld = 0;
  const stop = bijSessie(() => gemeld++);
  antwoorden.push(json({ token: 'abc', lidId: 42 }), json({ voornaam: 'Sem', achternaam: 'de Vries' }));
  const s = await inloggen('lid', 'geheim');
  stop();

  assert.deepEqual(s, { token: 'abc', lidId: '42', voornaam: 'Sem', achternaam: 'de Vries' });
  assert.deepEqual(sessie(), s);
  assert.equal(gemeld, 1);
  assert.equal(verzoeken[0].url, 'https://server.test/inloggen');
  assert.equal(verzoeken[0].method, 'POST');
  assert.deepEqual(JSON.parse(verzoeken[0].body), { gebruikersnaam: 'lid', wachtwoord: 'geheim' });
  assert.equal(verzoeken[1].url, 'https://server.test/leden/42');
  assert.equal(verzoeken[1].headers.Authorization, 'Bearer abc');
  assert.doesNotMatch([...opslag.values()].join(), /geheim/);
});

test('verzoeken sturen het token en de taal van de pagina mee', async () => {
  opslag.set('curius.sessie', JSON.stringify({ token: 't1', lidId: '7' }));
  pagina.lang = 'en';
  antwoorden.push(json([{ id: 1 }]));
  assert.deepEqual(await vraag('/activiteiten'), [{ id: 1 }]);
  assert.equal(verzoeken[0].headers.Authorization, 'Bearer t1');
  assert.equal(verzoeken[0].headers['Accept-Language'], 'en');
  assert.equal(verzoeken[0].method, 'GET');
});

test('een verlopen sessie (401) logt je uit, met de melding van de server', async () => {
  opslag.set('curius.sessie', JSON.stringify({ token: 'oud', lidId: '7' }));
  antwoorden.push(json({ melding: 'Log opnieuw in.', code: 'sessie_verlopen' }, 401));
  await assert.rejects(vraag('/ik'), (e) => e instanceof LedenFout && e.status === 401 && e.message === 'Log opnieuw in.');
  assert.equal(sessie(), null);
});

test('een fout wachtwoord bij het inloggen laat een andere sessie staan', async () => {
  opslag.set('curius.sessie', JSON.stringify({ token: 'goed', lidId: '7' }));
  antwoorden.push(json({ melding: 'Gebruikersnaam of wachtwoord klopt niet.' }, 401));
  await assert.rejects(inloggen('lid', 'fout'), /klopt niet/);
  assert.equal(verzoeken[0].headers.Authorization, undefined);
  assert.equal(sessie()?.token, 'goed');
});

test('geen verbinding en antwoorden zonder JSON geven een nette melding', async () => {
  antwoorden.push(new TypeError('fetch failed'));
  await assert.rejects(vraag('/albums'), (e) => e instanceof LedenFout && e.message === lt('nl').geenVerbinding);
  antwoorden.push(new Response('Bad gateway', { status: 502 }));
  await assert.rejects(vraag('/albums'), (e) => e.status === 502 && e.message === lt('nl').ietsMis);
});

test('de server vraagt het wachtwoord opnieuw voor curius.nl', async () => {
  antwoorden.push(json({ melding: 'Log opnieuw in op de site.', code: 'site_inloggen' }, 403));
  const fout = await vraag('/activiteiten/1/inschrijving', { methode: 'POST' }).catch((e) => e);
  assert.equal(moetOpnieuwInloggen(fout), true);
  assert.equal(moetOpnieuwInloggen(new Error('iets anders')), false);
});

test('een kapotte sessie in localStorage telt als uitgelogd', () => {
  opslag.set('curius.sessie', '{kapot');
  assert.equal(sessie(), null);
  opslag.set('curius.sessie', JSON.stringify({ lidId: '7' }));
  assert.equal(sessie(), null);
});

test('uitloggen lukt ook als de server niet antwoordt', async () => {
  opslag.set('curius.sessie', JSON.stringify({ token: 't2', lidId: '7' }));
  antwoorden.push(new TypeError('fetch failed'));
  await uitloggen();
  assert.equal(sessie(), null);
  assert.equal(verzoeken[0].url, 'https://server.test/uitloggen');
  assert.equal(verzoeken[0].headers.Authorization, 'Bearer t2');
});

test('204 geeft niets terug, een foto komt als blob', async () => {
  antwoorden.push(new Response(null, { status: 204 }));
  assert.equal(await vraag('/activiteiten/1/inschrijving', { methode: 'DELETE' }), null);
  antwoorden.push(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } }));
  const blob = await vraag('/leden/7/foto?maat=klein');
  assert.ok(blob instanceof Blob);
  assert.equal(blob.size, 3);
});
