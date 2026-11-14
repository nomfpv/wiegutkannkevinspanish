/* Teilbild und Meta-Angaben erzeugen.  Aufruf: npm run og
 *
 * Baut aus src/lib/data.js
 *   og.png               1200x630, die Vorschaukarte für Discord, WhatsApp, X
 *   apple-touch-icon.png 180x180, das Symbol auf dem Startbildschirm
 * und schreibt den Block zwischen <!-- meta:auto --> in index.html neu, damit
 * Titel, Beschreibung und Wortzahl nach einem Datenlauf nicht veralten.
 *
 * Gerendert wird mit dem Edge, der ohnehin auf dem Rechner liegt, also ohne
 * zusätzliche Abhängigkeit. Der Bildschirm dieses Rechners ist auf 125 %
 * gestellt; headless Edge legt die Seite deshalb breiter aus, als es
 * fotografiert (siehe messeSkalierung). Der Faktor wird gemessen, nicht
 * geraten, und die Karte per transform genau so weit hochskaliert.
 */
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const run = promisify(execFile);
const root = process.cwd();

/* ---------------------------------------------------------------- Edge ---- */

function edgePfad() {
  const orte = [
    join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];
  const gefunden = orte.find((o) => o && existsSync(o));
  if (!gefunden) throw new Error('Microsoft Edge nicht gefunden. Ohne Browser kann og.png nicht gerendert werden.');
  return gefunden;
}

const grundflaggen = (profil) => [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--force-prefers-reduced-motion', `--user-data-dir=${profil}`,
];

/* Wie viele CSS-Pixel breit legt der Browser aus, wenn wir N Pixel Fenster
   verlangen? Auf einem Bildschirm ohne Skalierung ist das 1. */
async function messeSkalierung(edge, arbeit, breite) {
  const probe = join(arbeit, 'probe.html');
  await writeFile(probe, '<!doctype html><meta charset="utf-8"><script>document.title="B:"+window.innerWidth</script>');
  const { stdout } = await run(
    edge,
    [...grundflaggen(join(arbeit, 'profil')), `--window-size=${breite},400`, '--dump-dom', pathToFileURL(probe).href],
    { maxBuffer: 32 * 1024 * 1024 }
  );
  const treffer = stdout.match(/B:(\d+)/);
  if (!treffer) return 1;
  return Number(treffer[1]) / breite;
}

async function schiessen(edge, arbeit, html, ziel, breite, hoehe) {
  const datei = join(arbeit, 'karte.html');
  await writeFile(datei, html, 'utf8');
  await run(
    edge,
    [
      ...grundflaggen(join(arbeit, 'profil')),
      `--window-size=${breite},${hoehe}`,
      '--virtual-time-budget=6000',
      `--screenshot=${ziel}`,
      pathToFileURL(datei).href,
    ],
    { maxBuffer: 32 * 1024 * 1024 }
  ).catch((e) => {
    /* Edge meldet auch bei Erfolg auf stderr; nur ein fehlendes Bild ist ein Fehler. */
    if (!existsSync(ziel)) throw e;
  });
  if (!existsSync(ziel)) throw new Error(`Kein Bild geschrieben: ${ziel}`);
}

/* --------------------------------------------------------------- Karte ---- */

/* Dunkel gehalten: In Discord und WhatsApp liegt die Vorschau meist auf hellem
   Grund, eine dunkle Karte setzt sich davon ab. Die Farben sind die
   Dark-Mode-Token der Seite, damit Bild und Seite dasselbe Stück bleiben. */
function ogKarte(d, skala) {
  return `<!doctype html><html lang="de"><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Martian+Mono:wght@400;500&family=Schibsted+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box }
  html, body { background: #0c0d0f; overflow: hidden }
  .karte {
    position: relative; width: 1200px; height: 630px; overflow: hidden;
    transform: scale(${skala}); transform-origin: top left;
    background: #0c0d0f; color: #edeef1;
    font-family: "Schibsted Grotesk", "Segoe UI", sans-serif;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 68px 72px;
  }
  .glanz {
    position: absolute; top: -300px; right: -180px; width: 760px; height: 760px;
    border-radius: 50%; filter: blur(90px); opacity: .42;
    background: radial-gradient(circle at 40% 40%, #60a5ff, transparent 62%);
  }
  .zeile { position: relative; display: flex; align-items: baseline; justify-content: space-between }
  .marke { font-size: 26px; font-weight: 700; letter-spacing: -.02em }
  .marke span { color: #9d9fa7 }
  .stand, .fuss { font-family: "Martian Mono", ui-monospace, monospace; font-size: 17px; color: #9d9fa7 }
  /* Nimmt den Platz zwischen Kopf und Fuß und sitzt darin mittig, sonst
     klafft unter der Überschrift ein totes Band. Der Satz steckt in einem
     eigenen span: läge er direkt im Flex-Kasten, würde jedes Wort zu einer
     eigenen Spalte. */
  h1 { position: relative; flex: 1; display: flex; align-items: center }
  h1 span {
    display: block; font-size: 88px; font-weight: 600; line-height: 1.03;
    letter-spacing: -.035em; max-width: 17ch;
  }
  h1 b { font-weight: 600; color: #60a5ff }
  .fuss { display: flex; gap: 18px; align-items: center }
  .fuss i { font-style: normal; color: #43454b }
</style>
<div class="karte">
  <div class="glanz"></div>
  <div class="zeile">
    <div class="marke">kevin<span>.es</span></div>
    <div class="stand">Stand ${d.STAND}</div>
  </div>
  <h1><span>Kevin kann <b>${d.WORD_COUNT}</b> Wörter Spanisch.</span></h1>
  <div class="fuss">
    <span>${d.REAL_MENTIONS} Nennungen</span><i>·</i>
    <span>${d.EPISODES} Folgen</span><i>·</i>
    <span>${d.STUNDEN} Stunden Material</span>
  </div>
</div></html>`;
}

