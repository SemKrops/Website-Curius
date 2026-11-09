// De agenda van Curius als abonnement: /nl/agenda.ics en /en/agenda.ics.
import { agenda } from '../../lib/ics.mjs';
import { haalSite } from '../../lib/site.mjs';

export function getStaticPaths() {
  return [{ params: { taal: 'nl' } }, { params: { taal: 'en' } }];
}

export async function GET({ params, site: adres }) {
  const site = await haalSite();
  const taal = params.taal;
  const urlVan = (a) => (adres ? new URL(a.href, adres).href : a.inschrijfLink);
  const inhoud = agenda(site.activiteiten[taal], { naam: taal === 'nl' ? 'Curius activiteiten' : 'Curius activities', urlVan });
  return new Response(inhoud, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
}
