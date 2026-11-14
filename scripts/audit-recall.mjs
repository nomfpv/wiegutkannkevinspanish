#!/usr/bin/env node
/* Recall-Audit: Welches Spanisch entgeht dem Lexikon?
   ---------------------------------------------------
   Das Problem, das dieses Skript löst: die Erkennung in scripts/lib/spanish.mjs
   ist eine kuratierte Whitelist. Was nicht draufsteht, ist unsichtbar — auch
   dann, wenn Kevin einen kompletten spanischen Satz sagt. Genau so blieben die
   Spanisch-Lektionen aus den Folgen #344–#400 lange ungezählt.

   Verfahren: Spanisch-DICHTE statt Einzelwörter. Ein deutsches Transkript
   enthält zufällig mal ein spanisches Wort. Aber drei davon in einem
   14-Token-Fenster heißt: da spricht jemand wirklich Spanisch. Das findet auch
   Sätze, deren Einzelteile (un, una, y, de, café) als Whitelist-Einträge viel
   zu viele Fehltreffer erzeugen würden.

   Das Skript ZÄHLT NICHTS und ändert keine Daten — es zeigt nur Fundstellen zum
   Nachlesen. Was davon ins Lexikon wandert, entscheidest du.

   ZWEITES Verfahren (--stichworte): Der Dichte-Detektor hat einen blinden
   Fleck — ein EINZELNES unbekanntes spanisches Wort in deutschem Satz löst ihn
   nie aus. Genau so blieben „Ayuda", „Domingo", „Lunes" und „Alemania" auch
   nach dem ersten Durchgang liegen. Dagegen sucht --stichworte nicht nach
   Spanisch, sondern nach den DEUTSCHEN Stellen, an denen über Spanisch geredet
   wird („auf Spanisch", „Vokabel", „Duolingo"). Dort steht das spanische Wort
   daneben und wird meist gleich übersetzt. Beide Verfahren zusammen benutzen —
   sie finden Unterschiedliches.

   Nutzung (liest den VTT-Cache, lädt nichts nach):
     node scripts/audit-recall.mjs               # Dichte, Podcast
     node scripts/audit-recall.mjs --kanal       # Dichte, Kevins YouTube-Kanäle
     node scripts/audit-recall.mjs --top 40      # mehr Fundstellen zeigen
     node scripts/audit-recall.mjs --stichworte  # Gegenprobe über deutsche Cues

   Erwartetes Rauschen, das man beim Lesen aussortiert: Ortsnamen („Playa de
   los Reyes", „Los Angeles"), Domains („edeltalk.de"), Französisch („Tour de
   France"), englischer Songtext und die y-Achse aus Mathe-Erklärungen.
*/

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { toPlainText, matchSpanish } from './lib/spanish.mjs';

const CACHE_DIR = join(tmpdir(), 'kevin-es-cache');
const HITS_FILE = join(process.cwd(), 'scripts', 'data', 'channel-hits.json');

const args = process.argv.slice(2);
const ONLY_CHANNEL = args.includes('--kanal');
const CUE_MODE = args.includes('--stichworte');
const TOP = args.includes('--top') ? Number(args[args.indexOf('--top') + 1]) || 25 : 25;

/* Deutsche Stichwörter für --stichworte. Bewusst NUR eindeutig spanischbezogene:
   „wie sagt man" und „übersetzt" wurden wieder entfernt, die trafen zu 95 %
   deutsches Gerede („wie sagt man das? — Theke"). */
const CUES = [
  'auf spanisch', 'auf spanische', 'heißt spanisch', 'spanisch sagen', 'spanisch gesagt',
  'spanisch gelernt', 'spanisch lernen', 'spanisch sprechen', 'spanischkenntnis',
  'duolingo', 'vokabel', 'spanischlehrer', 'spanisch kann', 'kann spanisch',
];

/* Breites Spanisch-Set INKLUSIVE Funktionswörtern — die machen die Dichte aus.
   Bewusst DRAUSSEN: alles, was auch deutsch ist (es, in, so, no, mal, man, die,
   der, das, am, an, um, ist, war, sind, wie, hat, kann) — sonst feuert jeder
   zweite Satz. Diese Liste ist nur ein SUCHFILTER, keine Zähl-Grundlage. */
const ES = new Set(`
el la los las un una unos unas lo al del de y o u que qué quien quién cual cuál
en con sin por para sobre entre hasta desde como cómo cuando cuándo donde dónde
soy eres somos sois son estoy estas estás esta está estamos estan están
tengo tienes tiene tenemos tienen quiero quieres quiere queremos kero
puedo puedes puede hablo hablas habla hablar entiendo entiende
me te se nos os mi mis tu tus su sus yo él ella ellos nosotros
muy mas más mucho mucha muchos muchas poco poca todo toda todos todas
bien bueno buena buenos buenas malo mala grande pequeno pequeño
gracias favor hola adios adiós señor señora senor senora amigo amiga amigos
cafe café te té agua cerveza vino comida casa calle playa mar sol luna
ano anos año años dia dias día días noche tarde manana mañana hoy ayer
uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece
veinte veintiuno veintinueve ventinueve treinta cuarenta cincuenta cien mil
nombre llamo llama gusto gusta gustan quisiera necesito hay vamos vamonos
perro gato dinero trabajo amor vida mundo verdad nada nadie algo alguien
espanol español ingles inglés aleman alemán disculpe disculper bombona bonbona
`.trim().split(/\s+/).filter(Boolean));

