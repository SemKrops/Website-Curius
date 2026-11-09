// Datums lezen en netjes tonen, altijd in de tijd van Nederland.

export const TIJDZONE = 'Europe/Amsterdam';

const MAANDEN = {
  januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6, juli: 7, augustus: 8, september: 9,
  oktober: 10, november: 11, december: 12, january: 1, february: 2, march: 3, may: 5, june: 6, july: 7,
  august: 8, october: 10, jan: 1, feb: 2, mrt: 3, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  okt: 10, oct: 10, nov: 11, dec: 12,
};

// Het verschil in minuten tussen UTC en Nederland op een bepaald moment.
function verschilMinuten(datum) {
  const delen = new Intl.DateTimeFormat('en-US', {
    timeZone: TIJDZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(datum);
  const d = Object.fromEntries(delen.map((p) => [p.type, p.value]));
  const alsUtc = Date.UTC(+d.year, +d.month - 1, +d.day, +d.hour, +d.minute);
  return Math.round((alsUtc - datum.getTime()) / 60_000);
}

// Een moment in Nederlandse tijd als Date.
export function nederlandseTijd(jaar, maand, dag, uur = 0, minuut = 0) {
  const gok = new Date(Date.UTC(jaar, maand - 1, dag, uur, minuut));
  return new Date(gok.getTime() - verschilMinuten(gok) * 60_000);
}

// Leest datums zoals ze op de site staan:
//   "09 november 20:00 - 22:00"            (zonder jaar)
//   "09 november - 09 november 2026"
//   "maandag 16 november 2026 t/m dinsdag 17 november 2026"
//   "Thu 9 Apr, 12:45-13:30"
// Zonder jaar kiest hij het jaar waarin de datum het dichtst bij `nu` ligt.
export function leesDatumTekst(tekst, nu = new Date()) {
  const schoon = String(tekst ?? '').toLowerCase().replace(/[ ]/g, ' ');
  const datums = [...schoon.matchAll(/(\d{1,2})\s+([a-z]+)\.?(?:\s+(\d{4}))?/g)]
    .map((m) => ({ dag: +m[1], maand: MAANDEN[m[2]], jaar: m[3] ? +m[3] : undefined }))
    .filter((d) => d.maand && d.dag >= 1 && d.dag <= 31);
  if (!datums.length) return undefined;
  const tijden = [...schoon.matchAll(/(\d{1,2})[:.](\d{2})/g)].map((m) => ({ uur: +m[1], minuut: +m[2] }));
  const laatsteJaar = [...datums].reverse().find((d) => d.jaar)?.jaar;
  for (const d of datums) d.jaar ??= laatsteJaar;
  for (const d of datums) {
    if (d.jaar) continue;
    const kandidaten = [nu.getFullYear() - 1, nu.getFullYear(), nu.getFullYear() + 1];
    d.jaar = kandidaten.sort(
      (a, b) => Math.abs(nederlandseTijd(a, d.maand, d.dag) - nu) - Math.abs(nederlandseTijd(b, d.maand, d.dag) - nu),
    )[0];
  }
  const [begin, einde = begin] = [datums[0], datums[datums.length - 1]];
  const start = nederlandseTijd(begin.jaar, begin.maand, begin.dag, tijden[0]?.uur ?? 0, tijden[0]?.minuut ?? 0);
  let eind;
  if (tijden[1]) eind = nederlandseTijd(einde.jaar, einde.maand, einde.dag, tijden[1].uur, tijden[1].minuut);
  else if (einde !== begin) eind = nederlandseTijd(einde.jaar, einde.maand, einde.dag, 23, 59);
  return { start: start.toISOString(), eind: eind?.toISOString(), heleDag: !tijden.length };
}

const LOCALE = { nl: 'nl-NL', en: 'en-GB' };
const formaat = (taal, opties) => new Intl.DateTimeFormat(LOCALE[taal] ?? 'nl-NL', { timeZone: TIJDZONE, ...opties });

// Op de site betekent een eindtijd van 23:59 meestal: geen eindtijd ingevuld.
const isOpenEind = (iso) => /T23:59(:59)?/.test(String(iso ?? '')) || formaat('nl', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) === '23:59';
const isMiddernacht = (iso) => formaat('nl', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) === '00:00';

export function datumDelen(iso, taal = 'nl') {
  const d = new Date(iso);
  return {
    dag: formaat(taal, { day: 'numeric' }).format(d),
    maand: formaat(taal, { month: 'short' }).format(d).replace('.', ''),
    weekdag: formaat(taal, { weekday: 'short' }).format(d).replace('.', ''),
    jaar: formaat(taal, { year: 'numeric' }).format(d),
  };
}

export const tijd = (iso, taal = 'nl') => formaat(taal, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const datumLang = (iso, taal = 'nl') =>
  formaat(taal, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
export const datumKort = (iso, taal = 'nl') =>
  formaat(taal, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)).replace(/\./g, '');
export const maandJaar = (iso, taal = 'nl') => formaat(taal, { month: 'long', year: 'numeric' }).format(new Date(iso));
export const dagSleutel = (iso) => formaat('nl', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

// "ma 16 nov, 08:30 tot 19:00" of "ma 16 nov tot di 17 nov".
export function periode(start, eind, taal = 'nl') {
  if (!start) return '';
  const tot = taal === 'en' ? 'to' : 'tot';
  const metTijd = !isMiddernacht(start);
  let tekst = datumKort(start, taal) + (metTijd ? `, ${tijd(start, taal)}` : '');
  if (eind && dagSleutel(eind) !== dagSleutel(start)) {
    tekst += ` ${tot} ${datumKort(eind, taal)}`;
    if (!isOpenEind(eind) && !isMiddernacht(eind)) tekst += `, ${tijd(eind, taal)}`;
  } else if (eind && metTijd && !isOpenEind(eind)) {
    tekst += ` ${tot} ${tijd(eind, taal)}`;
  }
  return tekst;
}

export const tijdVak = (start, eind, taal = 'nl') => {
  if (!start || isMiddernacht(start)) return '';
  const tot = taal === 'en' ? 'to' : 'tot';
  return eind && !isOpenEind(eind) && dagSleutel(eind) === dagSleutel(start)
    ? `${tijd(start, taal)} ${tot} ${tijd(eind, taal)}`
    : tijd(start, taal);
};
