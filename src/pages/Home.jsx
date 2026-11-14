import { useState } from 'react';
import { useReveal, CountUp } from '../lib/ui';
import {
  REAL_WORDS, MEHRFACH, WORD_COUNT, REAL_MENTIONS, WORD_BY_ES,
  GROWTH, EPISODES, STAND, FOLGEN, KANAL, STUNDEN,
} from '../lib/data';

/* Die Startseite führt das Argument, sie ist kein zweiter Wortschatz.
   Vier Abschnitte, vier verschiedene Formen:
     1. die Zahl + die Kurve   (Verlauf)
     2. was zuletzt dazukam    (der Fortschritt, der Grund wiederzukommen)
     3. die häufigsten Wörter  (Magnitude)
     4. die Hochrechnung       (Maßstab: wie weit ist das von „Spanisch können")
   Die vollständige Liste gehört auf /wortschatz und steht bewusst nur dort.

   Hier stand früher „Ganze Sätze." — elf Sätze in Überschriftgröße untereinander,
   ein halber Bildschirm pro Stück. Das ist Datenblatt, nicht Startseite: Die
   Sätze stehen jetzt im Wortschatz, wo die vollständige Liste ohnehin lebt. */

const satzLang = (w) => w.es.trim().split(/\s+/).length >= 3;
const SAETZE = REAL_WORDS.filter(satzLang);
const TOP = MEHRFACH.slice(0, 5);

/* Die letzten drei Folgen, in denen überhaupt etwas dazukam. Rückwärts gesucht,
   weil „zuletzt" das ist, wonach jemand die Seite aufruft. */
const ZULETZT = [...FOLGEN].reverse().filter((f) => f.words.length > 0).slice(0, 3);

const firstIdx = GROWTH.findIndex((v) => v > 0);
const firstEp = firstIdx >= 0 ? FOLGEN[firstIdx].ep : null;

/* Die frühen Folgen tragen keine Nummer im Titel; dort ist das Jahr die
   ehrlichste Kennung. Siehe denselben Gedanken in Folgen.jsx. */
const kennung = (f) => (f.ep ? `#${f.ep}` : f.date);
const kurz = (f) => (f.ep ? `#${f.ep}` : f.date.split('.').pop());

/* ---------------------------------------------------------------------------
   Hochrechnung. Jede Zahl unten wird gerechnet, keine steht fest im Text —
   nach dem nächsten Datenlauf stimmt der Abschnitt also von allein weiter.
   Tempo = Wörter pro Jahr zwischen der ersten und der letzten ausgewerteten
   Folge. Die Zielgrößen sind gängige Richtwerte für den Grundwortschatz einer
   Stufe, kein Prüfungsstandard; das sagt der Abschnitt auch selbst.
   --------------------------------------------------------------------------- */
const datum = (s) => { const [t, m, j] = s.split('.').map(Number); return new Date(j, m - 1, t); };
const VON = datum(FOLGEN[0].date);
const BIS = datum(FOLGEN[FOLGEN.length - 1].date);
const TAGE = Math.round((BIS - VON) / 86400000);
const PRO_JAHR = WORD_COUNT / (TAGE / 365.25);
const PRO_FOLGE = WORD_COUNT / FOLGEN.length;

const STUFEN = [
  { k: 'A1', ziel: 500, was: 'sich vorstellen, bestellen, nach dem Weg fragen' },
  { k: 'A2', ziel: 1000, was: 'einfache Gespräche über Alltag und Arbeit' },
  { k: 'B1', ziel: 2000, was: 'zusammenhängend erzählen, Meinung begründen' },
  { k: 'B2', ziel: 4000, was: 'fließend diskutieren, auch über Abstraktes' },
].map((s) => ({
  ...s,
  /* Vom Monat der letzten Folge aus gerechnet, nicht vom Jahresanfang. */
  jahr: Math.round(BIS.getFullYear() + BIS.getMonth() / 12 + (s.ziel - WORD_COUNT) / PRO_JAHR),
  anteil: Math.min(1, WORD_COUNT / s.ziel),
}));

