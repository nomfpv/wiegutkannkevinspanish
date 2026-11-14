#!/usr/bin/env node
/* Untertitel-Vorratsholer für den Volldurchlauf
   ---------------------------------------------
   Lädt die deutschen Auto-Untertitel ALLER Kanalvideos in den Cache und legt
   je Video eine <id>.json mit Datum und Dauer daneben. Danach laufen
   scan-podcast.mjs und build-data.mjs komplett aus dem Cache, also schnell.

   Warum getrennt vom Rest: Ein Volldurchlauf über 228 Folgen dauert Stunden.
   Bricht er in der Mitte ab, soll nichts verloren gehen — deshalb ein eigener
   Lauf, der ausschliesslich holt, jeden Treffer sofort auf Platte schreibt und
   beim naechsten Start dort weitermacht, wo er aufgehoert hat.

   Nutzung:
     node scripts/prefetch-subs.mjs            # alles, was noch fehlt
     node scripts/prefetch-subs.mjs --limit 50 # nur die 50 neuesten
*/

import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fetchPlaylist, fetchSubs } from './lib/spanish.mjs';

const CHANNEL_URL = 'https://www.youtube.com/@edeltalkpodcast/videos';
const CACHE_DIR = join(tmpdir(), 'kevin-es-cache');

const args = process.argv.slice(2);
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) || 2000 : 2000;

mkdirSync(CACHE_DIR, { recursive: true });

const videos = fetchPlaylist(CHANNEL_URL, LIMIT).slice(0, LIMIT);
console.log(`Kanal: ${videos.length} Videos.\n`);

let geholt = 0, cache = 0, leer = 0;
const fehlend = [];

for (let i = 0; i < videos.length; i++) {
  const v = videos[i];
  const vtt = join(CACHE_DIR, `${v.id}.vtt`);
  const meta = join(CACHE_DIR, `${v.id}.json`);

  /* Schon da UND nicht verkrueppelt (ein abgebrochener Lauf hinterlaesst
     gelegentlich eine 0-Byte-Datei, die sonst fuer immer als "fertig" gilt). */
  if (existsSync(vtt) && statSync(vtt).size > 500) {
    if (!existsSync(meta)) {
      /* Ohne Meta faellt build-data auf "Datum —" zurueck und sortiert falsch. */
      try {
        const r = fetchSubs(v.url);
        writeFileSync(meta, JSON.stringify({ uploadDate: r.uploadDate, duration: r.duration ?? v.duration }), 'utf8');
      } catch { /* egal */ }
    }
    cache++;
    continue;
  }

  process.stdout.write(`[${i + 1}/${videos.length}] ${v.title.slice(0, 58)} … `);
  try {
    const r = fetchSubs(v.url);
    if (r.ok && r.text && r.text.trim().length > 500) {
      writeFileSync(vtt, r.text, 'utf8');
      writeFileSync(meta, JSON.stringify({ uploadDate: r.uploadDate, duration: r.duration ?? v.duration }), 'utf8');
      geholt++;
      console.log(`ok (${Math.round(r.text.length / 1024)} kB)`);
    } else {
      leer++;
      fehlend.push(`${v.id}  ${v.title}`);
      console.log('KEINE UNTERTITEL');
    }
  } catch (err) {
    leer++;
    fehlend.push(`${v.id}  ${v.title}  (${err.message})`);
    console.log(`FEHLER: ${err.message}`);
  }
}

console.log(`\nFertig. neu geholt: ${geholt} | schon im Cache: ${cache} | ohne Untertitel: ${leer}`);
if (fehlend.length) {
  console.log('\nOhne Untertitel:');
  for (const f of fehlend) console.log('  ' + f);
}
