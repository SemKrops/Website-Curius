// Kleine rekenhulpjes voor Mijn Curius, zonder iets van de pagina. Daardoor kunnen de
// tests (tests/rekenen.test.mjs) ze los proberen.

// "12,50", "12.50" of "€ 1.234,56" als getal (in euro), of NaN.
export function leesBedrag(tekst) {
  let s = String(tekst ?? '').replace(/[€\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
}

// Het vierkant in het midden van een foto, als delen van de breedte en hoogte (zoals de
// server het wil, zie maakProfielfoto in de server van de app).
export function middenVierkant(breedte, hoogte) {
  if (!breedte || !hoogte) return undefined;
  if (breedte >= hoogte) {
    const b = hoogte / breedte;
    return { x: (1 - b) / 2, y: 0, breedte: b, hoogte: 1 };
  }
  const hh = breedte / hoogte;
  return { x: 0, y: (1 - hh) / 2, breedte: 1, hoogte: hh };
}
