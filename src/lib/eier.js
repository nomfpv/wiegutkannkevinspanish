/* Eastereggs — nur der Schalter.
 *
 * Aus ist der Normalfall, und zwar mit Absicht: Die Seite ist ein trockener
 * Statistikbericht, der Witz lebt davon, dass sie sich ernst nimmt. Der
 * Auslöser ist deshalb unbeschriftet — der Punkt in der Wortmarke „kevin.es"
 * im Fußbereich (`EierPunkt`). Solange er aus ist, hängt kein Listener am
 * Fenster und es steht kein Knoten im DOM.
 */

const KEY = 'kevin.es.eier';
const KEY_MODI = 'kevin.es.eier.modi';

let an = (() => {
  try { return localStorage.getItem(KEY) === 'an'; } catch { return false; }
})();

/* Zwei Betriebsarten, die die ganze Seite betreffen und deshalb nicht in einen
   einzelnen Abschnitt gehören. Sie liegen hier, damit Fußleiste und Ebene
   dieselbe Quelle lesen. */
let modi = (() => {
  try { return { uebersetzer: false, zensur: false, ...JSON.parse(localStorage.getItem(KEY_MODI) || '{}') }; }
  catch { return { uebersetzer: false, zensur: false }; }
})();

const hoerer = new Set();
function melden() { hoerer.forEach((fn) => fn()); }

export function eierAn() { return an; }

export function setEierAn(wert) {
  an = !!wert;
  try { localStorage.setItem(KEY, an ? 'an' : 'aus'); } catch { /* privater Modus */ }
  melden();
}

export function modus(name) { return !!modi[name]; }

export function setModus(name, wert) {
  modi = { ...modi, [name]: !!wert };
  try { localStorage.setItem(KEY_MODI, JSON.stringify(modi)); } catch { /* egal */ }
  melden();
}

export function abonniere(fn) {
  hoerer.add(fn);
  return () => hoerer.delete(fn);
}
