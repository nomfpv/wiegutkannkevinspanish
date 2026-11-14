import { useState, useEffect, useRef } from 'react';
import { REAL_WORDS, CLIPS, WORD_BY_ES } from './data';
import { eierAn, setEierAn, modus, setModus, abonniere } from './eier';

/* ═══════════════════════════════════════════════════════════════════════════
   Eastereggs — die seitenweiten Sachen. (Der Dateiname bleibt Ostereier.jsx:
   auf Windows kollidiert er sonst case-insensitiv mit ./eier.)

   Hier liegt nur noch, was sich nicht in einen einzelnen Abschnitt sperren
   lässt: die beiden Betriebsarten (Übersetzer, funk-Prüfung), der Papagei und
   der Originalton. Alles andere sind echte Seitenabschnitte, siehe
   EierAbschnitte.jsx.

   Die frühere „Regieleiste" am unteren Rand ist weg. Sie war der Grund, warum
   sich die Einblendungen aufgeklebt anfühlten: ein zweites Bedienfeld, das mit
   der Seite nichts zu tun hatte. Die beiden Schalter stehen jetzt neben dem
   Regler im Fußbereich, wo sie hingehören.

   Inhaltsregel unverändert: nichts erfunden. Jeder Witz hängt an den Daten
   dieses Projekts oder an einer belegten Tatsache.
   ═══════════════════════════════════════════════════════════════════════════ */

function useEier() {
  const [, neu] = useState(0);
  useEffect(() => abonniere(() => neu((n) => n + 1)), []);
  return { an: eierAn(), uebersetzer: modus('uebersetzer'), zensur: modus('zensur') };
}

/* ── Der Übersetzer ─────────────────────────────────────────────────────────
   Kevins Sprache ist so voller Anglizismen, dass Pro7 ihm für einen Auftritt
   im Scherz einen Übersetzer hingesetzt hat. Dieselbe Idee, umgedreht: Der
   Übersetzer läuft über DIESE Seite und übersetzt das trockene Amtsdeutsch in
   Papaplatte. Ersetzt wird im Textknoten; das Original steht in einer Map und
   kommt beim Ausschalten zurück. */
const DENGLISCH = [
  [/Wörter Spanisch\./g, 'Words Spanish auf Lock.'],
  [/\bWortschatz\b/g, 'Vocab'],
  [/\bWörter\b/g, 'Words'],
  [/\bWort\b/g, 'Word'],
  [/\bFolgen\b/g, 'Episodes'],
  [/\bFolge\b/g, 'Episode'],
  [/\bNennungen\b/g, 'Mentions'],
  [/\bAufnahmen\b/g, 'Clips'],
  [/\bStunden\b/g, 'Hours'],
  [/\bMaterial\b/g, 'Footage'],
  [/\bÜbersicht\b/g, 'Overview'],
  [/\bSpanisch\b/g, 'Spanish'],
  [/\bkann\b/g, 'hat so'],
  [/\bansehen\b/g, 'checken'],
  [/\bgezählt\b/g, 'getrackt'],
  [/\bgemessen\b/g, 'getrackt'],
  [/\bmitgezählt\b/g, 'mitgetrackt'],
  [/\bsagt\b/g, 'droppt'],
  [/\bStand\b/g, 'Update'],
  [/\bLehnwörter\b/g, 'Loanwords'],
  [/\bwirklich\b/g, 'actually'],
  [/\bAm häufigsten\b/g, 'Most spammed'],
  [/\bHochrechnung\b/g, 'Forecast'],
  [/\bGanze Sätze\b/g, 'Full Sentences'],
  [/\bIm Wortlaut\b/g, 'Original Sound'],
  [/\bAlle\b/g, 'All the'],
  [/\bsehr\b/g, 'mega'],
];

function uebersetzen(anwenden, speicher) {
  const wurzel = document.querySelector('main');
  if (!wurzel) return;

  if (!anwenden) {
    speicher.forEach((text, knoten) => { knoten.nodeValue = text; });
    speicher.clear();
    return;
  }

  const lauf = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  let k;
  while ((k = lauf.nextNode())) {
    if (speicher.has(k)) continue;
    const alt = k.nodeValue;
    if (!alt || !alt.trim()) continue;
    let neu = alt;
    for (const [muster, ersatz] of DENGLISCH) neu = neu.replace(muster, ersatz);
    if (neu !== alt) {
      speicher.set(k, alt);
      k.nodeValue = neu;
    }
  }
}

