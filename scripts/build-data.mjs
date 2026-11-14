#!/usr/bin/env node
/* Automatischer Daten-Builder für kevin.es
   ----------------------------------------
   Holt die 90 neuesten Edeltalk-Folgen, zieht die deutsche Original-
   Transkription (Auto-Untertitel), erkennt darin Spanisch und schreibt
   src/lib/data.js.

   Zwei Ebenen (siehe scripts/lib/spanish.mjs):
     tier 'real'     = echtes Spanisch (Begrüßungen, Ausdrücke, Vokabeln,
                       Zahlen) → zählt als „Spanischkenntnis".
     tier 'lehnwort' = spanischstämmiges Essen (Burrito, Tapas…), im Deutschen
                       Alltagswort → separat, zählt NICHT.

   Reihenfolge: CHRONOLOGISCH (Folge 1 = älteste). Nur so ist der Fortschritt
   eine echte Lernkurve.

   Optionen:
     --limit N     Anzahl Folgen (Default 90)
     --no-cache    Untertitel nicht aus dem lokalen Cache lesen/schreiben
     --dry         Nur analysieren, data.js NICHT schreiben
*/

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  fetchPlaylist, fetchSubs, toPlainText, countSpanish, deFor, tierFor, katFor, KATEGORIEN,
  epNum, cleanTitle, clipFenster,
} from './lib/spanish.mjs';

const CHANNEL_URL = 'https://www.youtube.com/@edeltalkpodcast/videos';
const OUTPUT_DIR = join(process.cwd(), 'src', 'lib');
const DATA_FILE = join(OUTPUT_DIR, 'data.js');
const CACHE_DIR = join(tmpdir(), 'kevin-es-cache');
/* Handgeprüfte Treffer aus Kevins YouTube-Kanälen (scripts/scan-channels.mjs).
   Nur `verdict: "kevin"` zählt — siehe Kopf von scan-channels.mjs. */
const CHANNEL_HITS_FILE = join(process.cwd(), 'scripts', 'data', 'channel-hits.json');
/* Sprecher-Prüfung der Podcast-Treffer (scripts/scan-podcast.mjs). Der Edeltalk
   hat zwei Sprecher; ohne diese Datei würde Dominiks Spanisch als Kevins zählen. */
const PODCAST_HITS_FILE = join(process.cwd(), 'scripts', 'data', 'podcast-hits.json');

/* videoId → Map(kanonischesWort → Anzahl), nur verdict "kevin"/"auto"/"unsicher", nur tier 'real'.
   "auto" zählt wie "kevin" (automatisch zugeordnet), landet aber nicht im Soundboard. */
function loadKevinOnly() {
  if (!existsSync(PODCAST_HITS_FILE)) return null;
  try {
    const d = JSON.parse(readFileSync(PODCAST_HITS_FILE, 'utf8'));
    const byVideo = new Map();
    /* Wörter, die AUSSCHLIESSLICH auf unsicheren Treffern beruhen, werden auf
       der Seite gekennzeichnet — sie zählen mit, sind aber nicht belegt. */
    const sicher = new Set(), unsicherWort = new Set();
    let kevin = 0, auto = 0, unsicher = 0, andere = 0;
    for (const h of d.hits || []) {
      if (h.tier !== 'real') continue;
      if (h.verdict === 'kevin' || h.verdict === 'auto' || h.verdict === 'unsicher') {
        if (h.verdict === 'kevin') { kevin += 1; sicher.add(h.es); }
        else if (h.verdict === 'auto') { auto += 1; sicher.add(h.es); }
        else { unsicher += 1; unsicherWort.add(h.es); }
        if (!byVideo.has(h.videoId)) byVideo.set(h.videoId, new Map());
        const m = byVideo.get(h.videoId);
        m.set(h.es, (m.get(h.es) || 0) + 1);
      } else andere += 1;
    }
    for (const w of sicher) unsicherWort.delete(w);
    console.log(`🎙  Sprecher-Prüfung Podcast: ${kevin} belegt Kevin, ${auto} automatisch Kevin (ohne Soundboard), ${unsicher} unsicher (zählen mit), `
      + `${andere} verworfen (wörtlich Dominik oder Eigenname).\n`);
    byVideo.nurUnsicher = unsicherWort;
    return byVideo;
  } catch (err) {
    console.log(`⚠ podcast-hits.json nicht lesbar (${err.message}) — zähle ungefiltert.\n`);
    return null;
  }
}
const KEVIN_ONLY = loadKevinOnly();

