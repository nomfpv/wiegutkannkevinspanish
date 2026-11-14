import { useEffect, useRef, useState } from 'react';
import { useReveal } from '../lib/ui';
import { CLIPS, KATEGORIEN } from '../lib/data';

/* Soundboard.

   Abgespielt wird über die YouTube-IFrame-API, NICHT über eigene Audiodateien.
   Der Ton bleibt damit dort, wo er hingehört: beim Rechteinhaber. Für dich
   ändert sich nichts — Knopf drücken, Ton kommt sofort an der richtigen
   Sekunde und stoppt nach dem Wort. Der Player läuft klein sichtbar mit, das
   verlangen auch die Nutzungsbedingungen und man sieht die Quelle.

   Ein Wort kann mehrfach vorkommen; die weiteren Fundstellen liegen als
   kleine Punkte auf der Kachel. */

const clipsProWort = new Map();
for (const c of CLIPS) {
  if (!clipsProWort.has(c.es)) clipsProWort.set(c.es, []);
  clipsProWort.get(c.es).push(c);
}
const WORT_KAT = new Map();
for (const k of KATEGORIEN) for (const w of k.words) WORT_KAT.set(w.es, k.key);

/* Sortierung innerhalb einer Gruppe.

   Vorher lagen die Kacheln in der Reihenfolge, in der CLIPS gebaut wird — rein
   alphabetisch. Damit landete „Adiós" (1×) vor „Hola" (9×), und ein ganzer Satz
   stand zwischen zwei Einzelwörtern, obwohl er dreimal so breit ist.

   Jetzt zwei Kriterien, in dieser Reihenfolge:
     1. kurz vor lang — Einzelwörter zuerst, ganze Sätze ans Ende der Gruppe.
        Sätze bekommen unten zwei Rasterspalten; stünden sie mittendrin, risse
        das Löcher ins Raster.
     2. oft vor selten — was Kevin am häufigsten sagt, steht oben. Bei gleicher
        Häufigkeit alphabetisch, damit die Reihenfolge stabil bleibt. */
const istSatz = (es) => es.trim().split(/\s+/).length >= 3;
const sortiere = (a, b) =>
  Number(istSatz(a.es)) - Number(istSatz(b.es))
  || b.clips.length - a.clips.length
  || a.es.localeCompare(b.es, 'de');

/* Sekunden → 8:12 bzw. 1:02:10. */
function zeit(s) {
  const g = Math.round(s), h = Math.floor(g / 3600), m = Math.floor((g % 3600) / 60), r = g % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/* Manche Folgen haben Untertitel ohne Marken für einzelne Wörter — dort ist nur
   der Satzblock bekannt, in dem das Wort fällt (`ungefaehr` in data.js). Der
   Clip enthält das Wort trotzdem sicher, er beginnt nur ein paar Wörter früher.
   Die Tilde sagt das, ohne einen Beipackzettel danebenzustellen. */
const zeitLabel = (c, t) => (c.ungefaehr ? `~${zeit(t)}` : zeit(t));

/* Fundstellen nach Folge gruppieren.

   Vorher stand unter „Hola" viermal hintereinander derselbe Knopf „#347" — vier
   verschiedene Stellen derselben Folge, aber mit identischer Beschriftung sieht
   das nach einem Fehler aus, und man kann nicht wählen, welche man hört. Jetzt
   eine Zeile je Folge, darin die Uhrzeit jeder Stelle. Die Nummer steht einmal,
   die Zeiten sind eindeutig. `idx` bleibt der Index im ursprünglichen Clip-Array,
   damit `spiele()` unverändert weiterfunktioniert. */
function nachFolge(clips) {
  const out = [];
  clips
    .map((c, idx) => ({ c, idx }))
    .sort((a, b) => (a.c.folge ?? 0) - (b.c.folge ?? 0) || a.c.start - b.c.start)
    .forEach(({ c, idx }) => {
      const last = out[out.length - 1];
      const stelle = { idx, t: c.start, clip: c, mal: 1 };
      if (!last || last.folge !== c.folge) { out.push({ folge: c.folge, stellen: [stelle] }); return; }

      /* Sagt Kevin ein Wort zweimal im selben Untertitel-Block, kennen wir für
         beide Nennungen nur denselben Block — die Clips sind Zeichen für
         Zeichen gleich. Drei Knöpfe nebeneinander, die exakt dasselbe abspielen,
         sehen aus wie ein Fehler. Also ein Knopf, und die Zahl sagt, wie oft
         das Wort darin fällt. Gezählt wird es weiterhin so oft, wie es fällt. */
      const vor = last.stellen[last.stellen.length - 1];
      if (vor.clip.start === c.start && vor.clip.ende === c.ende) vor.mal += 1;
      else last.stellen.push(stelle);
    });
  return out;
}

const alleWoerter = [...clipsProWort.entries()].map(([es, clips]) => {
  const folgen = nachFolge(clips);
  return {
    es, de: clips[0].de, clips, folgen,
    /* Der große Knopf auf der Kachel spielt DIE Stelle, die auch als erste
       darunter steht. Vorher nahm er clips[0] — das ist die früheste Sekunde
       über alle Folgen hinweg, nicht die erste angezeigte. Bei vier Wörtern
       (u. a. „Amigo", „Una") sprang die Kachel damit in eine andere Folge als
       der Chip daneben, und in der Statusleiste stand eine Nummer, die man
       nirgends angeklickt hatte. */
    ersteIdx: folgen[0].stellen[0].idx,
  };
});

const GRUPPEN = KATEGORIEN.map((k) => ({
  key: k.key,
  label: k.label,
  woerter: alleWoerter.filter((w) => WORT_KAT.get(w.es) === k.key).sort(sortiere),
})).filter((g) => g.woerter.length);

/* Wörter ohne Kategorie-Zuordnung nicht verlieren. */
const zugeordnet = new Set(GRUPPEN.flatMap((g) => g.woerter.map((w) => w.es)));
const rest = alleWoerter.filter((w) => !zugeordnet.has(w.es)).sort(sortiere);
if (rest.length) GRUPPEN.push({ key: 'rest', label: 'Weitere', woerter: rest });

function useYouTube(onStatus) {
  const [bereit, setBereit] = useState(false);
  const player = useRef(null);

  useEffect(() => {
    let abgebrochen = false;
    function erzeugen() {
      if (abgebrochen || player.current) return;
      player.current = new window.YT.Player('yt-soundboard', {
        height: '100%',
        width: '100%',
        /* autoplay + playsinline: der Klick auf einen Knopf IST die
           Nutzerinteraktion, die Browser für Ton verlangen. Ohne das musste man
           erst im Player selbst starten — genau das soll ja wegfallen. */
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, autoplay: 1, controls: 0, disablekb: 1 },
        events: {
          onReady: () => !abgebrochen && setBereit(true),
          onStateChange: (e) => !abgebrochen && onStatus?.(e.data),
        },
      });
    }
    if (window.YT && window.YT.Player) { erzeugen(); return () => { abgebrochen = true; }; }

    const vorher = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (typeof vorher === 'function') vorher(); erzeugen(); };
    if (!document.getElementById('yt-api')) {
      const s = document.createElement('script');
      s.id = 'yt-api';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
    return () => { abgebrochen = true; };
  }, []);

  return { bereit, player };
}