/* ── „10 Minuten kein Englisch" ─────────────────────────────────────────────
   Ein echtes Challenge-Format von ihm. Die Uhr zählt, wie lange auf dem
   Bildschirm kein englisches Wort steht, und kommt nie über null, weil im Menü
   „Soundboard" steht. Der Witz stellt sich von selbst her. */
const ANGLIZISMEN = ['Soundboard', 'Update', 'Podcast', 'Vocab', 'Words', 'Episodes', 'Footage', 'Overview', 'Forecast', 'Mentions', 'Clips', 'Loanwords', 'Original Sound', 'Lock', 'Level', 'Import', 'Test'];

function EnglischUhr() {
  const [stand, setStand] = useState(0);
  const [schuld, setSchuld] = useState(null);

  useEffect(() => {
    const t = setInterval(() => {
      const text = document.body.innerText || '';
      const treffer = ANGLIZISMEN.find((w) => text.includes(w));
      if (treffer) { setStand(0); setSchuld(treffer); }
      else { setSchuld(null); setStand((s) => s + 1); }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(stand / 60)).padStart(2, '0');
  const ss = String(stand % 60).padStart(2, '0');
  const erklaerung = 'Sein eigenes Challenge-Format, angewendet auf diese Seite. '
    + 'Die Uhr springt auf null, sobald ein englisches Wort auf dem Bildschirm steht.';

  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap font-mono t-label text-ink-soft" title={erklaerung}>
      <span className="tabular-nums text-ink">{mm}:{ss}</span>
      {schuld ? <span className="text-no">„{schuld}“</span> : <span>kein Englisch</span>}
    </span>
  );
}

/* ── funk-Prüfung ───────────────────────────────────────────────────────────
   Der Edeltalk läuft seit Dezember 2024 bei funk, und eine der ausgewerteten
   Folgen heißt „funk hat uns diesen Titel verboten". Der Balken misst ein
   echtes Wort per Range aus, statt irgendwo im Absatz zu landen. */
function zufallsWort() {
  const traeger = [...document.querySelectorAll('main p, main h1, main h2, main li, main dt, main dd, main summary, main blockquote')]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 50 && r.top > 70 && r.bottom < window.innerHeight - 40;
    });
  if (!traeger.length) return null;

  for (let versuch = 0; versuch < 12; versuch++) {
    const el = traeger[Math.floor(Math.random() * traeger.length)];
    const knoten = [...el.childNodes].filter((n) => n.nodeType === 3 && n.nodeValue.trim().length > 5);
    if (!knoten.length) continue;
    const k = knoten[Math.floor(Math.random() * knoten.length)];
    const worte = [...k.nodeValue.matchAll(/\S{4,}/g)];
    if (!worte.length) continue;
    const w = worte[Math.floor(Math.random() * worte.length)];

    const bereich = document.createRange();
    bereich.setStart(k, w.index);
    bereich.setEnd(k, w.index + w[0].length);
    const r = bereich.getBoundingClientRect();
    if (r.width < 20 || r.height < 8) continue;
    return { top: r.top - 3, left: r.left - 4, breite: r.width + 8, hoehe: r.height + 6 };
  }
  return null;
}

