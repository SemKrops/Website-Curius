// Kleine hulpjes voor het tonen van gegevens.

const SOORTEN = {
  career: { nl: 'Carrière', en: 'Career' },
  education: { nl: 'Onderwijs', en: 'Education' },
  social: { nl: 'Sociaal', en: 'Social' },
  'bar committee': { nl: 'TB-Café', en: 'TB-Café' },
};

// Het label bij een soort activiteit; "curius" (de standaard) krijgt geen label.
export function soortLabel(soort, taal) {
  const s = String(soort ?? '').trim().toLowerCase();
  if (!s || s === 'curius') return undefined;
  return { tekst: SOORTEN[s]?.[taal] ?? soort, klasse: `label--${s.replace(/\s+/g, '-')}` };
}

export const initialen = (naam) =>
  String(naam ?? '')
    .split(/\s+/)
    .filter((w) => w && /^[\p{Lu}]/u.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join('') || String(naam ?? '?').slice(0, 1).toUpperCase();

export const isToekomst = (a, nu = Date.now()) => Date.parse(a.eind ?? a.start) >= nu;
