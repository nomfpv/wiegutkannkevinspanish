#!/usr/bin/env node
/* Spanisch-Treffer aus Kevins YouTube-KANÄLEN sammeln (nicht Podcast)
   ------------------------------------------------------------------
   Holt die letzten N Videos von @DomoPapaplatte und @masha_bk, zieht die
   deutsche Original-Transkription und schreibt JEDEN Spanisch-Treffer mit
   Zeitstempel + Gesprächskontext nach scripts/data/channel-hits.json.

   Warum der Umweg über eine Review-Datei?
   ---------------------------------------
   YouTube-Untertitel kennen KEINE Sprecher. Auf beiden Kanälen reden andere
   Leute mit (Masha, Freunde, Kellner in Barcelona). Der Auftrag ist aber:
   nur zählen, was KEVIN sagt. Also entscheidet ein Mensch pro Treffer anhand
   des Kontexts — das Skript schlägt nur vor.

     verdict: null      → noch nicht geprüft (wird NICHT gezählt)
     verdict: "kevin"   → Kevin sagt es → zählt
     verdict: "andere"  → jemand anderes / kein echter Treffer → zählt nicht

   Bereits gesetzte Verdicts bleiben bei erneutem Lauf erhalten (Merge über
   einen stabilen Treffer-Key).

   Optionen:
     --limit N     Videos pro Kanal (Default 15)
     --no-cache    Untertitel nicht aus dem lokalen Cache lesen/schreiben
*/

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fetchPlaylist, fetchSubs, toCues, matchSpanish, normalizeForScan, deFor } from './lib/spanish.mjs';

const CHANNELS = [
  { key: 'papaplatte', label: 'Papaplatte', url: 'https://www.youtube.com/@DomoPapaplatte/videos' },
  { key: 'masha', label: 'Masha', url: 'https://www.youtube.com/@masha_bk/videos' },
];

const DATA_DIR = join(process.cwd(), 'scripts', 'data');
const HITS_FILE = join(DATA_DIR, 'channel-hits.json');
const CACHE_DIR = join(tmpdir(), 'kevin-es-cache');

const args = process.argv.slice(2);
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) || 15 : 15;
const USE_CACHE = !args.includes('--no-cache');

/* Kontextfenster um den Treffer herum (Zeichen). Genug, um zu erkennen, wer
   gerade spricht („sagt Masha…", „fragt der Kellner…", Anrede „Kevin"…). */
const CTX = 260;

if (USE_CACHE) { try { mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* egal */ } }
try { mkdirSync(DATA_DIR, { recursive: true }); } catch { /* egal */ }

/* Vorhandene Verdicts laden, damit ein zweiter Lauf die Handarbeit nicht killt. */
const prevVerdicts = new Map();
if (existsSync(HITS_FILE)) {
  try {
    const prev = JSON.parse(readFileSync(HITS_FILE, 'utf8'));
    for (const h of prev.hits || []) if (h.verdict) prevVerdicts.set(h.key, { verdict: h.verdict, note: h.note || '' });
  } catch { /* egal */ }
}

const hhmmss = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

const allHits = [];
const videos = [];

for (const ch of CHANNELS) {
  console.log(`\n🎬 ${ch.label} — letzte ${LIMIT} Videos\n`);
  const list = fetchPlaylist(ch.url, LIMIT).slice(0, LIMIT);

  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    console.log(`[${i + 1}/${list.length}] ${v.title}`);

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
      if (!res.ok) console.log('  ⚠ Keine deutschen Untertitel gefunden');
      else {
        console.log(`  → Untertitel erhalten (${vtt.length} Zeichen)`);
        if (USE_CACHE) {
          try {
            writeFileSync(cacheFile, vtt, 'utf8');
            writeFileSync(metaFile, JSON.stringify({ uploadDate, duration }), 'utf8');
          } catch { /* egal */ }
        }
      }
    }

    videos.push({ channel: ch.key, id: v.id, title: v.title, uploadDate, duration });
    if (!vtt || vtt.trim().length < 10) { console.log('  ✓ kein Text'); continue; }

    /* Cues zu einem Fließtext fügen und dabei merken, ab welchem Zeichen-
       Offset welcher Cue (= welcher Zeitstempel) beginnt. */
    const cues = toCues(vtt);
    const starts = [];
    let text = '';
    for (const c of cues) {
      starts.push({ off: text.length, t: c.t });
      text += (text ? ' ' : '') + c.text;
    }
    text = normalizeForScan(text);

    const timeAt = (idx) => {
      let lo = 0, hi = starts.length - 1, best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (starts[mid].off <= idx) { best = mid; lo = mid + 1; } else hi = mid - 1;
      }
      return starts[best]?.t ?? 0;
    };

    const hits = matchSpanish(text);
    for (const h of hits) {
      const t = timeAt(h.start);
      const key = `${v.id}|${h.start}|${h.canon}`;
      const before = text.slice(Math.max(0, h.start - CTX), h.start);
      const word = text.slice(h.start, h.end);
      const after = text.slice(h.end, h.end + CTX);
      allHits.push({
        key,
        channel: ch.key,
        videoId: v.id,
        videoTitle: v.title,
        t,
        time: hhmmss(t),
        link: `https://www.youtube.com/watch?v=${v.id}&t=${Math.max(0, t - 3)}`,
        es: h.canon,
        de: deFor(h.canon) || '',
        tier: h.tier,
        context: `${before}⟦${word}⟧${after}`,
        verdict: prevVerdicts.get(key)?.verdict ?? null,
        note: prevVerdicts.get(key)?.note ?? '',
      });
    }
    console.log(hits.length ? `  ✓ ${hits.length} Treffer: ${[...new Set(hits.map((h) => h.canon))].join(', ')}`
      : '  ✓ kein Spanisch');
  }
}

const out = {
  stand: new Date().toISOString(),
  limitProChannel: LIMIT,
  hinweis: 'verdict: "kevin" = zählt | "andere" = zählt nicht | null = ungeprüft (zählt nicht)',
  videos,
  hits: allHits,
};
writeFileSync(HITS_FILE, JSON.stringify(out, null, 2), 'utf8');

const open = allHits.filter((h) => !h.verdict).length;
console.log(`\n📋 ${allHits.length} Treffer in ${videos.length} Videos → ${HITS_FILE}`);
console.log(`   ${open} davon noch ungeprüft (verdict: null).`);
