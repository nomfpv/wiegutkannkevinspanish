/* Zieht aus scripts/data/podcast-hits.json die Stellen im Wortlaut heraus und
 * schreibt sie nach src/lib/zitate.js.  Aufruf: npm run zitate
 *
 * Gebraucht wird das für die Untertitel-Einblendung: Sie zeigt nicht, DASS ein
 * Wort fiel, sondern den Satz drumherum, so wie er in der Folge steht. Deshalb
 * nur Treffer mit verdict "kevin" — was Reeze oder ein Gast sagt, gehört da
 * nicht rein (siehe podcast-speaker-review).
 *
 * Getrennt vom großen build-data.mjs, weil das yt-dlp und Netz braucht; hier
 * reicht die bereits geprüfte JSON-Datei.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const QUELLE = join(process.cwd(), 'scripts', 'data', 'podcast-hits.json');
const ZIEL = join(process.cwd(), 'src', 'lib', 'zitate.js');

const VOR = 95;   // Zeichen vor dem Wort
const NACH = 70;  // Zeichen danach

/* Auto-Untertitel haben keine Satzzeichen-Disziplin. Wir schneiden deshalb an
   Wortgrenzen und setzen Auslassungspunkte, statt mitten im Wort zu kappen. */
function ausschnitt(kontext) {
  const auf = kontext.indexOf('⟦');
  const zu = kontext.indexOf('⟧');
  if (auf < 0 || zu < 0) return null;

  const wort = kontext.slice(auf + 1, zu);
  let links = kontext.slice(Math.max(0, auf - VOR), auf);
  let rechts = kontext.slice(zu + 1, zu + 1 + NACH);

  if (auf - VOR > 0) links = '… ' + links.replace(/^\S*\s/, '');
  rechts = rechts.replace(/\s\S*$/, '') + (zu + 1 + NACH < kontext.length ? ' …' : '');

  return { vor: links.trimStart(), wort, nach: rechts.trimEnd() };
}

const roh = JSON.parse(readFileSync(QUELLE, 'utf8'));

const zitate = [];
for (const h of roh.hits) {
  if (h.verdict !== 'kevin' || !h.context) continue;
  const teil = ausschnitt(h.context);
  if (!teil) continue;
  const folge = (h.folgeTitel && h.folgeTitel.match(/\(#?(\d+)\)\s*$/)) || null;
  zitate.push({
    ...teil,
    de: h.de,
    zeit: h.time,
    folge: folge ? Number(folge[1]) : null,
    titel: (h.folgeTitel || '').replace(/\s*\(#?\d+\)\s*$/, ''),
    video: h.videoId,
    t: Math.max(0, Math.round(h.t - 4)),
  });
}

/* Kurze Fetzen ohne Umgebung tragen keinen Satz und wirken wie ein Fehler. */
const brauchbar = zitate.filter((z) => (z.vor + z.nach).length > 60);

/* Die Gegenprobe: Treffer, die belegt NICHT von Kevin stammen, sondern von
   Dominik oder einem Gast. Die zählen nirgends mit — aber sie zeigen, welche
   Wörter im selben Raum fielen, ohne dass Kevin sie je gesagt hat. */
const reezeZaehler = new Map();
for (const h of roh.hits) {
  if (h.verdict !== 'andere') continue;
  const da = reezeZaehler.get(h.es);
  if (da) da.count += 1;
  else reezeZaehler.set(h.es, { es: h.es, de: h.de, count: 1 });
}
const REEZE = [...reezeZaehler.values()].sort((a, b) => b.count - a.count || a.es.localeCompare(b.es));

const kopf = `/* Erzeugt von scripts/build-zitate.mjs — nicht von Hand ändern.
   ${brauchbar.length} Stellen im Wortlaut aus den Auto-Untertiteln, nur
   Treffer, die belegt von Kevin stammen. Dazu ${REEZE.length} Wörter, die
   belegt von Dominik oder einem Gast kamen. Stand: ${roh.stand}. */\n\n`;

writeFileSync(
  ZIEL,
  kopf
  + 'export const ZITATE = ' + JSON.stringify(brauchbar, null, 1) + ';\n\n'
  + 'export const REEZE = ' + JSON.stringify(REEZE, null, 1) + ';\n',
  'utf8'
);
console.log(`  ${brauchbar.length} Zitate, ${REEZE.length} Fremdwörter → src/lib/zitate.js`);