const komma = (n, k = 1) => n.toFixed(k).replace('.', ',').replace(/,0$/, '');
const prozent = (a) => komma(a * 100, 1);

/* ---------------------------------------------------------------------------
   Wortschatz über die Zeit. Eine Treppe, keine weiche Kurve — der Wortschatz
   wächst sprunghaft, nicht kontinuierlich. Zeigt beim Überfahren die Folge.
   --------------------------------------------------------------------------- */
function ProgressChart() {
  const [hover, setHover] = useState(null);
  const n = GROWTH.length;
  const max = Math.max(1, ...GROWTH);
  const W = 640, H = 250, padL = 34, padR = 16, padT = 20, padB = 30;
  const x = (i) => padL + (i * (W - padL - padR)) / (n - 1);
  const y = (v) => padT + (1 - v / max) * (H - padT - padB);

  /* Stufenpfad: erst waagerecht bis zur nächsten Folge, dann senkrecht hoch. */
  let d = `M${x(0).toFixed(1)} ${y(GROWTH[0]).toFixed(1)}`;
  for (let i = 1; i < n; i++) d += ` H${x(i).toFixed(1)} V${y(GROWTH[i]).toFixed(1)}`;
  const area = `${d} V${y(0).toFixed(1)} H${x(0).toFixed(1)} Z`;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - padL) * (n - 1)) / (W - padL - padR))));
    setHover(i);
  };

  const h = hover != null ? FOLGEN[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`} className="w-full text-apple" style={{ height: 'auto' }}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Kevins spanischer Wortschatz wächst über ${n} Folgen von 0 auf ${max} Wörter.`}
      >
        {[0, Math.round(max / 2), max].map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="rgb(var(--hair))" strokeWidth="1"
              strokeDasharray={v === 0 ? '0' : '2 4'} />
            <text x={padL - 7} y={y(v) + 3.5} textAnchor="end" className="font-mono" fontSize="10" fill="rgb(var(--ink-soft))">{v}</text>
          </g>
        ))}

        <path className="chart-area" d={area} fill="currentColor" />
        <path className="chart-line" pathLength="1" d={d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Erste Folge mit einem Wort */}
        <line x1={x(firstIdx)} y1={y(0)} x2={x(firstIdx)} y2={padT} stroke="rgb(var(--ink-soft))" strokeWidth="1" strokeDasharray="2 3" opacity=".45" />

        {/* Messpunkt beim Überfahren */}
        {h && (
          <g>
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={y(0)} stroke="currentColor" strokeWidth="1" opacity=".5" />
            <circle cx={x(hover)} cy={y(GROWTH[hover])} r="4" fill="rgb(var(--card))" stroke="currentColor" strokeWidth="2" />
          </g>
        )}

        <circle className="chart-dot" cx={x(n - 1)} cy={y(GROWTH[n - 1])} r="4.5" fill="currentColor" />
        <text x={x(n - 1)} y={y(GROWTH[n - 1]) - 10} textAnchor="end" className="font-mono" fontSize="13" fontWeight="600" fill="currentColor">{max}</text>

        {[0, firstIdx, n - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 10} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            className="font-mono" fontSize="10" fill="rgb(var(--ink-soft))">{kurz(FOLGEN[i])}</text>
        ))}
      </svg>

      {/* Lesehilfe statt schwebendem Tooltip: bleibt an einer festen Stelle,
          springt nicht, und ist auch ohne Zeigegerät sinnvoll befüllt. */}
      <p className="mt-1 min-h-[1.5rem] font-mono t-label text-ink-soft">
        {h
          ? <>Folge {kennung(h)} · {h.date} · <span className="text-ink">{h.cumulative} Wörter</span>{h.words.length ? <> · neu: {h.words.join(', ')}</> : null}</>
          : <>&nbsp;</>}
      </p>
    </div>
  );
}

