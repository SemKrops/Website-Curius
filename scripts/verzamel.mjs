// Haalt de hele site op en schrijft het resultaat naar .cache/site.json, zonder
// de website te bouwen. Handig om te zien of het lezen van curius.nl nog werkt:
//   npm run verzamel
import { mkdir, writeFile } from 'node:fs/promises';
import { koppel } from '../src/bron/koppelen.mjs';
import { verzamel } from '../src/bron/verzamelen.mjs';

const site = koppel(await verzamel());
await mkdir('.cache', { recursive: true });
await writeFile('.cache/site.json', JSON.stringify(site, null, 2));
const paginas = Object.values(site.paginas);
const telling = {};
for (const p of paginas) telling[p.soort] = (telling[p.soort] ?? 0) + 1;
console.log('Pagina\'s per soort:', telling);
console.log('Activiteiten:', Object.fromEntries(Object.entries(site.activiteiten).map(([t, a]) => [t, a.length])));
console.log('Zonder tegenhanger in de andere taal:', paginas.filter((p) => /\/(nl|en)\/$/.test(p.ander) && p.soort !== 'home').length);
