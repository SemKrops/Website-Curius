// De pagina's voor leden op de nieuwe site: Mijn Curius en het fotoalbum. Ze staan op
// dezelfde adressen als op de oude site, zodat links en bladwijzers blijven werken.
//
// De pagina's zelf zijn voor iedereen hetzelfde. Pas als een lid inlogt, haalt de
// browser de gegevens op bij de Curius server (dezelfde server als die van de app).

export const MIJN_CURIUS = [
  { deel: 'overzicht', icoon: 'user', nl: 'nl/mijn-curius', en: 'en/my-curius' },
  { deel: 'profiel', icoon: 'idCard', nl: 'nl/mijn-curius/mijn-profiel', en: 'en/my-curius/my-profile' },
  { deel: 'activiteiten', icoon: 'calendar', nl: 'nl/mijn-curius/mijn-profiel/mijn-evenementen', en: 'en/my-curius/my-profile/my-events' },
  { deel: 'zoeken', icoon: 'users', nl: 'nl/mijn-curius/leden-zoeken', en: 'en/my-curius/member-search' },
  { deel: 'declaraties', icoon: 'receipt', nl: 'nl/mijn-curius/declaraties', en: 'en/my-curius/reimbursements' },
  { deel: 'fotos', icoon: 'camera', nl: 'nl/media/photoalbum', en: 'en/media/photoalbum' },
];

// Andere adressen van de oude site voor dezelfde pagina. Die worden een doorverwijzing.
export const OUDE_ADRESSEN = {
  'nl/mijn-curius/mijn-profiel/profiel-bewerken': 'profiel',
  'nl/mijn-curius/mijn-profiel/mijn-pasfoto': 'profiel',
  'nl/mijn-curius/ledenlijst': 'zoeken',
  'en/my-curius/my-profile/edit-profile': 'profiel',
  'en/my-curius/my-profile/my-photo': 'profiel',
  'en/my-curius/members': 'zoeken',
  'en/my-curius/photos': 'fotos',
};

const taalVan = (pad) => (String(pad).startsWith('en') ? 'en' : 'nl');

// Hoort dit pad bij een pagina voor leden op de nieuwe site? Geeft het deel en het
// pad van die pagina (ook voor een oud adres), of undefined.
export function mijnCuriusPagina(pad) {
  const schoon = String(pad ?? '').replace(/^\/+|\/+$/g, '');
  const taal = taalVan(schoon);
  const direct = MIJN_CURIUS.find((m) => m[taal] === schoon);
  if (direct) return { ...direct, taal, pad: schoon };
  const deel = OUDE_ADRESSEN[schoon];
  if (!deel) return undefined;
  const doel = MIJN_CURIUS.find((m) => m.deel === deel);
  return { ...doel, taal, pad: doel[taal], oud: schoon };
}

export const mijnCuriusPad = (deel, taal) => MIJN_CURIUS.find((m) => m.deel === deel)?.[taal];