/* Clips fürs Soundboard: jeder zählende Treffer mit Video-ID und Sekunde —
   außer verdict "auto": die sind nicht nachgehört und bleiben draußen.
   Die Sekunden stehen schon in podcast-hits.json — sie wurden bisher nur nie
   ausgeliefert. Etwas Vorlauf, weil der Zeitstempel den Cue-Beginn markiert. */
function loadClips() {
  if (!existsSync(PODCAST_HITS_FILE)) return [];
  try {
    const d = JSON.parse(readFileSync(PODCAST_HITS_FILE, 'utf8'));
    const titel = new Map((d.folgen || []).map((f) => [f.id, f.title]));
    return (d.hits || [])
      .filter((h) => h.tier === 'real' && (h.verdict === 'kevin' || h.verdict === 'unsicher'))
      .map((h) => {
        /* Fenster inklusive Vor-/Nachlauf — die Regel steht in lib/spanish.mjs,
           damit scripts/audit-clips.mjs exakt dasselbe prüft. */
        const { start, ende, eng } = clipFenster(h);
        return {
          es: h.es,
          de: h.de,
          video: h.videoId,
          start: Math.round(start * 10) / 10,
          ende: Math.round(ende * 10) / 10,
          folge: epNum(titel.get(h.videoId) || ''),
          unsicher: h.verdict === 'unsicher' || undefined,
          /* Aus einem Untertitel-Block geschätzte Zeit statt wortgenauer Marke. */
          ...(eng ? {} : { ungefaehr: true }),
        };
      })
      .sort((a, b) => a.es.localeCompare(b.es, 'de') || a.start - b.start);
  } catch { return []; }
}
const CLIPS = loadClips();

const args = process.argv.slice(2);
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) || 90 : 90;
const USE_CACHE = !args.includes('--no-cache');
const DRY = args.includes('--dry');

if (USE_CACHE) { try { mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* egal */ } }