/* Dasselbe Zeichen wie favicon.svg, nur als PNG für iOS-Startbildschirme.
   Dort liegt das Symbol auf der Tapete des Nutzers, deshalb fest hell.
   512 statt der empfohlenen 180 Pixel: Chromium hält ein Fenster mindestens
   rund 500 Pixel breit, kleinere Aufnahmen fotografieren nur die Ecke. iOS
   rechnet ein größeres Symbol ohnehin herunter. */
const ICON = 512;

function iconKarte(skala) {
  return `<!doctype html><html lang="de"><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0 }
  html, body { background: #18181b; overflow: hidden }
  .k {
    width: ${ICON}px; height: ${ICON}px; transform: scale(${skala}); transform-origin: top left;
    background: #18181b; color: #fff; display: grid; place-items: center;
    font-family: "Segoe UI", system-ui, sans-serif; font-size: 272px; font-weight: 700;
    letter-spacing: -12px;
  }
</style>
<div class="k">es</div></html>`;
}

/* ---------------------------------------------------------------- Meta ---- */

function metaBlock(d) {
  const titel = `Kevin kann ${d.WORD_COUNT} Wörter Spanisch.`;
  const text = `Jedes Wort mitgezählt aus ${d.EPISODES} Folgen Edeltalk und ${d.KANAL.videos} YouTube-Videos, mit Folge und Häufigkeit.`;
  const basis = 'https://wiegutkannkevinspanisch.de/';
  /* ?v= mit der Wortzahl: Vorschaubilder werden von den Diensten lange
     zwischengespeichert, ohne neue Adresse bliebe die alte Zahl stehen. */
  return [
    '<!-- meta:auto — von scripts/og.mjs aus src/lib/data.js erzeugt, nicht von Hand ändern -->',
    '  <title>kevin.es · Spanisch-Tracker</title>',
    `  <meta name="description" content="Wie viel Spanisch kann Kevin wirklich? ${text}" />`,
    '  <meta property="og:type" content="website" />',
    '  <meta property="og:site_name" content="kevin.es" />',
    '  <meta property="og:locale" content="de_DE" />',
    `  <meta property="og:url" content="${basis}" />`,
    `  <meta property="og:title" content="${titel}" />`,
    `  <meta property="og:description" content="${text}" />`,
    `  <meta property="og:image" content="${basis}og.png?v=${d.WORD_COUNT}" />`,
    '  <meta property="og:image:type" content="image/png" />',
    '  <meta property="og:image:width" content="1200" />',
    '  <meta property="og:image:height" content="630" />',
    `  <meta property="og:image:alt" content="${titel}" />`,
    '  <meta name="twitter:card" content="summary_large_image" />',
    '  <!-- /meta:auto -->',
  ].join('\n');
}

async function metaSchreiben(d) {
  const pfad = join(root, 'index.html');
  const alt = await readFile(pfad, 'utf8');
  const muster = /<!-- meta:auto[\s\S]*?<!-- \/meta:auto -->/;
  if (!muster.test(alt)) throw new Error('Marker <!-- meta:auto --> fehlt in index.html.');
  const neu = alt.replace(muster, metaBlock(d));
  if (neu === alt) return false;
  await writeFile(pfad, neu, 'utf8');
  return true;
}

/* ---------------------------------------------------------------- Lauf ---- */

const d = await import(pathToFileURL(join(root, 'src', 'lib', 'data.js')).href);
const edge = edgePfad();
const arbeit = await mkdtemp(join(tmpdir(), 'kevin-og-'));

try {
  const skala = await messeSkalierung(edge, arbeit, 1200);
  console.log(`  Bildschirmskalierung gemessen: ${skala.toFixed(3)}`);

  await schiessen(edge, arbeit, ogKarte(d, skala), join(root, 'og.png'), 1200, 630);
  console.log('  og.png                1200x630');

  await schiessen(edge, arbeit, iconKarte(skala), join(root, 'apple-touch-icon.png'), ICON, ICON);
  console.log(`  apple-touch-icon.png  ${ICON}x${ICON}`);

  console.log(`  index.html            ${(await metaSchreiben(d)) ? 'Meta-Block aktualisiert' : 'Meta-Block war aktuell'}`);
} finally {
  await rm(arbeit, { recursive: true, force: true });
}
