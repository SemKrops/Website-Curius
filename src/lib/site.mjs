// De verzamelde en gekoppelde site, één keer per bouw opgehaald.
import { koppel } from '../bron/koppelen.mjs';
import { verzamel } from '../bron/verzamelen.mjs';

const SLEUTEL = Symbol.for('curius.site');

export function haalSite() {
  globalThis[SLEUTEL] ??= verzamel().then((ruw) => koppel(ruw, { basis: import.meta.env.BASE_URL }));
  return globalThis[SLEUTEL];
}