/* ---------- Helfer ---------- */
function fmtDate(yyyymmdd) {
  if (!yyyymmdd || !/^\d{8}$/.test(yyyymmdd)) return null;
  const y = yyyymmdd.slice(0, 4), m = +yyyymmdd.slice(4, 6), d = +yyyymmdd.slice(6, 8);
  return `${d}.${m}.${y}`;
}
function fmtDur(sec) {
  if (!sec || sec <= 0) return '??:??';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
/* epNum + cleanTitle liegen jetzt in lib/spanish.mjs — sie kennen dort auch die
   alten Titelformate („… - Edeltalk #295", „… - EDELTALK 242"). */

/* ---------- 1) Videoliste ---------- */
console.log(`🎬 Analysiere die ${LIMIT} neuesten Edeltalk-Folgen…\n`);
const videos = fetchPlaylist(CHANNEL_URL, LIMIT).slice(0, LIMIT);
console.log(`✓ ${videos.length} Videos gefunden.\n`);

/* ---------- 2) Pro Video: Untertitel holen + Spanisch zählen ---------- */
const episodes = []; // { id, title, uploadDate, duration, counts: Map }

for (let i = 0; i < videos.length; i++) {
  const v = videos[i];
  console.log(`[${i + 1}/${videos.length}] ${v.title}`);

  let vtt = '';
  let uploadDate = null;
  let duration = v.duration;
  const cacheFile = join(CACHE_DIR, `${v.id}.vtt`);
  const metaFile = join(CACHE_DIR, `${v.id}.json`);

  if (USE_CACHE && existsSync(cacheFile)) {
    vtt = readFileSync(cacheFile, 'utf8');
    if (existsSync(metaFile)) {
      try {
        const m = JSON.parse(readFileSync(metaFile, 'utf8'));
        uploadDate = m.uploadDate ?? null;
        duration = m.duration ?? duration;
      } catch { /* egal */ }
    }
    console.log(`  → aus Cache (${vtt.length} Zeichen)`);
  } else {
    const res = fetchSubs(v.url);
    vtt = res.text;
    uploadDate = res.uploadDate;
    if (res.duration) duration = res.duration;
    if (!res.ok) {
      console.log('  ⚠ Keine deutschen Untertitel gefunden');
    } else {
      console.log(`  → Untertitel erhalten (${vtt.length} Zeichen)`);
      if (USE_CACHE) {
        try {
          writeFileSync(cacheFile, vtt, 'utf8');
          writeFileSync(metaFile, JSON.stringify({ uploadDate, duration }), 'utf8');
        } catch { /* egal */ }
      }
    }
  }

  let counts = vtt && vtt.trim().length > 10 ? countSpanish(toPlainText(vtt)) : new Map();

  /* Echtes Spanisch nur zählen, wenn die Sprecher-Prüfung es Kevin zuordnet.
     Lehnwörter bleiben ungefiltert — sie zählen ohnehin nicht als Sprach-
     kenntnis, deshalb wurde für sie keine Sprecher-Prüfung gemacht. */
  if (KEVIN_ONLY) {
    const kevin = KEVIN_ONLY.get(v.id) || new Map();
    const gefiltert = new Map();
    for (const [word, n] of counts) {
      if (tierFor(word) !== 'real') gefiltert.set(word, n);
      else if (kevin.has(word)) gefiltert.set(word, kevin.get(word));
    }
    counts = gefiltert;
  }
  if (counts.size) {
    const real = [...counts.entries()].filter(([w]) => tierFor(w) === 'real');
    const loan = [...counts.entries()].filter(([w]) => tierFor(w) === 'lehnwort');
    console.log(`  ✓ echt: ${real.map(([w, c]) => `${w}×${c}`).join(', ') || '–'}`
      + `${loan.length ? ` | Lehnwörter: ${loan.map(([w, c]) => `${w}×${c}`).join(', ')}` : ''}`);
  } else {
    console.log('  ✓ kein Spanisch');
  }

  episodes.push({ id: v.id, title: v.title, uploadDate, duration, counts });
}

/* ---------- 3) Chronologisch sortieren (älteste zuerst) ---------- */
const haveDates = episodes.every((e) => e.uploadDate);
if (haveDates) episodes.sort((a, b) => a.uploadDate.localeCompare(b.uploadDate));
else episodes.reverse();

/* ---------- 4) Aggregation ---------- */
const allWords = new Map(); // canonEs -> { es, de, folge, count, tier }
const FOLGEN = [];
let cumulativeReal = 0;

episodes.forEach((ep, idx) => {
  const folge = idx + 1;             // chronologischer Index (1..N) — für Reihenfolge/Chart
  /* Echte Folgennummer aus dem Titel, sonst NULL — nicht der Index als Ersatz.
     Die frühe Ära (2022 bis Mitte 2023) trägt gar keine Nummer im Titel; ein
     Rückfall auf den Index würde dort „#1" bis „#109" erfinden und mit den
     echten Nummern #296 bis #415 kollidieren. Die Anzeige nimmt bei null das
     Datum als Kennung. */
  const nr = epNum(ep.title);
  const newReal = [];
  const newLoan = [];

  // stabile Reihenfolge innerhalb der Folge: nach Häufigkeit
  const entries = [...ep.counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [es, c] of entries) {
    const tier = tierFor(es);
    if (!allWords.has(es)) {
      // `folge` = echte Folgennummer (steht im Titel), fürs Anzeigen
      allWords.set(es, {
        es, de: deFor(es) || es, folge: nr, count: c, tier, kat: katFor(es),
        ...(KEVIN_ONLY?.nurUnsicher?.has(es) ? { unsicher: true } : {}),
      });
      if (tier === 'real') { newReal.push(es); cumulativeReal += 1; }
      else newLoan.push(es);
    } else {
      allWords.get(es).count += c;
    }
  }

  FOLGEN.push({
    n: folge,                         // chronologischer Index (React-Key, Chart-x)
    ep: nr,                           // echte Folgennummer (Anzeige)
    title: cleanTitle(ep.title),      // Titel ohne die „(#345)"-Nummer
    date: fmtDate(ep.uploadDate) || '—',
    dur: fmtDur(ep.duration),
    words: newReal,   // neue ECHTE Spanisch-Wörter (treiben den Fortschritt)
    loan: newLoan,    // neue Lehnwörter (nur Info)
    cumulative: cumulativeReal,
  });
});

/* ---------- 4b) Kanal-Treffer dazunehmen (nur handgeprüft „kevin") ----------
   Untertitel kennen keine Sprecher; auf den Kanälen reden Masha, Freunde und
   Kellner mit. Deshalb zählt hier NUR, was im Kontext-Review als Kevin
   bestätigt wurde. Die Folgen-Lernkurve (FOLGEN/GROWTH) bleibt davon
   unberührt — die bildet weiter nur den Podcast ab. */
const KANAL = { videos: 0, geprueft: 0, vonKevin: 0, channels: [] };
/* Echte Gesamtlaufzeit des ausgewerteten Materials (Sekunden). Wird auf der
   Startseite als Stundenzahl genannt — muss gerechnet, nicht geschätzt sein. */
let totalSeconds = episodes.reduce((s, e) => s + (Number(e.duration) || 0), 0);

if (existsSync(CHANNEL_HITS_FILE)) {
  try {
    const ch = JSON.parse(readFileSync(CHANNEL_HITS_FILE, 'utf8'));
    const kevin = (ch.hits || []).filter((h) => h.verdict === 'kevin');
    KANAL.videos = (ch.videos || []).length;
    KANAL.geprueft = (ch.hits || []).length;
    KANAL.vonKevin = kevin.length;

    totalSeconds += (ch.videos || []).reduce((s, v) => s + (Number(v.duration) || 0), 0);

    const labels = { papaplatte: 'Papaplatte', masha: 'Masha' };
    for (const key of [...new Set((ch.videos || []).map((v) => v.channel))]) {
      KANAL.channels.push({
        key,
        label: labels[key] || key,
        videos: (ch.videos || []).filter((v) => v.channel === key).length,
        treffer: kevin.filter((h) => h.channel === key).length,
      });
    }

    for (const h of kevin) {
      const w = allWords.get(h.es);
      if (w) {
        w.count += 1;
        w.src = w.src === 'kanal' ? 'kanal' : 'beide';
      } else {
        // Wort, das NUR auf den Kanälen vorkommt → keine Folgennummer.
        allWords.set(h.es, {
          es: h.es, de: deFor(h.es) || h.es, folge: null,
          count: 1, tier: tierFor(h.es), kat: katFor(h.es), src: 'kanal',
        });
      }
    }
    console.log(`\n📺 Kanäle: ${KANAL.vonKevin} von ${KANAL.geprueft} Treffern aus `
      + `${KANAL.videos} Videos sind belegt Kevin.`);
  } catch (err) {
    console.log(`\n⚠ channel-hits.json nicht lesbar (${err.message}) — Kanäle übersprungen.`);
  }
} else {
  console.log('\nℹ Keine channel-hits.json — erst `node scripts/scan-channels.mjs` laufen lassen.');
}

// Wörter ohne Kanal-Treffer sind reine Podcast-Wörter.
for (const w of allWords.values()) if (!w.src) w.src = 'podcast';

const byCount = (a, b) => b.count - a.count || a.es.localeCompare(b.es);
const REAL_WORDS = [...allWords.values()].filter((w) => w.tier === 'real').sort(byCount);
const LEHN_WORDS = [...allWords.values()].filter((w) => w.tier === 'lehnwort').sort(byCount);

const REAL_MENTIONS = REAL_WORDS.reduce((s, w) => s + w.count, 0);
const LEHN_MENTIONS = LEHN_WORDS.reduce((s, w) => s + w.count, 0);
const MAX_REAL = Math.max(1, ...REAL_WORDS.map((w) => w.count));
const MAX_LEHN = Math.max(1, ...LEHN_WORDS.map((w) => w.count));
const GROWTH = FOLGEN.map((f) => f.cumulative);
const STAND = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
const ALL = [...REAL_WORDS, ...LEHN_WORDS];

const data = {
  STAND,
  EPISODES: episodes.length,
  WORD_COUNT: REAL_WORDS.length,       // „so viel Spanisch kann Kevin"
  LEHN_COUNT: LEHN_WORDS.length,
  REAL_MENTIONS,
  LEHN_MENTIONS,
  MAX_REAL,
  MAX_LEHN,
  WORDS: REAL_WORDS,                    // Primär = echtes Spanisch
  REAL_WORDS,
  LEHN_WORDS,
  MAX_COUNT: MAX_REAL,                  // Rückwärtskompatibel
  TOTAL_MENTIONS: REAL_MENTIONS,       // Rückwärtskompatibel
  WORD_BY_ES: Object.fromEntries(ALL.map((w) => [w.es, w])),
  GROWTH,
  FACTS: [
    { value: REAL_WORDS.length, suffix: '', label: 'Wörter Spanisch' },
    { value: REAL_MENTIONS, suffix: '', label: 'mal gesagt' },
    { value: episodes.length, suffix: '', label: 'Folgen ausgewertet' },
  ],
  PODCAST: { name: 'Edeltalk', episodes: episodes.length },
  KANAL,
  STUNDEN: Math.round(totalSeconds / 3600),
  CLIPS,
  /* Thematische Gruppen, leere weggelassen — jede Gruppe hat eine andere Größe,
     das gibt der Seite von selbst Rhythmus statt 37 gleicher Zeilen. */
  KATEGORIEN: KATEGORIEN
    .map((k) => ({ ...k, words: REAL_WORDS.filter((w) => w.kat === k.key) }))
    .filter((k) => k.words.length),
  /* Der Häufigkeits-Split. Ein Balkendiagramm ist NUR für die Wörter ehrlich,
     bei denen die Zahl variiert; die 1×-Wörter sind sonst identische Stummel. */
  MEHRFACH: REAL_WORDS.filter((w) => w.count > 1),
  EINMAL: REAL_WORDS.filter((w) => w.count === 1),
  FOLGEN,
};

/* ---------- 5) data.js schreiben ---------- */
const j = (v) => JSON.stringify(v, null, 2);
const out = `/* Automatisch generiert von scripts/build-data.mjs
   Stand: ${data.STAND}
   Channel: ${CHANNEL_URL}
   Reihenfolge: chronologisch (Folge 1 = älteste der ${data.EPISODES} ausgewerteten).
   WORDS/REAL_WORDS = echtes Spanisch (zählt). LEHN_WORDS = Essen-Lehnwörter (zählt nicht).
 */

export const STAND = ${j(data.STAND)};
export const EPISODES = ${data.EPISODES};

export const WORD_COUNT = ${data.WORD_COUNT};
export const LEHN_COUNT = ${data.LEHN_COUNT};
export const REAL_MENTIONS = ${data.REAL_MENTIONS};
export const LEHN_MENTIONS = ${data.LEHN_MENTIONS};
export const MAX_REAL = ${data.MAX_REAL};
export const MAX_LEHN = ${data.MAX_LEHN};
export const MAX_COUNT = ${data.MAX_COUNT};
export const TOTAL_MENTIONS = ${data.TOTAL_MENTIONS};

export const WORDS = ${j(data.WORDS)};

export const REAL_WORDS = ${j(data.REAL_WORDS)};

export const LEHN_WORDS = ${j(data.LEHN_WORDS)};

export const WORD_BY_ES = ${j(data.WORD_BY_ES)};

export const GROWTH = ${JSON.stringify(data.GROWTH)};

export const FACTS = ${j(data.FACTS)};

export const PODCAST = ${j(data.PODCAST)};

/* Kevins eigene Kanäle. Untertitel kennen keine Sprecher, deshalb ist jeder
   Treffer per Kontext-Review einem Sprecher zugeordnet (scripts/data/channel-hits.json).
   Gezählt wird nur, was belegt Kevin sagt. */
export const KANAL = ${j(data.KANAL)};

/* Gerechnete Gesamtlaufzeit des ausgewerteten Materials, in Stunden. */
export const STUNDEN = ${data.STUNDEN};

/* Soundboard: jede zählende Nennung mit Video-ID und Start/Ende in Sekunden.
   Abgespielt wird über den YouTube-Player, nicht über eigene Audiodateien. */
export const CLIPS = ${j(data.CLIPS)};

/* Thematische Gruppen — die Gruppe ist die Aussage, nicht der Balken. */
export const KATEGORIEN = ${j(data.KATEGORIEN)};

/* Häufigkeits-Split: MEHRFACH trägt echte Magnitude (Balken sinnvoll),
   EINMAL ist eine reine Menge (Balken wären 24 identische Stummel). */
export const MEHRFACH = ${j(data.MEHRFACH)};

export const EINMAL = ${j(data.EINMAL)};

export const FOLGEN = ${j(data.FOLGEN)};
`;

console.log(`\n📊 Ergebnis: ${REAL_WORDS.length} echte Spanisch-Wörter (${REAL_MENTIONS}×), `
  + `${LEHN_WORDS.length} Lehnwörter (${LEHN_MENTIONS}×), ${episodes.length} Folgen.`);
console.log(`   Echt:      ${REAL_WORDS.map((w) => `${w.es}(${w.count})`).join(', ') || '—'}`);
console.log(`   Lehnwörter:${LEHN_WORDS.map((w) => `${w.es}(${w.count})`).join(', ') || ' —'}`);

if (DRY) {
  console.log('\n(--dry: data.js NICHT geschrieben)');
} else {
  try { mkdirSync(OUTPUT_DIR, { recursive: true }); } catch { /* egal */ }
  writeFileSync(DATA_FILE, out, 'utf8');
  console.log(`\n✅ Geschrieben nach ${DATA_FILE}`);
  console.log('   Jetzt: npm run build');
}
