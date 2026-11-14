import { useState, useEffect } from 'react';
import { WORD_BY_ES, EPISODES } from './data';
import { ZITATE, REEZE } from './zitate';
import { eierAn, abonniere } from './eier';

/* ═══════════════════════════════════════════════════════════════════════════
   Eastereggs als echte Seitenabschnitte.

   Vorher hingen alle Einblendungen in schwebenden Kästen am unteren Rand. Das
   sah aufgeklebt aus, weil es aufgeklebt WAR. Jetzt bekommt jede Seite bei
   angeschaltetem Regler zusätzliche Abschnitte, die im selben Raster, mit
   derselben Typo und denselben Flächen gebaut sind wie „Ganze Sätze" oder
   „Hochrechnung". Man soll nicht sehen, dass sie zuschaltbar sind.

   Jeder Abschnitt sitzt auf der Seite, zu der er inhaltlich gehört:
     Übersicht   → der Größenvergleich (es geht um ihn)
     Wortschatz  → was Reeze sagt und nicht zählt (es geht um Wörter)
     Folgen      → die Stellen im Wortlaut (es geht um Folgen)
   ═══════════════════════════════════════════════════════════════════════════ */

/* Rendert seine Kinder nur, wenn der Regler an ist, und hört auf Änderungen.
   So bleibt in den Seiten selbst nur eine Zeile stehen. */
export function WennEier({ children }) {
  const [, neu] = useState(0);
  useEffect(() => abonniere(() => neu((n) => n + 1)), []);
  return eierAn() ? children : null;
}

/* ── Wortschatz: die Gegenprobe ─────────────────────────────────────────────
   Dominik „Reeze" Reezmann moderiert seit 2018 mit. Bei der Sprecherprüfung
   fielen Treffer raus, weil sie belegt von ihm oder einem Gast kamen. Vier
   davon sind Wörter, die Kevin in 93 Folgen nie gesagt hat. Welche das sind,
   rechnet der Abschnitt selbst aus. */
export function ReezeAbschnitt() {
  const fremd = REEZE.filter((r) => !WORD_BY_ES[r.es]);
  const summe = REEZE.reduce((s, r) => s + r.count, 0);

  return (
    <section data-reveal className="mt-14 border-t border-hair pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <h2 className="text-balance font-semibold t-h3 text-ink">Was Reeze sagt, zählt nicht.</h2>
        <p className="font-mono t-label text-ink-soft">{summe} aussortierte Treffer</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-[1fr_1.1fr]">
        <p className="t-body max-w-[46ch] text-ink-soft">
          Untertitel kennen keine Sprecher. Jeder Treffer wurde deshalb von Hand zugeordnet.
          {' '}{summe} fielen dabei raus, weil sie belegt von Dominik oder einem Gast kamen.
          {' '}{fremd.length} davon sind Wörter, die Kevin in {EPISODES} Folgen kein einziges Mal
          gesagt hat.
        </p>

        <ul className="min-w-0">
          {fremd.map((r) => (
            <li key={r.es} className="flex items-baseline justify-between gap-4 border-t border-hair py-3 first:border-t-0 first:pt-0">
              <span className="min-w-0">
                <span lang="es" className="t-ui font-medium text-ink">{r.es}</span>
                <span className="ml-2 t-meta text-ink-soft">{r.de}</span>
              </span>
              <span className="shrink-0 font-mono t-label tabular-nums text-ink-soft">{r.count}×</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Folgen: die Stellen im Wortlaut ────────────────────────────────────────
   72 geprüfte Kevin-Treffer haben den vollen Kontext aus den Auto-Untertiteln.
   Das ist der beste Beleg, den dieses Projekt hat: nicht „Wort fiel in Folge
   X", sondern der Satz drumherum, mit allen Verhasplern der automatischen
   Transkription. Vier davon, gewürfelt, mit Knopf zum Weiterblättern. */
function zufallsAuswahl(liste, n) {
  const kopie = [...liste];
  const raus = [];
  while (raus.length < n && kopie.length) {
    raus.push(kopie.splice(Math.floor(Math.random() * kopie.length), 1)[0]);
  }
  return raus;
}

export function WortlautAbschnitt() {
  const [auswahl, setAuswahl] = useState(() => zufallsAuswahl(ZITATE, 4));

  return (
    <section data-reveal className="mx-auto max-w-4xl px-6 pb-20">
      <div className="border-t border-hair pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <h2 className="text-balance font-semibold t-h3 text-ink">Im Wortlaut.</h2>
          <button
            onClick={() => setAuswahl(zufallsAuswahl(ZITATE, 4))}
            className="font-mono t-label text-ink-soft transition-colors hover:text-ink"
          >
            andere vier ({ZITATE.length} Stellen)
          </button>
        </div>

        <p className="mt-3 max-w-[62ch] t-meta text-ink-soft">
          Die automatische Transkription der Folge, an genau der Stelle, an der das Wort fällt.
          Ungeglättet, mit allen Verhasplern.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
          {auswahl.map((z) => (
            <figure key={z.folge + z.zeit + z.wort} className="min-w-0">
              <blockquote className="t-ui leading-relaxed text-ink-soft">
                {z.vor}{' '}
                <span lang="es" className="rounded bg-apple/12 px-1.5 font-semibold text-ink ring-1 ring-inset ring-apple/25">
                  {z.wort}
                </span>{' '}
                {z.nach}
              </blockquote>
              <figcaption className="mt-2.5 font-mono t-label text-ink-soft">
                Folge #{z.folge} · {z.zeit} · {z.de}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
