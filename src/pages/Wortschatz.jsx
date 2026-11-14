import { useReveal, quelle } from '../lib/ui';
import { WennEier, ReezeAbschnitt } from '../lib/EierAbschnitte';
import {
  KATEGORIEN, LEHN_WORDS, LEHN_MENTIONS, STAND, EPISODES,
  WORD_COUNT, REAL_MENTIONS, MEHRFACH, KANAL, REAL_WORDS,
} from '../lib/data';

/* Dicht statt geschwätzig: alle Wörter sofort sichtbar, Erklärungen stecken in
   <details> und stören nur, wenn man sie aufklappt. Die früheren Fließtexte
   über jeder Gruppe sind weg — die Gruppennamen sagen dasselbe in zwei Worten. */

/* Hier stand ein Punkt-Histogramm der Häufigkeiten. Es ist raus: Die Aussage
   („die meisten Wörter fielen einmal") stand als Satz schon in der Kopfzeile,
   und die Liste unten nennt die Häufigkeit ohnehin bei jedem Wort. Eine Grafik,
   die nur wiederholt, was daneben steht, ist Dekoration. */

/* Ganze Sätze sind hier zu Hause, seit die Startseite sie los ist. Ein Versuch,
   Gruppen mit Sätzen zwei Rasterspalten zu geben, ist wieder raus: Fast jede
   Gruppe enthält einen Satz, also wurde aus dem dreispaltigen Raster eine
   einzige breite Spalte mit einer leeren Bildschirmhälfte daneben. Die Sätze
   brechen in der schmalen Spalte um, und das ist in einer Liste völlig in Ordnung. */

function Wort({ w }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-t border-hair py-2">
      <span className="min-w-0">
        <span lang="es" className="t-ui font-medium text-ink">{w.es}</span>
        {/* Beruht nur auf Stellen, an denen der Sprecherwechsel nicht auflösbar war. */}
        {w.unsicher && (
          <abbr title="Sprecher nicht eindeutig belegt" className="ml-1 cursor-help align-super t-label font-medium text-ink-soft no-underline">?</abbr>
        )}
        <span className="ml-2 t-meta text-ink-soft">{w.de}</span>
      </span>
      <span className="shrink-0 font-mono t-label tabular-nums text-ink-soft">
        {w.folge ? `#${w.folge}` : 'YT'}{w.count > 1 && <span className="ml-1.5 font-medium text-apple">{w.count}×</span>}
      </span>
    </li>
  );
}

export default function Wortschatz() {
  useReveal();
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
      <div data-reveal className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <h1 className="text-balance font-semibold t-h2 text-ink">
          Wortschatz
        </h1>
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono t-label text-ink-soft">
          <div className="flex items-baseline gap-1.5"><dt>Nennungen</dt><dd className="font-semibold text-ink">{REAL_MENTIONS}</dd></div>
          <div className="flex items-baseline gap-1.5"><dt>mehrfach</dt><dd className="font-semibold text-ink">{MEHRFACH.length}</dd></div>
          <div className="flex items-baseline gap-1.5"><dt>Stand</dt><dd className="text-ink">{STAND}</dd></div>
        </dl>
      </div>

      {/* Alles auf einen Blick: Gruppen nebeneinander, nicht untereinander. */}
      <div data-reveal className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {KATEGORIEN.map((k) => (
          <section key={k.key} className="min-w-0 break-inside-avoid">
            <h2 className="flex items-baseline justify-between gap-2 pb-1 t-meta font-semibold uppercase tracking-wide text-ink">
              {k.label}
              <span className="font-mono t-label font-normal normal-case text-ink-soft">{k.words.length}</span>
            </h2>
            <ul>{k.words.map((w) => <Wort key={w.es} w={w} />)}</ul>
          </section>
        ))}

        <section className="min-w-0">
          <h2 className="flex items-baseline justify-between gap-2 pb-1 t-meta font-semibold uppercase tracking-wide text-ink-soft">
            Lehnwörter
            <span className="font-mono t-label font-normal normal-case text-ink-soft">zählen nicht</span>
          </h2>
          <ul>
            {LEHN_WORDS.map((w) => (
              <li key={w.es} className="flex items-baseline justify-between gap-3 border-t border-hair py-2">
                <span className="t-ui text-ink-soft">{w.es}</span>
                <span className="shrink-0 font-mono t-label tabular-nums text-ink-soft">{w.count}×</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <WennEier><ReezeAbschnitt /></WennEier>

      {/* Methodik: auf Abruf, nicht im Weg. */}
      <div data-reveal className="mt-14 border-t border-hair pt-6">
        <details className="group">
          <summary className="cursor-pointer list-none t-meta font-medium lnk">
            Wie wird gezählt?
          </summary>
          <div className="mt-4 grid max-w-3xl gap-4 t-meta text-ink-soft sm:grid-cols-2">
            <p>
              Grundlage sind die automatischen Untertitel von {EPISODES} Folgen Edeltalk
              und {KANAL.videos} Videos der Kanäle @DomoPapaplatte und @masha_bk.
            </p>
            <p>
              Untertitel kennen keine Sprecher. Jeder Treffer wurde deshalb von Hand
              zugeordnet. Was belegt Dominik oder Masha sagt, zählt nicht. Wo der
              Sprecherwechsel nicht auflösbar war, zählt der Treffer mit und das Wort
              trägt ein <span className="align-super t-label">?</span>.
            </p>
            <p>
              Lehnwörter wie Tapas oder Burrito zählen nicht ({LEHN_MENTIONS} Nennungen).
            </p>
            <p>
              Ortsnamen und Feiertage zählen nicht.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
