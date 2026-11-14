/* Anki-style deck parsing, persistence and a sample deck.

   Supported import formats:
   - Plain text / TSV / CSV  (Tab, Semicolon, Comma or Pipe separated)
   - Spaced separators too: „vorne - hinten", „vorne = hinten", „vorne :: hinten", „vorne → hinten"
   - Anki text export with #-directives (#separator:, #html:, #columns: …)
   - CSV with quoted fields ("a, b";back)
   - Markdown tables (| Vorne | Hinten |)
   - HTML tables (<tr><td>…)
   - Excel .xlsx (first two columns)
   - JSON  ([{front,back}], [[front,back]], {cards:[…]}, {notes:[…]})
   - .apkg / .colpkg  (real Anki packages, unzipped, SQLite read via sql.js)

   Everything runs client-side; nothing is uploaded. */

import { unzipSync } from 'fflate';
import initSqlJs from 'sql.js';

const STORAGE_KEY = 'kevin.es.anki.deck.v1';
const FIELD_SEP = String.fromCharCode(0x1f); // Anki joins note fields with U+001F

export const SUPPORTED_HINT = '.txt · .csv · .tsv · .md · .xlsx · .html · .json · .apkg';

export const SAMPLE_DECK = [
  { front: 'Hola', back: 'Hallo' },
  { front: 'Gracias', back: 'Danke' },
  { front: 'Por favor', back: 'Bitte' },
  { front: 'Cerveza', back: 'Bier' },
  { front: '¿Qué?', back: 'Was?' },
  { front: 'Buenos días', back: 'Guten Morgen' },
  { front: 'Amigo', back: 'Freund' },
  { front: 'Agua', back: 'Wasser' },
  { front: 'Sí', back: 'Ja' },
  { front: 'Burrito', back: 'kleiner Esel (wörtlich)' },
];

/* ---------- helpers ---------- */

function stripHtml(s) {
  if (s == null) return '';
  let t = String(s)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '');
  t = t
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return t.replace(/\s+/g, ' ').trim();
}

function resolveSeparator(v) {
  const map = { tab: '\t', '\\t': '\t', comma: ',', semicolon: ';', pipe: '|', space: ' ' };
  const k = String(v).toLowerCase().trim();
  if (map[k]) return map[k];
  if (v && v.length === 1) return v;
  return '\t';
}

/* Split one line by a separator, honouring "quoted" fields for comma/semicolon. */
function splitLine(line, sep) {
  if (sep !== ',' && sep !== ';') return line.split(sep);
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/* ---------- text / csv / tsv ---------- */

export function parseText(text) {
  if (!text) return [];
  const lines = String(text).split(/\r?\n/);
  let sep = null;
  const dataLines = [];

  for (const raw of lines) {
    const line = raw.replace(/^﻿/, '');
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) {
      const m = /^#separator:\s*(.+)$/i.exec(trimmed);
      if (m) sep = resolveSeparator(m[1]);
      continue; // skip all directive / comment lines
    }
    dataLines.push(line);
  }

  if (!sep) {
    const probe = dataLines.find((l) => l.trim()) || '';
    if (probe.includes('\t')) sep = '\t';
    else if (probe.includes(';')) sep = ';';
    else if (probe.includes('|')) sep = '|';
    else if (probe.includes(',')) sep = ',';
  }
  // Kein Einzelzeichen-Trenner? Dann greift unten der Spaced-Separator-Fallback.

  const cards = [];
  for (const line of dataLines) {
    if (!line.trim()) continue;
    let parts;
    if (sep) {
      parts = splitLine(line, sep).map(stripHtml);
    } else {
      // Kein Einzelzeichen-Trenner: auf einen umschlossenen „ - / = / :: / → " splitten.
      const m = line.match(/^(.*?)\s+(?:::|=>|→|–|—|=|-)\s+(.*)$/);
      if (!m) continue;
      parts = [stripHtml(m[1]), stripHtml(m[2])];
    }
    const front = (parts[0] || '').trim();
    const back = parts.slice(1).join(' ').trim();
    if (front && back) cards.push({ front, back });
  }
  return cards;
}

/* ---------- markdown table ---------- */

export function parseMarkdown(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim());
  const isSep = (l) => /-/.test(l) && /^\|?[\s:|-]+\|?$/.test(l);
  const cards = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith('|')) continue;
    if (isSep(l)) continue;
    if (lines[i + 1] && isSep(lines[i + 1])) continue; // Kopfzeile überspringen
    const cells = l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => stripHtml(c.trim()));
    const front = (cells[0] || '').trim();
    const back = cells.slice(1).join(' ').trim();
    if (front && back) cards.push({ front, back });
  }
  return cards;
}

/* ---------- html table ---------- */

export function parseHtml(text) {
  const cards = [];
  if (typeof DOMParser === 'undefined') return cards;
  try {
    const doc = new DOMParser().parseFromString(String(text), 'text/html');
    for (const tr of doc.querySelectorAll('tr')) {
      const cells = tr.querySelectorAll('td, th');
      if (cells.length < 2) continue;
      const front = stripHtml(cells[0].innerHTML);
      const back = stripHtml(cells[1].innerHTML);
      if (front && back && front.toLowerCase() !== 'front' && front.toLowerCase() !== 'vorne') {
        cards.push({ front, back });
      }
    }
  } catch (e) { /* ignore */ }
  return cards;
}

/* ---------- xlsx (zip of XML) ---------- */

function xmlEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function colIndex(ref) {
  const m = /^([A-Z]+)/.exec(ref || '');
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function parseXlsx(arrayBuffer) {
  const files = unzipSync(new Uint8Array(arrayBuffer));
  const dec = new TextDecoder();

  const shared = [];
  if (files['xl/sharedStrings.xml']) {
    const xml = dec.decode(files['xl/sharedStrings.xml']);
    for (const si of xml.match(/<si\b[\s\S]*?<\/si>/g) || []) {
      const parts = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => xmlEntities(m[1]));
      shared.push(parts.join(''));
    }
  }

  const sheetName =
    Object.keys(files).find((n) => n === 'xl/worksheets/sheet1.xml') ||
    Object.keys(files).find((n) => /^xl\/worksheets\/.*\.xml$/.test(n));
  if (!sheetName) return [];
  const xml = dec.decode(files[sheetName]);

  const cards = [];
  for (const rowXml of xml.match(/<row\b[\s\S]*?<\/row>/g) || []) {
    const cells = [];
    for (const cm of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cm[1], body = cm[2];
      const ref = (/r="([A-Z]+\d+)"/.exec(attrs) || [])[1] || '';
      const t = (/t="([^"]+)"/.exec(attrs) || [])[1];
      const vm = /<v[^>]*>([\s\S]*?)<\/v>/.exec(body);
      const is = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body);
      let val = '';
      if (t === 's' && vm) val = shared[Number(vm[1])] || '';
      else if (t === 'inlineStr' && is) val = xmlEntities(is[1]);
      else if (vm) val = xmlEntities(vm[1]);
      cells[colIndex(ref)] = stripHtml(val);
    }
    const front = (cells[0] || '').trim();
    const back = (cells.slice(1).find((c) => c && c.trim()) || '').trim();
    if (front && back && front.toLowerCase() !== 'front' && front.toLowerCase() !== 'vorne') {
      cards.push({ front, back });
    }
  }
  return cards;
}

/* ---------- json ---------- */

export function parseJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return [];
  }
  const cards = [];
  const push = (f, b) => {
    const front = stripHtml(f);
    const back = stripHtml(b);
    if (front && back) cards.push({ front, back });
  };
  const arr = Array.isArray(data)
    ? data
    : Array.isArray(data.cards)
    ? data.cards
    : Array.isArray(data.notes)
    ? data.notes
    : [];
  for (const it of arr) {
    if (Array.isArray(it)) push(it[0], it[1]);
    else if (it && typeof it === 'object') {
      const f = it.front ?? it.q ?? it.question ?? it.term ?? it.vorne ?? (it.fields && it.fields[0]);
      const b = it.back ?? it.a ?? it.answer ?? it.definition ?? it.hinten ?? (it.fields && it.fields[1]);
      push(f, b);
    }
  }
  return cards;
}

/* Text or JSON — auto-detected. Used for paste + text files. */
export function parseAny(text) {
  const t = (text || '').trim();
  if (t.startsWith('[') || t.startsWith('{')) {
    const j = parseJson(text);
    if (j.length) return j;
  }
  return parseText(text);
}

/* Backwards-compatible alias. */
export const parseDeck = parseAny;

/* ---------- .apkg (zip + SQLite) ---------- */

let _sqlPromise = null;
function getSQL() {
  if (!_sqlPromise) _sqlPromise = initSqlJs({ locateFile: () => 'sql-wasm.wasm' });
  return _sqlPromise;
}

export async function parseApkg(arrayBuffer) {
  const files = unzipSync(new Uint8Array(arrayBuffer));
  const names = Object.keys(files);

  if (names.includes('collection.anki21b')) {
    throw new Error(
      'Dieses Paket stammt aus einer neueren Anki-Version (komprimiert). Bitte in Anki über „Datei → Exportieren → Notizen als Text (.txt)“ exportieren.'
    );
  }

  const dbName =
    names.find((n) => n === 'collection.anki21') ||
    names.find((n) => n === 'collection.anki2') ||
    names.find((n) => /\.anki2?1?$/.test(n));
  if (!dbName) throw new Error('Keine Anki-Datenbank im Paket gefunden.');

  const SQL = await getSQL();
  const db = new SQL.Database(files[dbName]);
  const cards = [];
  try {
    const res = db.exec('SELECT flds FROM notes');
    if (res && res[0]) {
      for (const row of res[0].values) {
        const flds = String(row[0]).split(FIELD_SEP);
        const front = stripHtml(flds[0] || '');
        const back = stripHtml(flds.slice(1).join(' ') || '');
        if (front && back) cards.push({ front, back });
      }
    }
  } finally {
    db.close();
  }
  return cards;
}

/* Dispatch a File to the right parser. Returns Promise<card[]>. */
export async function parseFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.apkg') || name.endsWith('.colpkg')) {
    return parseApkg(await file.arrayBuffer());
  }
  if (name.endsWith('.xlsx')) {
    return parseXlsx(await file.arrayBuffer());
  }
  const text = await file.text();
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    const c = parseHtml(text);
    if (c.length) return c;
  }
  if (name.endsWith('.md') || name.endsWith('.markdown')) {
    const c = parseMarkdown(text);
    if (c.length) return c;
  }
  return parseAny(text);
}

/* ---------- deck management ---------- */

export function mergeDeck(existing, incoming) {
  const seen = new Set(existing.map((c) => c.front.toLowerCase()));
  const merged = existing.slice();
  for (const c of incoming) {
    const key = c.front.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(c);
    }
  }
  return merged;
}

export function loadDeck() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    const arr = s ? JSON.parse(s) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

export function saveDeck(cards) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch (e) {}
}

export function clearStoredDeck() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
