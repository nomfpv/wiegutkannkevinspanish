#!/usr/bin/env node
/* Zieht eindeutig spanische Wörter aus EINER Podcast-Folge (Einzel-Check).
 *
 *   node scripts/extract.mjs <youtube-oder-ard-url> [--folge N]
 *   node scripts/extract.mjs pfad/zur/datei.vtt        [--folge N]   (auch .srt / .txt)
 *
 * URL-Modus nutzt yt-dlp und zieht die deutsche ORIGINAL-Transkription
 * (Auto-Untertitel). Spanische „es"-Untertitel sind nur Maschinen-
 * Übersetzungen und werden bewusst NICHT verwendet.
 *
 * Erkennung + Übersetzungen kommen aus scripts/lib/spanish.mjs (dieselbe
 * Logik wie beim großen Builder). Ausgabe: Häufigkeitsliste + data.js-Schnipsel.
 */

import { readFileSync } from 'node:fs';
import { fetchSubs, toPlainText, countSpanish, deFor } from './lib/spanish.mjs';

const args = process.argv.slice(2);
const folgeIdx = args.indexOf('--folge');
const folge = folgeIdx >= 0 ? Number(args[folgeIdx + 1]) : null;
const input = args.find((a, i) => a !== '--folge' && args[i - 1] !== '--folge');

if (!input) {
  console.error('Usage: node scripts/extract.mjs <url|datei.vtt|.srt|.txt> [--folge N]');
  process.exit(1);
}

let raw = '';
if (/^https?:\/\//.test(input)) {
  const res = fetchSubs(input);
  if (!res.ok) {
    console.error('❌ Keine deutschen Untertitel gefunden. Ohne Captions: Audio ziehen + mit Whisper transkribieren, dann die .txt hier reingeben.');
    process.exit(1);
  }
  raw = res.text;
} else {
  raw = readFileSync(input, 'utf8');
}

const counts = countSpanish(toPlainText(raw));
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

if (!sorted.length) {
  console.log('Keine eindeutig spanischen Wörter aus dem Lexikon gefunden.');
  console.log('→ Lexikon in scripts/lib/spanish.mjs erweitern, oder Transkript prüfen.');
  process.exit(0);
}

console.log(`\nGefundene spanische Wörter${folge ? ` (Folge ${folge})` : ''}:\n`);
for (const [w, c] of sorted) console.log(`  ${String(c).padStart(3)}×  ${w}`);

console.log(`\ndata.js-Schnipsel (folge ggf. ergänzen):\n`);
for (const [w, c] of sorted) {
  console.log(`  { es: '${w}', de: '${deFor(w)}', folge: ${folge ?? '?'}, count: ${c} },`);
}
console.log('');