function Zensur() {
  const [balken, setBalken] = useState([]);
  useEffect(() => {
    function setzen() {
      const neu = [];
      for (let i = 0; i < 3; i++) {
        const b = zufallsWort();
        if (b) neu.push(b);
      }
      setBalken(neu);
    }
    setzen();
    const t = setInterval(setzen, 3800);
    /* Beim Scrollen sofort weg. Ein Balken, der neben dem Wort klebt, ist
       schlimmer als gar keiner. */
    const weg = () => setBalken([]);
    window.addEventListener('scroll', weg, { passive: true });
    return () => { clearInterval(t); window.removeEventListener('scroll', weg); };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[56]" aria-hidden="true">
      {balken.map((b, i) => (
        <span key={`${b.top}-${b.left}-${i}`} className="ei-zensur absolute flex items-center justify-end rounded-[2px] bg-ink pr-1"
          style={{ top: b.top, left: b.left, width: b.breite, height: b.hoehe }}>
          <span className="font-mono text-[8px] uppercase tracking-widest text-bg/60">funk</span>
        </span>
      ))}
    </div>
  );
}

/* ── Der Papagei ────────────────────────────────────────────────────────────
   Papaplatte, Papagei. Ein Vogel, der Wörter nachspricht, ohne eines davon zu
   verstehen. Klickt man ein spanisches Wort an, spricht er es nach und spielt,
   wenn es eine Aufnahme gibt, die echte Sekunde aus der echten Folge. */
function PapageiBild({ spricht }) {
  return (
    <svg viewBox="0 0 64 64" className={'h-full w-full ' + (spricht ? 'ei-wippe' : '')} aria-hidden="true">
      <path d="M30 26c9 0 15 7 15 15 0 8-6 15-15 15s-15-6-15-14c0-9 6-16 15-16z" fill="currentColor" opacity=".85" />
      <path d="M44 40c6 3 12 10 16 21-9-2-15-8-18-14z" fill="currentColor" opacity=".5" />
      <circle cx="31" cy="20" r="13" fill="currentColor" />
      <path d="M18 19c-6 1-9 3-9 5s3 4 9 5z" fill="rgb(var(--ink-soft))" />
      <circle cx="30" cy="17" r="3.4" fill="rgb(var(--card))" />
      <circle cx="29" cy="17" r="1.6" fill="rgb(var(--ink))" />
    </svg>
  );
}

function ytLaden() {
  return new Promise((fertig) => {
    if (window.YT && window.YT.Player) return fertig();
    const vorher = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (typeof vorher === 'function') vorher(); fertig(); };
    if (!document.getElementById('yt-api')) {
      const s = document.createElement('script');
      s.id = 'yt-api';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  });
}

function Originalton({ clip, onEnde }) {
  const player = useRef(null);
  useEffect(() => {
    let tot = false, stopper;
    ytLaden().then(() => {
      if (tot) return;
      player.current = new window.YT.Player('yt-ei', {
        height: '100%', width: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, autoplay: 1, controls: 0, disablekb: 1 },
        events: {
          onReady: (e) => {
            e.target.loadVideoById({ videoId: clip.video, startSeconds: clip.start, endSeconds: clip.ende });
            try { e.target.unMute(); e.target.setVolume(100); e.target.playVideo(); } catch { /* egal */ }
            stopper = setTimeout(onEnde, (clip.ende - clip.start) * 1000 + 1800);
          },
        },
      });
    });
    return () => {
      tot = true; clearTimeout(stopper);
      try { player.current && player.current.destroy(); } catch { /* egal */ }
    };
  }, [clip]);

  return (
    <div className="surface ei-in fixed bottom-5 right-5 z-[60] flex w-[min(19rem,calc(100vw-2.5rem))] items-center gap-3 p-3">
      <div className="aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-cloud">
        <div id="yt-ei" className="h-full w-full" />
      </div>
      <div className="min-w-0">
        <p lang="es" className="t-ui font-semibold text-ink">{clip.es}</p>
        <p className="font-mono t-label text-ink-soft">Folge #{clip.folge} · Originalton</p>
      </div>
    </div>
  );
}

/* ── Die Ebene ──────────────────────────────────────────────────────────── */

const ALLE_CLIPS = new Map();
for (const c of CLIPS) if (!ALLE_CLIPS.has(c.es)) ALLE_CLIPS.set(c.es, c);

function Ebene({ uebersetzer, zensur }) {
  const [blase, setBlase] = useState(null);
  const [ton, setTon] = useState(null);
  const speicher = useRef(new Map());
  const blasenZeit = useRef(null);

  useEffect(() => {
    uebersetzen(uebersetzer, speicher.current);
    if (!uebersetzer) return undefined;
    const nach = () => setTimeout(() => uebersetzen(true, speicher.current), 60);
    window.addEventListener('hashchange', nach);
    return () => {
      window.removeEventListener('hashchange', nach);
      uebersetzen(false, speicher.current);
    };
  }, [uebersetzer]);

  function nachsprechen(w, mitTon = true) {
    if (!w) return;
    setBlase({ es: w.es, de: w.de || null, count: w.count || null });
    /* Ton nur nach echtem Klick. Ungefragt losplärrende Tonspur ist das, was
       Werbebanner machen. */
    const clip = ALLE_CLIPS.get(w.es);
    if (mitTon && clip && !ton) setTon(clip);
    clearTimeout(blasenZeit.current);
    blasenZeit.current = setTimeout(() => setBlase(null), 5200);
  }

  useEffect(() => {
    function aufKlick(e) {
      const el = e.target.closest('[lang="es"]');
      if (!el) return;
      const es = (el.textContent || '').trim();
      if (!es || es.length > 44) return;
      nachsprechen(WORD_BY_ES[es] || { es });
    }
    document.addEventListener('click', aufKlick);
    return () => document.removeEventListener('click', aufKlick);
  });

  /* Alle paar Sekunden redet er ungefragt. Ein Vogel, der nur reagiert, wenn
     man ihn anstößt, wirkt tot. */
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return;
      nachsprechen(REAL_WORDS[Math.floor(Math.random() * REAL_WORDS.length)], false);
    }, 21000);
    return () => clearInterval(t);
  });

  useEffect(() => () => clearTimeout(blasenZeit.current), []);

  return (
    <>
      {zensur && <Zensur />}
      {ton && <Originalton clip={ton} onEnde={() => setTon(null)} />}

      <div className="pointer-events-none fixed right-4 top-1/2 z-[57] flex -translate-y-1/2 items-center gap-2">
        {blase && (
          <div className="ei-in surface max-w-[15rem] p-3 text-right">
            <p lang="es" className="t-ui font-semibold text-ink">{blase.es}</p>
            {blase.de && <p className="t-meta text-ink-soft">{blase.de}</p>}
            <p className="mt-1 font-mono t-label text-ink-soft">
              {blase.count ? `Kevin: ${blase.count}×` : 'kennt Kevin nicht'}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => nachsprechen(REAL_WORDS[Math.floor(Math.random() * REAL_WORDS.length)])}
          title="Spricht nach, ohne zu verstehen. Antippen oder ein spanisches Wort auf der Seite anklicken."
          className="pointer-events-auto h-14 w-14 text-apple transition-transform hover:scale-110"
        >
          <PapageiBild spricht={!!blase} />
        </button>
      </div>
    </>
  );
}

