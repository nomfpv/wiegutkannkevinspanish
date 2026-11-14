#!/usr/bin/env node
/* Fuzzy-Audit: verhörte Schreibweisen bekannter Wörter finden
   -----------------------------------------------------------
   Das Problem: Die Erkennung matcht exakt gegen kanonische Formen und ihre
   Alias-Listen. Die deutsche Spracherkennung zerlegt spanische Wörter aber in
   Schreibweisen, die niemand vorher errät. Belegt in Folge #407: aus
   „Hola qué tal" wurde „Olla Kital" — kein Alias der Welt sieht das kommen,
   und der Treffer fiel jahrelang unter den Tisch.

   Verfahren: Levenshtein-Abstand gegen jedes bekannte Wort und jede Phrase.
   Ein Kandidat wird gemeldet, wenn er nah genug dran ist, aber NICHT schon
   vom exakten Matcher gefunden wurde. Für Phrasen werden gleitende Fenster
   passender Länge geprüft, weil Wortgrenzen bei der Erkennung verrutschen.

   Die Trefferschwelle hängt an der Wortlänge: bei „Hola" (4 Zeichen) wäre
   Abstand 2 schon halber Zufall, bei „Tengo veintinueve años" (22 Zeichen)
   ist Abstand 4 noch dieselbe Aussage.

   Das Skript ZÄHLT NICHTS. Jeder Vorschlag muss im Kontext gelesen werden —
   Fehlalarme sind eingebaut, das ist der Preis für die Trefferquote.

   Nutzung:
     node scripts/audit-fuzzy.mjs              # alle Folgen
     node scripts/audit-fuzzy.mjs --neueste 30 # nur die neuesten N
*/

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { toPlainText, matchSpanish, ES_DE, CANON, epNum } from './lib/spanish.mjs';

const CACHE_DIR = join(tmpdir(), 'kevin-es-cache');
const PODCAST_HITS = join(process.cwd(), 'scripts', 'data', 'podcast-hits.json');

const args = process.argv.slice(2);
const NEUESTE = args.includes('--neueste') ? Number(args[args.indexOf('--neueste') + 1]) || 30 : 0;

if (!existsSync(PODCAST_HITS)) { console.error('podcast-hits.json fehlt.'); process.exit(1); }
const daten = JSON.parse(readFileSync(PODCAST_HITS, 'utf8'));
const folgen = NEUESTE ? daten.folgen.slice(0, NEUESTE) : daten.folgen;

/* Zielformen: alle kanonischen Wörter und Phrasen, klein und ohne Akzente —
   die Erkennung schreibt ohnehin nie Akzente. */
const ohneAkzent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ZIELE = Object.keys(ES_DE)
  .map((k) => ({ roh: k, norm: ohneAkzent(k), woerter: k.trim().split(/\s+/).length }))
  .filter((z) => z.norm.length >= 7);   /* unter 7 Zeichen ist Abstand 1 fast nur Zufall ("ans" vs "anos") */

/* Levenshtein mit Abbruch, sobald das Limit sicher überschritten ist. */
function abstand(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let vor = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const akt = [i];
    let min = i;
    for (let j = 1; j <= b.length; j++) {
      const kosten = a[i - 1] === b[j - 1] ? 0 : 1;
      akt[j] = Math.min(vor[j] + 1, akt[j - 1] + 1, vor[j - 1] + kosten);
      if (akt[j] < min) min = akt[j];
    }
    if (min > limit) return limit + 1;
    vor = akt;
  }
  return vor[b.length];
}

/* Erlaubter Abstand nach Länge: kurze Wörter streng, lange Sätze grosszügig. */
const limitFuer = (n) => (n <= 5 ? 1 : n <= 9 ? 2 : n <= 16 ? 3 : 4);

const treffer = [];

for (const f of folgen) {
  const datei = join(CACHE_DIR, f.id + '.vtt');
  if (!existsSync(datei)) continue;
  const text = toPlainText(readFileSync(datei, 'utf8')).normalize('NFC');

  /* Spannen, die der exakte Matcher schon kennt, ausblenden — sonst meldet
     das Skript jeden echten Treffer noch einmal als „fast". */
  const belegt = matchSpanish(text).map((h) => [h.start, h.end]);
  const schonDa = (a, b) => belegt.some(([s, e]) => a < e && b > s);

  const toks = [...text.matchAll(/[\p{L}]+/gu)];
  const norm = toks.map((m) => ohneAkzent(m[0]));

  for (const z of ZIELE) {
    const limit = limitFuer(z.norm.length);
    /* Fenster von n-1 bis n+1 Wörtern: Die Erkennung zieht Wörter zusammen
       („Olla Kital" statt „Hola qué tal") oder reisst sie auseinander. */
    for (let breite = Math.max(1, z.woerter - 1); breite <= z.woerter + 1; breite++) {
      for (let i = 0; i + breite <= toks.length; i++) {
        const a = toks[i].index;
        const b = toks[i + breite - 1].index + toks[i + breite - 1][0].length;
        if (b - a > z.norm.length * 2 + 6) continue;
        const kandidat = norm.slice(i, i + breite).join(' ');
        if (kandidat === z.norm) continue;              // exakt -> kennt der Matcher
        const dist = abstand(kandidat, z.norm, limit);
        if (dist > limit) continue;
        if (schonDa(a, b)) continue;
        /* Reine Alias-Wiederholung eines anderen bekannten Worts ignorieren. */
        if (breite === 1 && CANON.has(kandidat)) continue;
        treffer.push({
          folge: f, ziel: z.roh, kandidat, dist,
          text: text.slice(a, b),
          snip: text.slice(Math.max(0, a - 190), b + 230).replace(/\s+/g, ' '),
        });
      }
    }
  }
}

/* Beste Übereinstimmung je Fundstelle behalten, damit dieselbe Stelle nicht
   für fünf verschiedene Ziele auftaucht. */
const proStelle = new Map();
for (const t of treffer) {
  const k = `${t.folge.id}|${t.text.toLowerCase()}`;
  const da = proStelle.get(k);
  if (!da || t.dist < da.dist) proStelle.set(k, t);
}
const liste = [...proStelle.values()].sort((a, b) => a.dist - b.dist || a.ziel.localeCompare(b.ziel));

console.log(`Folgen geprüft: ${folgen.length}`);
console.log(`Fast-Treffer, die der exakte Matcher NICHT kennt: ${liste.length}\n`);

for (const t of liste) {
  const nr = epNum(t.folge.title);
  console.log(`── „${t.text}"  ≈  „${t.ziel}"  (Abstand ${t.dist})   [${nr ? '#' + nr : t.folge.title.slice(0, 34)}]`);
  console.log(`   …${t.snip}…\n`);
}
