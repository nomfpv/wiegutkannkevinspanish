#!/usr/bin/env node
/* Versionsstempel für app.js und styles.css
   -----------------------------------------
   Das Problem, das dieses Skript löst: die gebauten Dateien tragen keinen Hash
   im Namen. Solange der Server `Cache-Control: no-cache` schickt, geht das gut —
   aber davor sitzt eine Schicht (openresty vor dem VPS), die statische Dateien
   mit `max-age` ausliefert und dabei den eigenen Header überschreibt. Am
   11.08.2026 hing deshalb ein fertiger Deploy fast drei Stunden im
   Browser-Cache fest: `index.html` war neu, `app.js` alt, die Seite sah
   unverändert aus.

   Gegen fremde Header lässt sich nicht zuverlässig anschreiben. Gegen einen
   neuen Dateinamen schon: `index.html` kommt mit `no-cache` durch, also reicht
   es, dort die URL zu ändern. Neuer Build → neuer Hash → neue URL → der Browser
   MUSS holen. Genau das Muster, das `og.png?v=…` schon benutzt.

   Nachtrag 13.08.2026: der Header-Konflikt davor ist inzwischen behoben (NPM
   reicht das Cache-Control des Ursprungsservers jetzt durch, statt es zu
   verstecken). Der Stempel bleibt trotzdem — er ist erst dadurch, dass die URL
   sich ändert, überhaupt sicher genug, um `immutable` mit einem Jahr Frist zu
   setzen. Genau das steht jetzt in der nginx-Konfiguration.

   Läuft automatisch nach `npm run build`. Idempotent: gleicher Build, gleicher
   Stempel, keine Änderung an index.html.
*/

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = process.cwd();
const HTML = join(ROOT, 'index.html');

/* Beide gebauten Dateien, jeweils mit dem Muster, das ihre URL in index.html
   trifft — auch dann, wenn dort schon ein Stempel steht, damit wiederholte
   Läufe nicht `?v=a?v=b` aneinanderhängen. */
const ZIELE = [
  {
    datei: 'app.js',
    re: /(<script\s[^>]*src=")app\.js(?:\?v=[^"]*)?(")/,
  },
  {
    datei: 'styles.css',
    re: /(<link\s[^>]*href=")styles\.css(?:\?v=[^"]*)?(")/,
  },
];

let html = readFileSync(HTML, 'utf8');
let fehler = false;

for (const { datei, re } of ZIELE) {
  const hash = createHash('sha256')
    .update(readFileSync(join(ROOT, datei)))
    .digest('hex')
    .slice(0, 10);

  if (!re.test(html)) {
    console.error(`❌ Keine Einbindung von ${datei} in index.html gefunden — nichts gestempelt.`);
    fehler = true;
    continue;
  }

  const out = html.replace(re, `$1${datei}?v=${hash}$2`);
  if (out === html) {
    console.log(`   index.html            Stempel war aktuell (${datei} v=${hash})`);
  } else {
    html = out;
    console.log(`   index.html            ${datei}?v=${hash}`);
  }
}

if (fehler) process.exit(1);

writeFileSync(HTML, html, 'utf8');
