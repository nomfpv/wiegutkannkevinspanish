import { useReveal } from '../lib/ui';
import { FOLGEN, WORD_BY_ES } from '../lib/data';
import { WennEier, WortlautAbschnitt } from '../lib/EierAbschnitte';

/* Zeitstrahl statt Liste, NEUESTE ZUERST.

   Die Seite beantwortet zwei Fragen und sonst keine: „Was kam zuletzt dazu?"
   und „Wie selten passiert das?". Deshalb läuft sie rückwärts — wer die Seite
   öffnet, will den aktuellen Stand sehen, nicht Folge #323 von vor zwei Jahren.

   In den meisten Folgen fällt kein einziges spanisches Wort. Gäbe man jeder
   Folge eine eigene Zeile, bestünde die Seite überwiegend aus identischen
   Leerzeilen. Zusammenhängende Nullserien werden deshalb zu EINER Marke
   verdichtet („14 Folgen, kein Spanisch"). Die Stille bleibt sichtbar und wird
   sogar lesbarer, weil die Folgen mit Fund jetzt den Platz bekommen. */

const hatFund = (e) => e.words.length > 0 || (e.loan && e.loan.length > 0);

/* Kennung einer Folge. Die frühe Ära trägt keine Nummer im Titel — dort ist das
   Datum die einzige ehrliche Kennung. Eine erfundene Nummer wäre schlimmer als
   gar keine, weil sie mit den echten #296 bis #415 kollidieren würde. */
const kennung = (e) => (e.ep ? `#${e.ep}` : e.date);
const anker = (e) => (e.ep ? `f${e.ep}` : `fn${e.n}`);

/* Anzeige-Reihenfolge: neu → alt. data.js bleibt chronologisch, weil GROWTH und
   die Kurve auf der Startseite darauf aufbauen. */
const NEUZUERST = [...FOLGEN].reverse();
const STILL = FOLGEN.filter((e) => !hatFund(e)).length;
const LETZTE_MIT_FUND = NEUZUERST.find((e) => e.words.length > 0);

function buildSegmente(folgen) {
  const out = [];
  for (const ep of folgen) {
    if (hatFund(ep)) { out.push({ art: 'fund', ep }); continue; }
    const last = out[out.length - 1];
    /* Rückwärts gelesen kommt die jüngste Folge der Serie zuerst; `von` ist
       also der Anfang der Marke, `bis` das ältere Ende. */
    if (last && last.art === 'still') { last.bis = ep; last.n += 1; }
    else out.push({ art: 'still', von: ep, bis: ep, n: 1, key: ep.n });
  }
  return out;
}
const SEGMENTE = buildSegmente(NEUZUERST);

/* ---------------------------------------------------------------------------
   Alle Folgen auf einen Blick.

   Hier stand ein Säulendiagramm „Wann in einer Folge" (Treffer nach Zehnteln
   der Laufzeit). Es ist raus: Die Frage, an welcher MINUTE ein Wort fällt,
   beantwortet nichts, was jemanden interessiert, und der Kasten war so hoch wie
   zehn Folgenzeilen.

   Stattdessen dasselbe Raster, das die Liste darunter ausmacht, nur auf einem
   Bildschirm: ein Kästchen je Folge, neueste links oben. Man sieht sofort, wie
   dünn die Funde gesät sind, und kann per Klick zur Folge springen.
   --------------------------------------------------------------------------- */
const stufe = (e) => (e.words.length >= 3 ? 3 : e.words.length ? 2 : hatFund(e) ? 1 : 0);
const KACHEL = [
  'bg-cloud',                                   // 0 — nichts
  'bg-cloud ring-1 ring-inset ring-hair',       // 1 — nur ein Lehnwort
  'bg-apple/40',                                // 2 — ein bis zwei neue Wörter
  'bg-apple',                                   // 3 — drei und mehr
];

/* Die längste Serie ohne ein neues Wort. Gerechnet, nicht geschätzt. */
const LAENGSTE = SEGMENTE
  .filter((s) => s.art === 'still')
  .reduce((a, b) => (!a || b.n > a.n ? b : a), null);
const BESTE = FOLGEN.reduce((a, b) => (b.words.length > a.words.length ? b : a), FOLGEN[0]);

