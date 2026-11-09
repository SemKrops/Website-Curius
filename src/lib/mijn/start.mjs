// Vult een pagina van Mijn Curius (of het fotoalbum) zodra iemand is ingelogd. Elk deel
// heeft een eigen bestand in deze map, dat de browser pas laadt als het nodig is.

import { bijSessie, sessie, uitloggen } from '../leden.mjs';
import '../ledenkop.mjs';

const DELEN = {
  overzicht: () => import('./overzicht.mjs'),
  profiel: () => import('./profiel.mjs'),
  activiteiten: () => import('./activiteiten.mjs'),
  zoeken: () => import('./zoeken.mjs'),
  declaraties: () => import('./declaraties.mjs'),
  fotos: () => import('./fotos.mjs'),
};

const vak = document.querySelector('[data-mijn]');
const gegevens = JSON.parse(vak?.dataset.gegevens ?? '{}');
let ronde = 0;
let wasIngelogd = null;

async function start() {
  const s = sessie();
  const nu = s?.token ?? null;
  if (nu === wasIngelogd) return;
  wasIngelogd = nu;
  const deze = ++ronde;
  vak.replaceChildren();
  if (!s) return;
  const deel = await DELEN[vak.dataset.mijn]();
  if (deze === ronde) deel.toon(vak, gegevens);
}

document.querySelectorAll('[data-uitloggen]').forEach((knop) => knop.addEventListener('click', () => uitloggen()));

if (vak) {
  bijSessie(start);
  start();
}
