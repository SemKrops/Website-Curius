// Haalt pagina's op van de site in Genkgo.
//
// * Nooit meer dan MAX_TEGELIJK verzoeken tegelijk, en een paar nieuwe pogingen
//   als de site even niet antwoordt.
// * Elke opgehaalde pagina wordt bewaard in CACHE_MAP. Lukt het ophalen niet,
//   dan wordt de laatst bewaarde versie gebruikt, zodat één haperende pagina
//   niet de hele website breekt.
// * Doorverwijzingen binnen de site worden gevolgd. Een doorverwijzing naar een
//   andere site (zoals frontrunnersfestival.nl) wordt teruggegeven als `extern`.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BRON_URL, CACHE_MAP, CACHE_MINUTEN, MAX_TEGELIJK, isBronHost } from './instellingen.mjs';

const POGINGEN = 3;
const WACHTTIJD = 30_000;
const AGENT = 'CuriusWebsite/1.0 (+https://github.com/SemKrops/Website-Curius)';

export const teller = { opgehaald: 0, uitCache: 0, fouten: 0 };

let bezig = 0;
const wachtrij = [];
function beurt() {
  if (bezig < MAX_TEGELIJK) {
    bezig++;
    return Promise.resolve();
  }
  return new Promise((klaar) => wachtrij.push(klaar));
}
function klaar() {
  const volgende = wachtrij.shift();
  if (volgende) volgende(); // de plek gaat direct over naar de volgende
  else bezig--;
}

const wacht = (ms) => new Promise((klaar) => setTimeout(klaar, ms));

export const naarUrl = (pad) => (/^https?:\/\//i.test(pad) ? pad : `${BRON_URL}/${String(pad).replace(/^\/+/, '')}`);

function cacheBestand(url) {
  return path.join(CACHE_MAP, createHash('sha1').update(url).digest('hex') + '.json');
}

async function uitCache(url, maxMinuten) {
  try {
    const bewaard = JSON.parse(await readFile(cacheBestand(url), 'utf8'));
    if (maxMinuten === Infinity || Date.now() - bewaard.tijd < maxMinuten * 60_000) return bewaard.antwoord;
  } catch {
    // Niet bewaard of onleesbaar: dan maar ophalen.
  }
  return undefined;
}

async function bewaar(url, antwoord) {
  try {
    await mkdir(CACHE_MAP, { recursive: true });
    await writeFile(cacheBestand(url), JSON.stringify({ tijd: Date.now(), antwoord }));
  } catch {
    // Bewaren is mooi meegenomen, niet nodig.
  }
}

// Antwoord: { status, html, url } of { status, extern } of { status: 0, fout }.
export async function haal(pad, { bewaarMinuten = CACHE_MINUTEN } = {}) {
  const url = naarUrl(pad);
  if (bewaarMinuten > 0) {
    const bewaard = await uitCache(url, bewaarMinuten);
    if (bewaard) {
      teller.uitCache++;
      return bewaard;
    }
  }
  await beurt();
  let antwoord;
  try {
    antwoord = await haalVanSite(url);
  } finally {
    klaar();
  }
  if (antwoord.status === 0 || antwoord.status >= 500) {
    const oud = await uitCache(url, Infinity);
    if (oud) {
      console.warn(`[bron] ${url} lukte niet (${antwoord.fout ?? antwoord.status}), de bewaarde versie wordt gebruikt.`);
      return oud;
    }
    teller.fouten++;
    return antwoord;
  }
  await bewaar(url, antwoord);
  return antwoord;
}

async function haalVanSite(url, sprongen = 0) {
  for (let poging = 1; ; poging++) {
    try {
      const res = await fetch(url, {
        redirect: 'manual',
        headers: { 'user-agent': AGENT, accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(WACHTTIJD),
      });
      if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel();
        const naar = new URL(res.headers.get('location') ?? '/', url);
        if (!isBronHost(naar.host)) return { status: res.status, extern: naar.href };
        if (sprongen >= 5) return { status: 508 };
        return haalVanSite(naar.href, sprongen + 1);
      }
      if (res.status >= 500 && poging < POGINGEN) {
        await res.body?.cancel();
        throw new Error(`status ${res.status}`);
      }
      const html = res.status === 200 ? await res.text() : '';
      if (res.status !== 200) await res.body?.cancel();
      teller.opgehaald++;
      return { status: res.status, html, url };
    } catch (fout) {
      if (poging >= POGINGEN) return { status: 0, fout: String(fout?.message ?? fout) };
      await wacht(1500 * poging);
    }
  }
}
