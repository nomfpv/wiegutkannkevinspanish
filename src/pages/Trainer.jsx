import { useState, useEffect } from 'react';
import { useReveal } from '../lib/ui';
import { REAL_WORDS, LEHN_WORDS } from '../lib/data';

/* Alle auf der Seite getrackten Wörter (echtes Spanisch + Lehnwörter) —
   so ist im Test IMMER jedes Wort dabei und bleibt automatisch in sync. */
const ALL = [...REAL_WORDS, ...LEHN_WORDS];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Baut aus jedem Wort eine Frage: „Was bedeutet <es>?" mit 3 Ablenkern. */
function buildQuestions() {
  return shuffle(ALL).map((w) => {
    const pool = shuffle(ALL.filter((x) => x.de !== w.de));
    const distractors = [];
    const seen = new Set([w.de]);
    for (const x of pool) {
      if (seen.has(x.de)) continue;
      seen.add(x.de);
      distractors.push(x.de);
      if (distractors.length === 3) break;
    }
    const options = shuffle([w.de, ...distractors]);
    return { q: w.es, options, answer: options.indexOf(w.de) };
  });
}

export default function Trainer() {
  useReveal();
  const [questions, setQuestions] = useState(() => buildQuestions());
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [done, setDone] = useState(false);

  const total = questions.length;
  const item = questions[idx];
  const answered = selected !== null;

  function choose(i) {
    if (answered || i < 0 || i >= item.options.length) return;
    setSelected(i);
    if (i === item.answer) setScore((s) => s + 1);
  }
  function next() {
    if (idx < total - 1) {
      setIdx(idx + 1);
      setSelected(null);
    } else {
      setDone(true);
    }
  }
  function restart() {
    setQuestions(buildQuestions());
    setIdx(0);
    setScore(0);
    setSelected(null);
    setDone(false);
  }

  // Tastatur: 1–4 antworten, Enter/→/Leertaste weiter, Enter beim Ergebnis = neu.
  useEffect(() => {
    function onKey(e) {
      if (done) {
        if (e.key === 'Enter') restart();
        return;
      }
      if (!answered) {
        const n = Number(e.key);
        if (n >= 1 && n <= item.options.length) choose(n - 1);
        return;
      }
      if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        next();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, answered, done, questions]);

  function optionClasses(i) {
    const base = 'flex items-center gap-3 rounded-xl border px-5 py-4 text-left t-ui transition-colors duration-150';
    if (!answered) return base + ' border-hair bg-card text-ink hover:bg-cloud active:bg-hair/40 cursor-pointer';
    if (i === item.answer) return base + ' border-ok/50 bg-ok/10 text-ink';
    if (i === selected) return base + ' border-no/50 bg-no/10 text-ink';
    return base + ' border-hair bg-card text-ink-soft opacity-55';
  }

  const pct = total ? score / total : 0;
  const rating = (() => {
    if (pct >= 1) return 'Alles richtig. ¡Perfecto!';
    if (pct >= 0.8) return 'Fast alles richtig.';
    if (pct >= 0.5) return 'Solide.';
    return 'Da ist noch Luft nach oben.';
  })();

  const progress = done ? 1 : idx / total;

  return (
    <section className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
      <div data-reveal className="mb-12 text-center">
        <h1 className="text-balance font-semibold t-h2 text-ink">Mini-Test.</h1>
        <p className="mx-auto mt-4 t-lead text-ink-soft">Jedes Wort aus dem Podcast, einmal abgefragt.</p>
      </div>

      <div data-reveal className="rounded-2xl border border-hair bg-cloud p-6 sm:p-10">
        <div className="mb-8 flex items-center gap-4">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-hair">
            <div className="h-full origin-left bg-ink transition-transform duration-500 ease-out" style={{ transform: `scaleX(${progress})` }} />
          </div>
          <span className="font-mono t-label tabular-nums text-ink-soft">{done ? `${total}/${total}` : `${idx + 1}/${total}`}</span>
        </div>

        {!done ? (
          <div>
            <p className="mb-1 font-mono t-label text-ink-soft">Was bedeutet</p>
            <h2 className="mb-8 text-balance font-semibold t-h3 text-ink">{item.q}</h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {item.options.map((opt, i) => (
                <button key={i} onClick={() => choose(i)} disabled={answered} className={optionClasses(i)}>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-hair font-mono t-label text-ink-soft">{i + 1}</span>
                  <span className="flex-1">{opt}</span>
                  {answered && i === item.answer && (
                    <svg className="h-5 w-5 shrink-0 text-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                  )}
                  {answered && i === selected && i !== item.answer && (
                    <svg className="h-5 w-5 shrink-0 text-no" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-8 flex min-h-[2.75rem] items-center justify-between gap-4">
              <p className="font-mono t-label text-ink-soft">Tasten 1 bis 4 · Enter = weiter</p>
              {answered && (
                <button onClick={next} className="btn btn-primary btn-lg">
                  {idx === total - 1 ? 'Ergebnis' : 'Weiter'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center">
            <p className="font-mono t-label text-ink-soft">Ergebnis</p>
            <p className="mt-3 font-semibold t-h1 text-ink tabular-nums">
              {score}
              <span className="text-ink-soft/40"> / {total}</span>
            </p>
            <p className="mx-auto mt-5 max-w-sm t-lead text-pretty text-ink-soft">{rating}</p>
            <button onClick={restart} className="btn btn-secondary btn-lg mt-10">Nochmal</button>
          </div>
        )}
      </div>
    </section>
  );
}
