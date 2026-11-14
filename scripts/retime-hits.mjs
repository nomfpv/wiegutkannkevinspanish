#!/usr/bin/env node
/* Zeitstempel der Treffer neu berechnen — ohne Netz, ohne Datenverlust
   -------------------------------------------------------------------
   Warum eigenständig und nicht einfach scan-podcast.mjs nochmal laufen lassen:
   podcast-hits.json enthält den Volldurchlauf über 228 Folgen. scan-podcast
   holt standardmäßig 90 und würde den Rest wegwerfen — samt der handgesetzten
   Sprecher-Urteile. Dieses Skript rührt nur `t`, `tEnde`, `time`, `link` und
   `genau` an; verdict, note und context bleiben, wie sie sind.

   Gerechnet wird aus den gecachten Untertiteln mit `toWordTimes`: wortgenaue
   Marken, wo es sie gibt, sonst über den Cue-Block interpolierte Zeiten.
   Ein Treffer wird über seinen Schlüssel wiedergefunden — `id|Wort#n`, also
   „das n-te Vorkommen dieses Worts in diesem Video". Der bleibt stabil,
   solange sich das Lexikon nicht ändert.

   Optionen:
     --dry     nur zeigen, was sich ändern würde
*/

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hitsWithContext } from './lib/spanish.mjs';

const HITS_FILE = join(process.cwd(), 'scripts', 'data', 'podcast-hits.json');
const CACHE_DIR = join(tmpdir(), 'kevin-es-cache');
const DRY = process.argv.includes('--dry');

const d = JSON.parse(readFileSync(HITS_FILE, 'utf8'));

/* Pro Video einmal neu rechnen, dann über den Schlüssel zuordnen. */
const neu = new Map();
const fehlend = new Set();
for (const id of new Set((d.hits || []).map((h) => h.videoId))) {
  const f = join(CACHE_DIR, `${id}.vtt`);
  if (!existsSync(f)) { fehlend.add(id); continue; }
  for (const h of hitsWithContext(readFileSync(f, 'utf8'), { id })) neu.set(h.key, h);
}

let geaendert = 0, unveraendert = 0, ohneCache = 0, verwaist = 0;
let summe = 0, groesster = { d: 0 };
const zaehlt = (h) => h.tier === 'real' && (h.verdict === 'kevin' || h.verdict === 'unsicher');

for (const h of d.hits || []) {
  if (fehlend.has(h.videoId)) { ohneCache += 1; continue; }
  const n = neu.get(h.key);
  if (!n) { verwaist += 1; continue; }

  const versatz = Math.abs(n.t - h.t);
  if (versatz < 0.05 && h.genau === n.genau) { unveraendert += 1; } else {
    geaendert += 1;
    if (zaehlt(h)) {
      summe += versatz;
      if (versatz > groesster.d) groesster = { d: versatz, es: h.es, alt: h.t, neu: n.t, key: h.key };
    }
  }
  h.t = n.t;
  h.tEnde = n.tEnde;
  h.genau = n.genau;
  h.time = n.time;
  h.link = n.link;
}

console.log(`⏱  ${geaendert} Zeiten korrigiert, ${unveraendert} unverändert.`);
if (ohneCache) console.log(`   ${ohneCache} Treffer aus ${fehlend.size} Videos ohne Untertitel-Cache — unangetastet.`);
if (verwaist) console.log(`   ⚠ ${verwaist} Treffer ohne Gegenstück im Neulauf (Lexikon geändert?) — unangetastet.`);
const zaehlende = (d.hits || []).filter(zaehlt);
const grob = zaehlende.filter((h) => h.genau === false).length;
console.log(`   ${zaehlende.length} zählende Treffer: ${zaehlende.length - grob} wortgenau, ${grob} aus Blöcken geschätzt.`);
if (groesster.d) {
  console.log(`   Größte Korrektur bei den zählenden: ${groesster.d.toFixed(1)}s `
    + `(„${groesster.es}" ${groesster.alt.toFixed(1)}s → ${groesster.neu.toFixed(1)}s)`);
}

if (DRY) console.log('\n(--dry: nichts geschrieben)');
else {
  writeFileSync(HITS_FILE, JSON.stringify(d, null, 2), 'utf8');
  console.log(`\n✅ ${HITS_FILE} aktualisiert. Jetzt: node scripts/build-data.mjs`);
}