export default function Home() {
  useReveal();
  return (
    <div>
      {/* ── 1. Die Zahl und ihr Verlauf ───────────────────────────────── */}
      <section className="relative overflow-hidden mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-24">
        <div className="aurora" aria-hidden="true">
          <div className="aur-blob aur-1" />
          <div className="aur-blob aur-2" />
        </div>

        <div data-reveal className="relative z-10 min-w-0">
          <p className="font-mono t-label text-ink-soft">Stand {STAND}</p>

          <h1 className="mt-5 text-balance font-semibold t-h1 text-ink">
            Kevin kann <CountUp to={WORD_COUNT} /> Wörter Spanisch.
          </h1>

          <p className="mt-5 max-w-[42ch] t-lead text-pretty text-ink-soft">
            {REAL_MENTIONS} Nennungen in {STUNDEN} Stunden Material.
          </p>

          <a href="#/wortschatz" className="btn btn-primary btn-lg mt-7">Alle Wörter ansehen</a>
        </div>

        <figure data-reveal className="relative z-10 min-w-0 surface p-5 sm:p-7">
          <figcaption className="mb-4 flex items-baseline justify-between">
            <h2 className="t-ui font-semibold text-ink">Wortschatz über die Zeit</h2>
            <span className="font-mono t-label text-ink-soft">{EPISODES} Folgen</span>
          </figcaption>
          <ProgressChart />
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-hair pt-4">
            <div>
              <dt className="font-mono t-label text-ink-soft">Erstes Wort</dt>
              <dd className="mt-0.5 t-ui font-semibold text-ink">Folge #{firstEp}</dd>
            </div>
            <div>
              <dt className="font-mono t-label text-ink-soft">Ganze Sätze</dt>
              <dd className="mt-0.5 t-ui font-semibold text-ink">{SAETZE.length}</dd>
            </div>
            <div>
              <dt className="font-mono t-label text-ink-soft">Nennungen</dt>
              <dd className="mt-0.5 t-ui font-semibold text-ink">{REAL_MENTIONS}</dd>
            </div>
          </dl>
        </figure>
      </section>

      {/* ── 2. Was zuletzt dazukam — der Fortschritt, sofort sichtbar ──── */}
      <section className="border-y border-hair bg-cloud">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:py-20">
          <div data-reveal className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            <h2 className="text-balance font-semibold t-h2 text-ink">Neu</h2>
          </div>

          {/* Die jüngste Folge mit Fund bekommt die ganze Breite und die großen
              Chips; die zwei davor stehen kleiner darunter. Ohne diese Abstufung
              sähen drei gleich große Blöcke aus wie eine Liste, und man müsste
              die Folgennummern lesen, um zu wissen, was das Neueste ist. */}
          <ol className="mt-8">
            {ZULETZT.map((f, i) => (
              <li
                key={f.n}
                data-reveal
                className={'border-t border-hair py-6 first:border-t-0 first:pt-0'
                  + (i === 0 ? ' pb-8' : '')}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className={'font-mono text-ink ' + (i === 0 ? 't-ui font-semibold' : 't-meta')}>
                    Folge {kennung(f)}
                    <span className="ml-3 font-sans font-normal text-ink-soft">{f.title}</span>
                  </p>
                  <p className="font-mono t-label text-ink-soft">
                    {f.date} · <span className="font-semibold text-apple">+{f.words.length}</span>
                  </p>
                </div>

                <ul className={'flex flex-wrap gap-2 ' + (i === 0 ? 'mt-4' : 'mt-3')}>
                  {f.words.map((es) => {
                    const w = WORD_BY_ES[es];
                    return (
                      <li
                        key={es}
                        className={'inline-flex items-baseline gap-2 rounded-lg bg-card ring-1 ring-inset ring-apple/30 '
                          + (i === 0 ? 'px-3 py-2' : 'px-2.5 py-1.5')}
                      >
                        <span lang="es" className={'font-medium text-ink ' + (i === 0 ? 't-ui' : 't-meta')}>{es}</span>
                        {w && <span className="t-meta text-ink-soft">{w.de}</span>}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>

          <p data-reveal className="mt-8 t-meta text-ink-soft">
            {SAETZE.length} der {WORD_COUNT} Einträge sind ganze Sätze.
          </p>
        </div>
      </section>

      {/* ── 3. Häufigkeit — nur die Wörter, bei denen die Zahl variiert ── */}
      <section className="mx-auto max-w-5xl px-6 py-20 lg:py-24">
        <div className="grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div data-reveal className="max-w-[34ch]">
            <h2 className="text-balance font-semibold t-h2 text-ink">
              Häufigste Wörter
            </h2>
            <p className="mt-4 t-body text-ink-soft">
              {REAL_WORDS.length - MEHRFACH.length} der {REAL_WORDS.length} Wörter
              fielen genau einmal.
            </p>
          </div>

          <dl data-reveal className="min-w-0">
            {TOP.map((w) => (
              <div key={w.es} className="flex items-center gap-4 border-t border-hair py-3.5 first:border-t-0">
                <dt className="w-28 shrink-0 t-ui font-medium text-ink sm:w-36">{w.es}</dt>
                <dd className="flex min-w-0 flex-1 items-center gap-3">
                  {/* Kappe rechts flach, links vom Track rund beschnitten —
                      so schreibt es DESIGN.md vor. Ein rounded-full auf der
                      Füllung würde von scaleX verzerrt. */}
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50">
                    <span className="bar-fill block h-full bg-apple" style={{ '--s': w.count / TOP[0].count }} />
                  </span>
                  <span className="w-8 shrink-0 text-right font-mono t-meta font-medium tabular-nums text-ink">{w.count}×</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── 4. Hochrechnung — der Maßstab, den die Zahl allein nicht hat ── */}
      <section className="border-t border-hair">
        <div className="mx-auto max-w-5xl px-6 py-20 lg:py-24">
          <div className="grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-[1fr_1.15fr]">
            <div data-reveal className="max-w-[36ch]">
              <h2 className="text-balance font-semibold t-h2 text-ink">
                Hochrechnung
              </h2>
              <p className="mt-4 t-body text-ink-soft">
                {WORD_COUNT} Wörter in {TAGE} Tagen: {komma(PRO_JAHR)} pro Jahr,
                {komma(PRO_FOLGE)} pro Folge.
              </p>
              <p className="mt-4 t-body text-ink-soft">
                Bei diesem Tempo: {STUFEN[0].k} im Jahr {STUFEN[0].jahr}.
              </p>

              <details className="mt-5">
                <summary className="cursor-pointer list-none t-meta font-medium lnk">
                  Womit gerechnet wird
                </summary>
                <p className="mt-3 t-meta text-ink-soft">
                  Als Grundwortschatz je Stufe sind {STUFEN.map((s) => s.ziel).join(', ')} Wörter
                  angesetzt. Fortgeschrieben
                  wird linear ab {FOLGEN[FOLGEN.length - 1].date}, dem Tag der letzten
                  ausgewerteten Folge.
                </p>
              </details>
            </div>

            <dl data-reveal className="min-w-0">
              {STUFEN.map((s) => (
                <div key={s.k} className="border-t border-hair py-5 first:border-t-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="flex items-baseline gap-2.5">
                      <span className="t-body font-semibold text-ink">{s.k}</span>
                      <span className="font-mono t-label text-ink-soft">{s.ziel} Wörter</span>
                    </dt>
                    <dd className="shrink-0 font-mono t-body font-semibold tabular-nums text-ink">
                      {s.jahr}
                    </dd>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50">
                      <span className="bar-fill block h-full bg-apple" style={{ '--s': s.anteil }} />
                    </span>
                    <span className="w-11 shrink-0 text-right font-mono t-label tabular-nums text-ink-soft">
                      {prozent(s.anteil)} %
                    </span>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}
