// Maakt een iCalendar bestand (.ics) van activiteiten, voor Google Agenda,
// Outlook en de agenda op je telefoon.

const tekst = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/[,;]/g, (m) => '\\' + m);

// Regels van meer dan 75 tekens worden volgens de standaard afgebroken.
function vouw(regel) {
  const delen = [];
  let rest = regel;
  while (new TextEncoder().encode(rest).length > 75) {
    let n = 75;
    while (new TextEncoder().encode(rest.slice(0, n)).length > 75) n--;
    delen.push(rest.slice(0, n));
    rest = ' ' + rest.slice(n);
  }
  delen.push(rest);
  return delen.join('\r\n');
}

const utc = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const datumNL = (d) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(d))
    .replace(/-/g, '');
const uurNL = (d) =>
  new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

function volgendeDag(yyyymmdd) {
  const d = new Date(Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8) + 1));
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

export function evenement(a, { url, nu = new Date() } = {}) {
  const heleDag = uurNL(a.start) === '00:00';
  const openEind = !a.eind || uurNL(a.eind) === '23:59';
  const regels = ['BEGIN:VEVENT', `UID:activiteit-${a.id}@curius.nl`, `DTSTAMP:${utc(nu)}`];
  if (heleDag) {
    const eindDag = a.eind ? datumNL(a.eind) : datumNL(a.start);
    regels.push(`DTSTART;VALUE=DATE:${datumNL(a.start)}`, `DTEND;VALUE=DATE:${volgendeDag(eindDag)}`);
  } else {
    const eind = openEind
      ? datumNL(a.eind ?? a.start) !== datumNL(a.start)
        ? new Date(a.eind)
        : new Date(Date.parse(a.start) + 3 * 3600_000)
      : new Date(a.eind);
    regels.push(`DTSTART:${utc(a.start)}`, `DTEND:${utc(eind)}`);
  }
  regels.push(`SUMMARY:${tekst(a.titel)}`);
  if (a.locatie) regels.push(`LOCATION:${tekst(a.locatie)}`);
  const omschrijving = [a.samenvatting, url].filter(Boolean).join('\n\n');
  if (omschrijving) regels.push(`DESCRIPTION:${tekst(omschrijving)}`);
  if (url) regels.push(`URL:${url}`);
  regels.push('END:VEVENT');
  return regels.map(vouw).join('\r\n');
}

export function agenda(activiteiten, { naam = 'Curius', urlVan = () => undefined, nu = new Date() } = {}) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Curius//Website//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    vouw(`X-WR-CALNAME:${tekst(naam)}`),
    'X-WR-TIMEZONE:Europe/Amsterdam',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    ...activiteiten.map((a) => evenement(a, { url: urlVan(a), nu })),
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
