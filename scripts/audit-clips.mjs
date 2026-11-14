#!/usr/bin/env node
/* Prüft, ob die Soundboard-Clips wirklich auf dem Wort landen
   -----------------------------------------------------------
   Für jeden zählenden Treffer wird aus dem gecachten Untertitel bestimmt, in
   welchem Zeitfenster das Wort NACHWEISLICH fällt, und mit dem Fenster
   verglichen, das die Seite abspielt (`clipFenster`, dieselbe Funktion, die
   auch build-data.mjs benutzt).

   Der Nachweis kommt bewusst NICHT aus derselben Rechnung wie die Clipzeit,
   sonst prüfte sich das Skript selbst:
     wortgenaue Folgen — Beleg ist die Wortmarke aus dem VTT.
     Block-Folgen      — Beleg ist der ganze Cue-Block, in dem das Wort steht,
                         also [Blockanfang, Blockende]. Liegt der komplett im
                         Clip, hört man das Wort, egal wo im Block es fällt.
                         Die Interpolation aus toWordTimes geht hier nicht ein.

   Bewertung je Treffer:
     ok        Beleg liegt komplett im Clip
     knapp     weniger als 0,3 s Luft zum Rand
     daneben   Beleg ragt heraus → der Knopf spielt die falsche Stelle

   Aufruf:  node scripts/audit-clips.mjs [--alle]
*/

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  toTimedWords, toCueBlocks, normalizeForScan, matchSpanish, clipFenster,
} from './lib/spanish.mjs';

const HITS_FILE = join(process.cwd(), 'scripts', 'data', 'podcast-hits.json');
const CACHE_DIR = join(tmpdir(), 'kevin-es-cache');
const ALLE = process.argv.includes('--alle');

const d = JSON.parse(readFileSync(HITS_FILE, 'utf8'));
const zaehlend = (d.hits || []).filter(
  (h) => h.tier === 'real' && (h.verdict === 'kevin' || h.verdict === 'unsicher'),
);

/* Pro Video: der Beleg-Text. Aufgebaut wird er hier aus den ROHEN Zeitmarken
   des VTT — bei Block-Untertiteln aus den Cue-Blöcken, bei wortgenauen aus den
   Wortmarken —, jeweils mit dem Zeichenbereich, den ein Abschnitt im Text
   belegt. Bewusst eine eigene Rechnung: würde hier `toWordTimes` benutzt,
   prüfte das Skript nur, ob die Funktion mit sich selbst übereinstimmt. */
const cache = new Map();
function video(id) {
  if (cache.has(id)) return cache.get(id);
  const f = join(CACHE_DIR, `${id}.vtt`);
  if (!existsSync(f)) { cache.set(id, null); return null; }
  const vtt = readFileSync(f, 'utf8');
  const genau = toTimedWords(vtt).length >= 20;

  const stuecke = [];   // { von, bis, ab, weiter } — Zeit- und Zeichenbereich
  let text = '';
  const anhaengen = (s, von, bis) => {
    const ab = text.length ? text.length + 1 : 0;
    text += (text ? ' ' : '') + s;
    stuecke.push({ von, bis, ab, weiter: text.length });
  };
  if (genau) {
    const roh = toTimedWords(vtt);
    roh.forEach((x, i) => anhaengen(x.w, x.t, roh[i + 1]?.t ?? x.t + 1));
  } else {
    for (const c of toCueBlocks(vtt)) if (c.text.trim()) anhaengen(c.text.trim(), c.t, c.ende);
  }

  const res = { stuecke, text: normalizeForScan(text), genau };
  cache.set(id, res);
  return res;
}

/* Zeitbereich, den die Zeichen [von, bis) belegen. */
function belegFuer(v, von, bis) {
  const treffer = v.stuecke.filter((s) => s.weiter > von && s.ab < bis);
  if (!treffer.length) return null;
  return {
    von: Math.min(...treffer.map((s) => s.von)),
    bis: Math.max(...treffer.map((s) => s.bis)),
  };
}

const zaehl = { ok: 0, knapp: 0, daneben: 0, unpruefbar: 0 };
const zeilen = [];

for (const h of zaehlend) {
  const v = video(h.videoId);
  if (!v) { zaehl.unpruefbar += 1; continue; }

  /* Das n-te Vorkommen dieses Worts — genau das, was der Schlüssel benennt. */
  const n = Number(h.key.split('#').pop());
  const m = matchSpanish(v.text).filter((x) => x.canon === h.es)[n - 1];
  if (!m) { zaehl.unpruefbar += 1; continue; }

  const b = belegFuer(v, m.start, m.end);
  if (!b) { zaehl.unpruefbar += 1; continue; }
  const { von: belegVon, bis: belegBis } = b;

  const { start, ende } = clipFenster(h);
  const luft = Math.min(belegVon - start, ende - belegBis);
  const status = luft < 0 ? 'daneben' : luft < 0.3 ? 'knapp' : 'ok';
  zaehl[status] += 1;

  if (status !== 'ok' || ALLE) {
    zeilen.push({
      status,
      text: `${status.padEnd(8)} ${h.es.slice(0, 26).padEnd(28)} `
        + `Clip ${start.toFixed(1)}–${ende.toFixed(1)}`.padEnd(22)
        + `Beleg ${belegVon.toFixed(1)}–${belegBis.toFixed(1)}`.padEnd(23)
        + `${v.genau ? 'wortgenau' : 'Block    '}  Luft ${luft.toFixed(1)}s  ${h.key}`,
    });
  }
}

const rang = { daneben: 0, knapp: 1, ok: 2 };
for (const z of zeilen.sort((a, b) => rang[a.status] - rang[b.status])) console.log(z.text);

console.log(`\n📊 ${zaehlend.length} zählende Treffer: ${zaehl.ok} ok, ${zaehl.knapp} knapp, `
  + `${zaehl.daneben} daneben, ${zaehl.unpruefbar} nicht prüfbar.`);
process.exitCode = zaehl.daneben ? 1 : 0;