export function EierEbene() {
  const { an, uebersetzer, zensur } = useEier();
  return an ? <Ebene uebersetzer={uebersetzer} zensur={zensur} /> : null;
}

/* ── Der versteckte Auslöser ───────────────────────────────────────────────
   Vorher stand hier ein beschrifteter Regler im Fußbereich. Der verriet sofort,
   dass es überhaupt etwas zu holen gibt — genau das soll er nicht. Jetzt ist
   der Auslöser der PUNKT in der Wortmarke „kevin.es": ein 1em kleiner Knopf,
   der aussieht wie Satzzeichen, ohne Zeigefinger-Cursor und ohne Tooltip.
   Wer ihn findet, hat ihn gesucht.

   Bedienbar bleibt er trotzdem: als echter <button> mit aria-label liegt er in
   der Tab-Reihenfolge und Screenreader nennen ihn beim Namen. Verstecken heißt
   hier „nicht beworben", nicht „unerreichbar". */
export function EierPunkt() {
  const { an } = useEier();
  return (
    <button
      type="button"
      onClick={() => setEierAn(!an)}
      aria-label={an ? 'Eastereggs ausschalten' : 'Eastereggs einschalten'}
      aria-pressed={an}
      className={'cursor-default appearance-none bg-transparent p-0 leading-none transition-colors '
        + (an ? 'text-apple' : 'text-ink-soft')}
    >
      .
    </button>
  );
}

/* ── Die Regie ─────────────────────────────────────────────────────────────
   Erscheint erst, WENN die Eastereggs an sind: die beiden Betriebsarten, die
   Uhr und der Ausgang. Solange sie aus sind, steht hier nichts — der Fußbereich
   sieht aus wie der eines gewöhnlichen Statistikberichts. */
export function EierSchalter() {
  const { an, uebersetzer, zensur } = useEier();
  if (!an) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      <span className="font-mono t-label text-ink-soft">Eastereggs</span>
      <span className="hidden h-4 w-px bg-hair sm:block" aria-hidden="true" />
      <button onClick={() => setModus('uebersetzer', !uebersetzer)} aria-pressed={uebersetzer}
        title="Pro7 hat ihm für einen Auftritt im Scherz einen Übersetzer hingesetzt."
        className={'rounded-md px-2 py-1 font-mono t-label transition-colors ' + (uebersetzer ? 'bg-apple text-bg' : 'bg-cloud text-ink-soft hover:text-ink')}>
        Übersetzer
      </button>
      <button onClick={() => setModus('zensur', !zensur)} aria-pressed={zensur}
        title="Eine der ausgewerteten Folgen heißt „funk hat uns diesen Titel verboten“."
        className={'rounded-md px-2 py-1 font-mono t-label transition-colors ' + (zensur ? 'bg-apple text-bg' : 'bg-cloud text-ink-soft hover:text-ink')}>
        funk-Prüfung
      </button>
      <EnglischUhr />
      <button onClick={() => setEierAn(false)}
        className="rounded-md px-2 py-1 font-mono t-label text-ink-soft transition-colors hover:text-ink">
        aus
      </button>
    </div>
  );
}