const WIN = 14;   // Fenstergröße in Token
const MIN = 3;    // so viele Spanisch-Token müssen darin liegen

if (!existsSync(CACHE_DIR)) {
  console.error(`❌ Kein Untertitel-Cache unter ${CACHE_DIR}.`);
  console.error('   Erst `node scripts/build-data.mjs` oder `node scripts/scan-channels.mjs` laufen lassen.');
  process.exit(1);
}

/* Kanal-Videos von Podcast-Folgen trennen. */
const channelIds = new Set();
const titleById = new Map();
if (existsSync(HITS_FILE)) {
  try {
    for (const v of JSON.parse(readFileSync(HITS_FILE, 'utf8')).videos || []) {
      channelIds.add(v.id);
      titleById.set(v.id, v.title);
    }
  } catch { /* egal */ }
}

const files = readdirSync(CACHE_DIR).filter((f) => {
  if (!f.endsWith('.vtt')) return false;
  return ONLY_CHANNEL === channelIds.has(f.replace(/\.vtt$/, ''));
});

/* ---------- Verfahren 2: Gegenprobe über deutsche Stichwörter ---------- */
if (CUE_MODE) {
  const CTX = 190;
  const found = [];
  for (const f of files) {
    const id = f.replace(/\.vtt$/, '');
    const text = toPlainText(readFileSync(join(CACHE_DIR, f), 'utf8')).normalize('NFC');
    const low = text.toLowerCase();
    for (const cue of CUES) {
      let from = 0, i;
      while ((i = low.indexOf(cue, from)) !== -1) {
        from = i + cue.length;
        const snip = text.slice(Math.max(0, i - CTX), i + CTX).replace(/\s+/g, ' ');
        found.push({ id, cue, snip, known: matchSpanish(snip).length });
      }
    }
  }
  const open = found.filter((o) => !o.known);
  console.log(`Transkripte: ${files.length} (${ONLY_CHANNEL ? 'Kanäle' : 'Podcast'})`);
  console.log(`Stellen mit Spanisch-Bezug: ${found.length}, davon ${open.length} ohne Lexikon-Treffer im Umfeld.`);
  console.log('Diese durchlesen — hier steht das Spanische, das die Wortliste nicht kennt:\n');
  for (const o of open.slice(0, TOP)) {
    console.log(`── [${o.id}] „${o.cue}"`);
    console.log(`   …${o.snip}…\n`);
  }
  console.log('Zum Nachschlagen einer Folge: https://www.youtube.com/watch?v=<ID>');
  process.exit(0);
}

/* ---------- Verfahren 1: Spanisch-Dichte ---------- */
const bursts = [];
for (const f of files) {
  const id = f.replace(/\.vtt$/, '');
  const text = toPlainText(readFileSync(join(CACHE_DIR, f), 'utf8')).normalize('NFC');
  const toks = [...text.matchAll(/[\p{L}]+/gu)].map((m) => ({ w: m[0].toLowerCase(), i: m.index, len: m[0].length }));
  const isEs = toks.map((t) => ES.has(t.w));

  let i = 0;
  while (i < toks.length) {
    let hits = 0;
    for (let j = i; j < Math.min(i + WIN, toks.length); j++) if (isEs[j]) hits++;
    if (hits < MIN) { i++; continue; }

    // Burst so weit ausdehnen, wie die Dichte anhält.
    let end = i + WIN;
    while (end < toks.length) {
      let h = 0;
      for (let j = end - WIN; j < Math.min(end + 6, toks.length); j++) if (isEs[j]) h++;
      if (h < MIN) break;
      end += 6;
    }
    end = Math.min(end, toks.length - 1);

    const words = [];
    for (let j = i; j <= end; j++) if (isEs[j]) words.push(toks[j].w);
    const from = Math.max(0, toks[i].i - 90);
    const to = Math.min(text.length, toks[end].i + toks[end].len + 90);
    const snippet = text.slice(from, to).replace(/\s+/g, ' ');

    // Was davon kennt das Lexikon schon?
    const known = new Set(matchSpanish(snippet).map((h) => h.canon.toLowerCase()));
    bursts.push({ id, n: words.length, words: [...new Set(words)], snippet, known: known.size });
    i = end + 1;
  }
}

bursts.sort((a, b) => b.n - a.n);

console.log(`Transkripte: ${files.length} (${ONLY_CHANNEL ? 'Kanäle' : 'Podcast'})`);
console.log(`Spanisch-Bursts: ${bursts.length} — die ${Math.min(TOP, bursts.length)} dichtesten:\n`);

for (const b of bursts.slice(0, TOP)) {
  const title = titleById.get(b.id);
  console.log(`── [${b.id}]${title ? ` ${title}` : ''}`);
  console.log(`   ${b.n} Spanisch-Token${b.known ? `, davon ${b.known} im Lexikon` : ' — NICHTS davon im Lexikon'}: ${b.words.slice(0, 14).join(' ')}`);
  console.log(`   …${b.snippet}…\n`);
}

console.log('Zum Nachschlagen einer Folge: https://www.youtube.com/watch?v=<ID>');
