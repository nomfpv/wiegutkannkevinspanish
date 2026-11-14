import { useState, useEffect, useRef } from 'react';
import { useReveal } from '../lib/ui';
import {
  parseAny,
  parseFile,
  mergeDeck,
  loadDeck,
  saveDeck,
  clearStoredDeck,
  shuffle,
  SAMPLE_DECK,
  SUPPORTED_HINT,
} from '../lib/anki';

export default function Anki() {
  useReveal();

  const [deck, setDeck] = useState(() => loadDeck());
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState(null); // {kind:'ok'|'err', text}
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  // study session state
  const [queue, setQueue] = useState([]);
  const [studying, setStudying] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [again, setAgain] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    saveDeck(deck);
  }, [deck]);

  function flash(kind, text) {
    setNote({ kind, text });
  }

  function addCards(cards) {
    if (!cards || !cards.length) {
      flash('err', 'Keine Karten erkannt. Erwartet: „vorne〈Trenner〉hinten“ pro Zeile, oder ein gültiges Anki-/JSON-Deck.');
      return;
    }
    const before = deck.length;
    const merged = mergeDeck(deck, cards);
    setDeck(merged);
    const added = merged.length - before;
    flash('ok', added > 0 ? `${added} neue Karte${added === 1 ? '' : 'n'} importiert.` : 'Alle Karten waren bereits im Deck.');
  }

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    setNote(null);
    try {
      const cards = await parseFile(file);
      addCards(cards);
    } catch (err) {
      flash('err', err && err.message ? err.message : 'Datei konnte nicht gelesen werden.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  function importPaste() {
    addCards(parseAny(paste));
    setPaste('');
  }

  function loadSample() {
    addCards(SAMPLE_DECK);
  }

  function clearDeck() {
    setDeck([]);
    clearStoredDeck();
    setStudying(false);
    setDone(false);
    flash('ok', 'Deck geleert.');
  }

  function startStudy() {
    if (!deck.length) return;
    setQueue(shuffle(deck));
    setStudying(true);
    setDone(false);
    setShowBack(false);
    setReviewed(0);
    setAgain(0);
  }

  function grade(good) {
    setReviewed((r) => r + 1);
    setShowBack(false);
    setQueue((q) => {
      const [head, ...rest] = q;
      if (good) return rest;
      setAgain((a) => a + 1);
      return [...rest, head];
    });
  }

  useEffect(() => {
    if (studying && queue.length === 0) {
      setStudying(false);
      setDone(true);
    }
  }, [queue, studying]);

  // Keyboard in study mode: Space/Enter flips; when shown, 1 = Nochmal, 2 = Gewusst.
  useEffect(() => {
    if (!studying) return;
    function onKey(e) {
      if (!showBack) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setShowBack(true);
        }
        return;
      }
      if (e.key === '1') grade(false);
      else if (e.key === '2' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        grade(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studying, showBack]);

  const current = queue[0];
  const studyProgress = reviewed / (reviewed + queue.length || 1);

  return (
    <div>
      {/* Header */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center lg:py-24">
        <div data-reveal>
          <h1 className="text-balance font-semibold t-h2 text-ink">Anki-Import.</h1>
          <p className="mx-auto mt-5 t-lead text-ink-soft">
            Deck importieren, im Anki-Stil lernen. Bleibt lokal.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        {/* IMPORT PANEL */}
        <div data-reveal className="surface p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-semibold t-h3 text-ink">Deck importieren</h2>
              <p className="mt-1 max-w-[52ch] text-pretty t-meta text-ink-soft">
                <span className="font-mono t-meta text-ink">{SUPPORTED_HINT}</span>. Ein Kartenpaar pro Zeile, getrennt durch Tab, Semikolon, Komma oder Gedankenstrich.
              </p>
            </div>
            <span className="rounded-full bg-cloud px-3 py-1 font-mono t-label tabular-nums text-ink">
              {deck.length} Karte{deck.length === 1 ? '' : 'n'}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* File + sample */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => fileRef.current && fileRef.current.click()}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-hair bg-cloud px-5 py-8 t-ui font-medium text-ink transition-colors hover:bg-hair/30 disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <svg className="h-5 w-5 animate-spin text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.22-8.56" /></svg>
                    Wird importiert …
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                    Datei auswählen
                  </>
                )}
              </button>
              <input ref={fileRef} type="file" accept=".txt,.csv,.tsv,.md,.markdown,.xlsx,.html,.htm,.json,.apkg,.colpkg,text/plain,text/markdown,text/html,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFile} className="hidden" />
              <button onClick={loadSample} disabled={busy} className="rounded-xl border border-hair bg-card px-5 py-3 t-ui font-medium text-ink transition-colors hover:bg-cloud disabled:opacity-50">
                Beispiel-Deck laden (Spanisch-Basics)
              </button>
            </div>

            {/* Paste */}
            <div className="flex flex-col gap-3">
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={5}
                aria-label="Karten einfügen"
                placeholder={'Hola;Hallo\nGracias;Danke\nCerveza;Bier'}
                className="w-full resize-none rounded-xl border border-hair bg-card px-4 py-3 font-mono t-meta text-ink outline-none placeholder:text-ink-soft/50 focus:border-apple"
              />
              <button
                onClick={importPaste}
                disabled={!paste.trim() || busy}
                className="rounded-xl bg-ink px-5 py-3 t-ui font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Text importieren
              </button>
            </div>
          </div>

          {note && <p className={'mt-5 t-meta ' + (note.kind === 'ok' ? 'text-ok' : 'text-no')}>{note.text}</p>}
        </div>

        {/* DECK + STUDY */}
        <div data-reveal className="mt-8">
          {deck.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-hair px-6 py-16 text-center">
              <p className="t-ui text-ink-soft">Noch keine Karten. Importiere ein Deck oder lade das Beispiel-Deck.</p>
            </div>
          ) : !studying && !done ? (
            <div className="rounded-2xl bg-cloud p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold t-h3 text-ink">Dein Deck</h2>
                  <p className="mt-1 t-meta text-ink-soft">{deck.length} Karten bereit zum Lernen.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {confirmClear ? (
                    <>
                      <button onClick={() => setConfirmClear(false)} className="btn btn-secondary btn-sm">Abbrechen</button>
                      <button onClick={() => { clearDeck(); setConfirmClear(false); }} className="btn btn-sm border border-no/50 bg-no/10 text-ink hover:bg-no/20">Wirklich löschen</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmClear(true)} className="btn btn-secondary btn-sm">Deck leeren</button>
                  )}
                  <button onClick={startStudy} className="btn btn-primary btn-sm">Lernen starten</button>
                </div>
              </div>

              <div className="mt-6 divide-y divide-hair overflow-hidden rounded-xl border border-hair bg-card">
                {deck.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 px-5 py-3 t-ui">
                    <span className="font-medium text-ink">{c.front}</span>
                    <span className="text-right text-ink-soft">{c.back}</span>
                  </div>
                ))}
                {deck.length > 6 && <div className="px-5 py-3 font-mono t-label text-ink-soft">+ {deck.length - 6} weitere …</div>}
              </div>
            </div>
          ) : studying ? (
            <div className="rounded-2xl bg-cloud p-6 sm:p-10">
              <div className="mb-8 flex items-center gap-4">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-hair">
                  <div className="h-full origin-left bg-ink transition-transform duration-300 ease-out" style={{ transform: `scaleX(${studyProgress})` }} />
                </div>
                <span className="font-mono t-label tabular-nums text-ink-soft">{queue.length} übrig</span>
              </div>

              <div className="mx-auto flex min-h-[15rem] max-w-xl flex-col items-center justify-center surface px-6 py-12 text-center">
                <p className="font-mono t-label text-ink-soft">{showBack ? 'Rückseite' : 'Vorderseite'}</p>
                <p key={(current && current.front) + String(showBack)} className="mt-4 font-semibold t-h3 text-ink">
                  {showBack ? current && current.back : current && current.front}
                </p>
              </div>

              <div className="mx-auto mt-6 flex max-w-xl items-center justify-center gap-3">
                {!showBack ? (
                  <button onClick={() => setShowBack(true)} className="btn btn-primary btn-lg px-10">Antwort zeigen</button>
                ) : (
                  <>
                    <button onClick={() => grade(false)} className="btn btn-secondary btn-lg flex-1">Nochmal</button>
                    <button onClick={() => grade(true)} className="btn btn-lg flex-1 border border-ok/50 bg-ok/10 text-ink hover:bg-ok/20">Gewusst</button>
                  </>
                )}
              </div>

              <p className="mt-5 text-center font-mono t-label text-ink-soft">
                {showBack ? '1 = Nochmal · 2 = Gewusst' : 'Leertaste = Antwort zeigen'}
              </p>

              <div className="mt-6 text-center">
                <button onClick={() => { setStudying(false); setDone(false); }} className="t-meta font-medium text-ink-soft transition-colors hover:text-ink">Sitzung beenden</button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-cloud p-8 text-center sm:p-12">
              <p className="font-mono t-label text-ink-soft">Sitzung beendet</p>
              <p className="mt-3 font-semibold t-h1 text-ink tabular-nums">{reviewed}<span className="text-ink-soft/40"> Reviews</span></p>
              <p className="mx-auto mt-5 max-w-sm t-lead text-pretty text-ink-soft">
                {again === 0 ? 'Alles auf Anhieb gewusst.' : `${again}× „Nochmal“ gebraucht.`}
              </p>
              <div className="mt-10 flex items-center justify-center gap-3">
                <button onClick={startStudy} className="btn btn-primary btn-lg">Nochmal lernen</button>
                <button onClick={() => setDone(false)} className="btn btn-secondary btn-lg">Zurück zum Deck</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