export default function Soundboard() {
  useReveal();
  const [laeuft, setLaeuft] = useState(false);
  const [blockiert, setBlockiert] = useState(false);
  const { bereit, player } = useYouTube((state) => {
    // 1 = spielt, 3 = puffert
    const an = state === 1 || state === 3;
    setLaeuft(an);
    if (an) setBlockiert(false);
  });
  const [aktiv, setAktiv] = useState(null);   // { es, idx }
  const stopper = useRef(null);
  const pruefer = useRef(null);

  useEffect(() => () => { clearTimeout(stopper.current); clearTimeout(pruefer.current); }, []);

  function spiele(wort, idx) {
    const clip = clipsProWort.get(wort)[idx];
    if (!player.current || !bereit) return;
    clearTimeout(stopper.current);
    clearTimeout(pruefer.current);
    setAktiv({ es: wort, idx });

    player.current.loadVideoById({
      videoId: clip.video,
      startSeconds: clip.start,
      endSeconds: clip.ende,
    });
    /* Manche Browser starten trotz Klick nicht von allein — deshalb noch einmal
       ausdrücklich anstoßen und Ton sicherstellen. */
    try { player.current.unMute(); player.current.setVolume(100); player.current.playVideo(); } catch { /* egal */ }

    /* Wenn nach 1,5 s nichts läuft, blockiert der Browser die Wiedergabe.
       Dann sagen wir das, statt den Nutzer im Unklaren zu lassen. */
    pruefer.current = setTimeout(() => {
      try { if (player.current.getPlayerState() !== 1) setBlockiert(true); } catch { /* egal */ }
    }, 1500);

    // endSeconds greift nicht zuverlässig, wenn schnell umgeschaltet wird.
    stopper.current = setTimeout(() => {
      try { player.current.pauseVideo(); } catch { /* egal */ }
      setAktiv(null);
    }, (clip.ende - clip.start) * 1000 + 400);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
      <div data-reveal className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <h1 className="text-balance font-semibold t-h2 text-ink">Soundboard</h1>
        <p className="font-mono t-label text-ink-soft">{CLIPS.length} Aufnahmen · {clipsProWort.size} Wörter</p>
      </div>
      <p data-reveal className="mt-3 max-w-[60ch] t-ui text-ink-soft">
        ~ = die Untertitel kennen nur den Satz, nicht die Sekunde. Der Clip beginnt früher.
      </p>

      {/* Statusleiste. Der Player ist auf Briefmarkengröße geschrumpft und ohne
          Bedienelemente — man klickt ihn nicht an, er zeigt nur die Quelle.
          Ganz ausblenden geht nicht, das verbieten YouTubes Bedingungen. */}
      <div data-reveal className="sticky top-14 z-30 mt-8 flex items-center gap-4 surface p-3 backdrop-blur">
        <div className="aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-cloud sm:w-56">
          <div id="yt-soundboard" className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate t-ui font-medium text-ink">
            {aktiv ? aktiv.es : (bereit ? 'Wort antippen' : 'lädt…')}
          </p>
          <p className="font-mono t-label text-ink-soft">
            {blockiert
              ? 'Browser blockiert den Ton — bitte noch einmal tippen'
              : aktiv
                /* Folge UND Zeit — so sieht man schwarz auf weiß, dass wirklich
                   die Stelle läuft, die man angeklickt hat. */
                ? <>Folge #{clipsProWort.get(aktiv.es)[aktiv.idx].folge}
                  {' · '}{zeitLabel(clipsProWort.get(aktiv.es)[aktiv.idx], clipsProWort.get(aktiv.es)[aktiv.idx].start)}
                  {laeuft ? ' · läuft' : ''}</>
                : ''}
          </p>
        </div>
        {laeuft && (
          <span className="flex shrink-0 items-end gap-0.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1 rounded-full bg-apple"
                style={{ height: [10, 16, 7][i], animation: `pulseBar .7s ${i * 0.12}s ease-in-out infinite alternate` }} />
            ))}
          </span>
        )}
      </div>

      {GRUPPEN.map((g) => (
        <section key={g.key} data-reveal className="mt-10">
          <h2 className="flex items-baseline gap-2.5 t-meta font-semibold uppercase tracking-wide text-ink-soft">
            {g.label}
            <span className="font-mono t-label font-normal normal-case">{g.woerter.length}</span>
          </h2>
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5">
            {g.woerter.map((w) => {
              const spieltGerade = aktiv && aktiv.es === w.es;
              return (
                <div
                  key={w.es}
                  /* Ganze Sätze über zwei Rasterspalten: In einer 190px-Spalte
                     wurden sie abgeschnitten, und ein abgeschnittener Satz ist
                     genau das Gegenteil von dem, was ein Soundboard zeigen soll. */
                  className={'group rounded-xl border p-3 text-left transition-colors '
                    + (istSatz(w.es) ? 'sm:col-span-2 ' : '')
                    + (spieltGerade ? 'border-apple bg-apple/10' : 'border-hair bg-card hover:border-ink-soft/40')}
                >
                  <button
                    type="button"
                    onClick={() => spiele(w.es, w.ersteIdx)}
                    disabled={!bereit}
                    className="flex w-full items-baseline gap-2 text-left disabled:opacity-50"
                    aria-label={`„${w.es}" abspielen`}
                  >
                    <span lang="es" className="min-w-0 flex-1 text-pretty t-ui font-medium leading-snug text-ink">{w.es}</span>
                    <svg className={'h-3.5 w-3.5 shrink-0 ' + (spieltGerade ? 'text-apple' : 'text-ink-soft group-hover:text-ink')}
                      viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  </button>
                  <p className="mt-0.5 t-meta leading-snug text-ink-soft">{w.de}</p>

                  <dl className="mt-2 space-y-1">
                    {w.folgen.map((f) => (
                      <div key={f.folge} className="flex items-center gap-1.5">
                        <dt className="w-10 shrink-0 font-mono t-label tabular-nums text-ink-soft">#{f.folge}</dt>
                        <dd className="flex min-w-0 flex-wrap items-center gap-1">
                          {f.stellen.map((s) => (
                            <button
                              key={s.idx}
                              type="button"
                              onClick={() => spiele(w.es, s.idx)}
                              disabled={!bereit}
                              aria-label={`„${w.es}" aus Folge ${f.folge} bei ${s.clip.ungefaehr ? 'ungefähr ' : ''}${zeit(s.t)} abspielen`
                                + (s.mal > 1 ? ` — fällt ${s.mal}× in dieser Stelle` : '')}
                              className={'h-5 rounded px-1.5 font-mono t-label tabular-nums transition-colors disabled:opacity-50 '
                                + (spieltGerade && aktiv.idx === s.idx
                                  ? 'bg-apple text-bg'
                                  : 'bg-cloud text-ink-soft hover:bg-hair hover:text-ink')}
                            >
                              {zeitLabel(s.clip, s.t)}{s.mal > 1 ? ` ×${s.mal}` : ''}
                            </button>
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p data-reveal className="mt-12 border-t border-hair pt-5 t-meta text-ink-soft">
        Quelle: Originalfolgen im YouTube-Player. Keine Audiodateien gespeichert.
      </p>
    </div>
  );
}