function Ueberblick() {
  return (
    <figure data-reveal className="mt-8 surface p-5 sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="t-ui font-semibold text-ink">Alle {FOLGEN.length} Folgen</h2>
        <span className="font-mono t-label text-ink-soft">neueste zuerst</span>
      </figcaption>

      {/* Feste Spaltenbreite statt auto-fit: Ein Raster, dessen Zeilenlänge sich
          mit der Fensterbreite ändert, ist kein Raster mehr, das man wiedererkennt. */}
      <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(18px,1fr))] gap-1.5">
        {NEUZUERST.map((e) => {
          const titel = `${kennung(e)} · ${e.title} · ${e.words.length ? `${e.words.length} neu` : 'nichts Neues'}`;
          const kachel = 'aspect-square rounded-[3px] ' + KACHEL[stufe(e)];
          /* Nur Folgen mit Fund haben unten eine eigene Zeile. Ein Kästchen, das
             beim Klick nirgendwohin führt, wäre eine Einladung ins Leere. */
          return hatFund(e) ? (
            <button
              key={e.n}
              type="button"
              /* Kein <a href="#f415">: Die Seite läuft auf Hash-Routing, ein
                 zweiter Hash im Link würde die Route zerschießen. */
              onClick={() => document.getElementById(anker(e))?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              title={titel}
              aria-label={`Zu Folge ${kennung(e)}, ${e.words.length} neue Wörter`}
              className={kachel + ' transition-transform hover:scale-125'}
            />
          ) : (
            <span key={e.n} title={titel} aria-hidden="true" className={kachel} />
          );
        })}
      </div>

      {/* Die Legende benutzt exakt dieselben Klassen wie das Raster (KACHEL) —
          sonst driftet sie beim nächsten Farbdreh von den Kästchen weg. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono t-label text-ink-soft">
        {[
          [0, 'nichts'],
          [1, 'nur ein Lehnwort'],
          [2, '1 bis 2 neu'],
          [3, '3 und mehr'],
        ].map(([s, text]) => (
          <span key={text} className="inline-flex items-center gap-1.5">
            <span className={'h-2.5 w-2.5 rounded-[2px] ' + KACHEL[s]} /> {text}
          </span>
        ))}
      </div>

      <p className="mt-4 max-w-[62ch] t-meta text-ink-soft">
        In {STILL} der {FOLGEN.length} Folgen kommt kein neues Wort dazu.
        {/* Hier zwei Daten statt Folgennummern: Die längste Serie reicht bis in
            die Zeit ohne Nummern zurück, und „von #338 bis 9.7.2023" mischt
            zwei Kennungsarten in einem Satz. Eine Pause ist ohnehin eine
            Zeitspanne, also ältestes zuerst. */}
        {LAENGSTE && <> Die längste Pause dauerte {LAENGSTE.n} Folgen, von {LAENGSTE.bis.date} bis {LAENGSTE.von.date}.</>}
        {' '}Am meisten brachte Folge {kennung(BESTE)} mit {BESTE.words.length} Wörtern auf einmal.
      </p>
    </figure>
  );
}

function WordChip({ es }) {
  const w = WORD_BY_ES[es];
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-md bg-apple/10 px-2 py-1 t-meta ring-1 ring-inset ring-apple/25">
      <span lang="es" className="font-medium text-ink">{es}</span>
      {w && <span className="text-ink-soft">{w.de}</span>}
    </span>
  );
}

export default function Folgen() {
  useReveal();
  return (
    <div>
      <section className="mx-auto max-w-4xl px-6 pb-6 pt-12 lg:pt-16">
        <div data-reveal className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <h1 className="text-balance font-semibold t-h2 text-ink">Folgen</h1>
          <p className="font-mono t-label text-ink-soft">
            {FOLGEN.length - STILL} von {FOLGEN.length} Folgen mit Fund
          </p>
        </div>

        <Ueberblick />
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        {/* Zeitstrahl: eine durchgehende 1px-Linie, alle Marken exakt darauf
            zentriert (left-0 + -translate-x-1/2). */}
        <ol className="relative ml-2 border-l border-hair">
          {SEGMENTE.map((s) => (
            s.art === 'still' ? (
              <li key={`s${s.key}`} className="relative py-4 pl-7 sm:pl-9">
                <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-hair" aria-hidden="true" />
                <p className="font-mono t-label leading-none text-ink-soft">
                  {s.n === 1
                    ? <>{kennung(s.von)} · nichts Neues</>
                    : <>{kennung(s.von)} bis {kennung(s.bis)} · {s.n} Folgen ohne ein neues Wort</>}
                </p>
              </li>
            ) : (
              <li key={s.ep.n} id={anker(s.ep)} data-reveal className="relative scroll-mt-24 py-6 pl-7 sm:pl-9">
                <span
                  className={'absolute left-0 top-[1.85rem] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-bg '
                    + (s.ep.words.length ? 'bg-apple' : 'bg-hair')}
                  aria-hidden="true"
                />
                <article className="flex flex-col gap-x-6 gap-y-3 sm:flex-row sm:items-baseline">
                  <p className="shrink-0 font-mono t-meta leading-none text-ink sm:w-16">{kennung(s.ep)}</p>
                  <div className="min-w-0 flex-1">
                    <h2 className="t-body font-medium leading-snug text-ink">
                      {s.ep.title}
                      {/* Nur die jüngste Folge mit Fund trägt die Marke — sie ist
                          der Grund, warum jemand die Seite überhaupt neu lädt. */}
                      {s.ep === LETZTE_MIT_FUND && (
                        <span className="ml-2 rounded bg-apple px-1.5 py-0.5 align-middle font-mono t-label font-semibold uppercase tracking-wide text-bg">
                          neu
                        </span>
                      )}
                    </h2>
                    <p className="mt-1 font-mono t-label text-ink-soft">{s.ep.date} · {s.ep.dur}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {s.ep.words.map((es) => <WordChip key={es} es={es} />)}
                      {s.ep.loan && s.ep.loan.map((es) => (
                        <span key={es} className="rounded-md px-2 py-1 t-meta text-ink-soft ring-1 ring-inset ring-hair">{es}</span>
                      ))}
                    </div>
                  </div>
                  <p className="shrink-0 font-mono t-label leading-none text-ink-soft sm:w-20 sm:text-right">
                    Wortschatz <span className="ml-1.5 t-ui font-semibold text-ink sm:ml-0 sm:mt-1 sm:block">{s.ep.cumulative}</span>
                  </p>
                </article>
              </li>
            )
          ))}
        </ol>

        <div data-reveal className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 t-meta text-ink-soft">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-apple" /> neues Wort
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-hair" /> nur ein Lehnwort
          </span>
        </div>
      </section>

      <WennEier><WortlautAbschnitt /></WennEier>
    </div>
  );
}
