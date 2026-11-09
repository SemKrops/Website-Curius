// Inschrijven en uitschrijven op de pagina van een activiteit, via de Curius server.
//
// Niet ingelogd: een knop om in te loggen (als je je voor deze activiteit kunt inschrijven).
// Ingelogd: of je bent ingeschreven, met een knop om je in of uit te schrijven, en wie er
// nog meer gaan (zoals op de oude site als je was ingelogd).

import { h, icoon, melding, metBezig, vul, webAdres } from './dom.mjs';
import { bijSessie, LedenFout, sessie, tekst, vraag } from './leden.mjs';
import { metSiteInlog, openInloggen, vraagWachtwoord } from './ledenkop.mjs';

export function koppelInschrijven(blok) {
  const id = blok.dataset.inschrijven;
  const kanVolgensKalender = blok.hasAttribute('data-kan');
  let bezig = 0;

  const t = () => tekst();
  const pad = `/activiteiten/${encodeURIComponent(id)}`;

  function toonUitgelogd() {
    if (!kanVolgensKalender) return vul(blok);
    vul(
      blok,
      h(
        'button',
        {
          class: 'knop knop--primair',
          type: 'button',
          // Na het inloggen laadt bijSessie hieronder de inschrijving.
          onclick: () => openInloggen(t().inlogRedenInschrijven),
        },
        icoon('login', 18),
        t().inloggenEnInschrijven,
      ),
    );
  }

  function toonFout(fout, opnieuw) {
    vul(
      blok,
      melding(fout.message),
      h('button', { class: 'knop knop--rand knop--klein', type: 'button', onclick: opnieuw }, t().opnieuw),
    );
  }

  async function laad() {
    const ronde = ++bezig;
    if (!sessie()) return toonUitgelogd();
    vul(blok, h('p', { class: 'inschrijven__status inschrijven__status--laden' }, h('span', { class: 'draaier', 'aria-hidden': 'true' }), t().statusLaden));
    try {
      let a = await vraag(pad);
      // De inlog op curius.nl is verlopen: zonder die inlog weten we niet of je bent ingeschreven.
      if (a.moetInloggen && (await vraagWachtwoord(t().wachtwoordOpnieuw))) a = await vraag(pad);
      if (ronde === bezig) toon(a);
    } catch (fout) {
      if (ronde !== bezig) return;
      if (fout instanceof LedenFout && fout.status === 401) return toonUitgelogd();
      toonFout(fout, laad);
    }
  }

  async function wissel(knop, soort) {
    if (soort === 'uitschrijven' && !confirm(t().uitschrijvenVraag)) return;
    const vak = blok.querySelector('[data-formmelding]');
    vul(vak);
    try {
      const a = await metBezig(knop, () =>
        metSiteInlog(() => vraag(`${pad}/inschrijving`, { methode: soort === 'inschrijven' ? 'POST' : 'DELETE' }), t().wachtwoordOpnieuw),
      );
      toon(a, true);
    } catch (fout) {
      if (fout instanceof LedenFout && fout.status === 401) return toonUitgelogd();
      vul(vak, melding(fout.message));
    }
  }

  function toon(a, netGedaan = false) {
    const knoppen = h('div', { class: 'inschrijven__knoppen' });
    const betaalUrl = webAdres(a.betaalUrl);
    const formulierUrl = webAdres(a.url);
    let status;
    if (a.ingeschreven) {
      status = h('p', { class: 'inschrijven__status inschrijven__status--ja' }, icoon('check', 18), t().ingeschreven);
      if (betaalUrl) {
        knoppen.append(
          h('a', { class: 'knop knop--primair', href: betaalUrl, target: '_blank', rel: 'noopener' }, t().betalen, icoon('external', 17)),
        );
      }
      if (a.inschrijvingOpen !== false) {
        knoppen.append(h('button', { class: 'knop knop--rand', type: 'button', onclick: (e) => wissel(e.currentTarget, 'uitschrijven') }, t().uitschrijven));
      }
    } else if (a.viaSite && formulierUrl) {
      status = h('p', { class: 'inschrijven__status' }, t().viaSite);
      knoppen.append(h('a', { class: 'knop knop--primair', href: formulierUrl, rel: 'noopener' }, t().naarFormulier, icoon('external', 17)));
    } else if (a.inschrijvingOpen) {
      knoppen.append(
        h('button', { class: 'knop knop--primair', type: 'button', onclick: (e) => wissel(e.currentTarget, 'inschrijven') }, icoon('check', 18), t().inschrijven),
      );
    } else {
      status = h('p', { class: 'inschrijven__status' }, t().inschrijvingDicht);
    }

    const deelnemers = (a.deelnemers ?? []).map((d) => d.naam).filter(Boolean);
    const aantal = a.aantalIngeschreven ?? (a.deelnemers ? deelnemers.length : undefined);
    vul(
      blok,
      status,
      knoppen.childElementCount ? knoppen : null,
      a.ingeschreven && betaalUrl && netGedaan ? h('p', { class: 'inschrijven__uitleg' }, t().betalenUitleg) : null,
      h('div', { 'data-formmelding': '' }),
      aantal !== undefined
        ? deelnemers.length
          ? h(
              'details',
              { class: 'deelnemers' },
              h('summary', {}, icoon('users', 18), t().aantal(aantal, a.maxDeelnemers), icoon('chevronDown', 16)),
              h('ul', {}, deelnemers.map((naam) => h('li', {}, naam))),
            )
          : h('p', { class: 'deelnemers deelnemers--leeg' }, icoon('users', 18), t().aantal(aantal, a.maxDeelnemers))
        : null,
    );
  }

  bijSessie(() => laad());
  laad();
}

document.querySelectorAll('[data-inschrijven]').forEach(koppelInschrijven);
