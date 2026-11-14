#!/usr/bin/env node
/* Sprecher-Prüfung für die PODCAST-Treffer
   ---------------------------------------
   Warum das nötig ist: Der Edeltalk hat ZWEI Sprecher, Dominik und Kevin.
   Die YouTube-Untertitel kennen keine Sprecher. Die Seite behauptet aber
   „Kevin kann X Wörter Spanisch" — also darf nicht zählen, was Dominik sagt.
   Belegtes Beispiel aus Folge #345: „Herzlich willkommen zum Edeltalk,
   zusammen mit Dominik uuuuund Kevin. Hola, qué tal? Ich will direkt
   überprüfen, wie haben sich DEINE Spanischkenntnisse verbessert?" — dieses
   „Hola qué tal" ist eindeutig Dominik, wurde bisher aber Kevin gutgeschrieben.

   Gleiche Mechanik wie scan-channels.mjs:
     verdict: "auto"    → neu gefunden, automatisch Kevin zugeordnet → zählt,
                          kommt aber NICHT ins Soundboard (nicht nachgehört)
     verdict: "kevin"   → Kevin sagt es, von Hand geprüft → zählt + Soundboard
     verdict: "andere"  → Dominik, ein Gast, oder kein echter Treffer
     verdict: null      → ungeprüft (zählt NICHT) — gibt es seit 26.10.2026
                          nicht mehr, jeder neue Treffer bekommt "auto"

   Gesetzte verdicts überleben einen erneuten Lauf (Merge über den Key).

   Optionen:
     --limit N     Folgen (Default 90)
     --no-cache    Untertitel nicht aus dem Cache lesen
*/

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fetchPlaylist, fetchSubs, hitsWithContext } from './lib/spanish.mjs';

const CHANNEL_URL = 'https://www.youtube.com/@edeltalkpodcast/videos';
const DATA_DIR = join(process.cwd(), 'scripts', 'data');
const HITS_FILE = join(DATA_DIR, 'podcast-hits.json');
const CACHE_DIR = join(tmpdir(), 'kevin-es-cache');

const args = process.argv.slice(2);
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) || 90 : 90;
const USE_CACHE = !args.includes('--no-cache');

try { mkdirSync(DATA_DIR, { recursive: true }); } catch { /* egal */ }
if (USE_CACHE) { try { mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* egal */ } }

const prev = new Map();
if (existsSync(HITS_FILE)) {
  try {
    for (const h of JSON.parse(readFileSync(HITS_FILE, 'utf8')).hits || []) {
      if (h.verdict) prev.set(h.key, { verdict: h.verdict, note: h.note || '' });
    }
  } catch { /* egal */ }
}

console.log(`🎙  Prüfe die ${LIMIT} neuesten Edeltalk-Folgen auf Sprecher…\n`);
const videos = fetchPlaylist(CHANNEL_URL, LIMIT).slice(0, LIMIT);

const allHits = [];
const folgen = [];

for (let i = 0; i < videos.length; i++) {
  const v = videos[i];
  const cacheFile = join(CACHE_DIR, `${v.id}.vtt`);
  let vtt = '';
  if (USE_CACHE && existsSync(cacheFile)) vtt = readFileSync(cacheFile, 'utf8');
  else {
    const res = fetchSubs(v.url);
    vtt = res.text;
    if (res.ok && USE_CACHE) { try { writeFileSync(cacheFile, vtt, 'utf8'); } catch { /* egal */ } }
  }

  folgen.push({ id: v.id, title: v.title });
  if (!vtt || vtt.trim().length < 10) { console.log(`[${i + 1}/${videos.length}] ${v.title} — kein Text`); continue; }

  const hits = hitsWithContext(vtt, { id: v.id });

  /* Satzbausteine (un, una, de, grande …) erben den Sprecher ihres Ankers:
     Sie stehen per Definition im selben Satz, also spricht sie dieselbe Person.
     Das erspart hunderte Handprüfungen, ohne etwas zu erfinden. */
  const anker = hits.filter((h) => !h.baustein);
  const verdictVon = (h) => {
    if (prev.has(h.key)) return prev.get(h.key);
    if (!h.baustein || !anker.length) return null;
    let bester = null, dist = Infinity;
    for (const a of anker) {
      const d = Math.abs(a.t - h.t);
      if (d < dist && prev.has(a.key)) { dist = d; bester = prev.get(a.key); }
    }
    return bester ? { verdict: bester.verdict, note: `geerbt vom Anker im selben Satz (${bester.verdict})` } : null;
  };

  for (const h of hits) {
    const v2 = verdictVon(h);
    allHits.push({
      ...h,
      folgeTitel: v.title,
      verdict: v2?.verdict ?? 'auto',
      note: v2?.note ?? (v2 ? '' : 'automatisch Kevin zugeordnet, nicht nachgehört'),
    });
  }
  console.log(`[${i + 1}/${videos.length}] ${v.title} — ${hits.length} Treffer`);
}

writeFileSync(HITS_FILE, JSON.stringify({
  stand: new Date().toISOString(),
  hinweis: 'verdict: "kevin" = zählt + Soundboard | "auto" = zählt, kein Soundboard | "andere" = Dominik/Gast/kein Treffer | null = ungeprüft (zählt nicht)',
  folgen,
  hits: allHits,
}, null, 2), 'utf8');

const offen = allHits.filter((h) => !h.verdict || h.verdict === 'auto').length;
console.log(`\n📋 ${allHits.length} Treffer in ${folgen.length} Folgen → ${HITS_FILE}`);
console.log(`   ${offen} nicht von Hand geprüft (auto/null).`);
