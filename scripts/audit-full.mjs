#!/usr/bin/env node
/* Volldurchlauf-Audit über ALLE Folgen im Cache
   --------------------------------------------
   Sucht spanische Wörter, die das kuratierte Lexikon in lib/spanish.mjs noch
   nicht kennt. Ergänzt audit-recall.mjs (Dichte + deutsche Stichwörter) um zwei
   Verfahren, die einzelne Wörter finden — genau die, an denen die anderen
   beiden prinzipbedingt vorbeilaufen.

   Vier Signale, die zu einer Punktzahl verrechnet werden:

     1. WÖRTERBUCH   Ein A1–B2-Grundwortschatz wird gegen den Korpus gehalten.
                     Findet alles, was tatsächlich Spanisch ist — aber auch
                     deutsche und englische Gleichschreiber („Mar", „leer",
                     „come", „Metro"). Deshalb die drei folgenden Filter.

     2. NACHBARSCHAFT Steht der Kandidat im Umkreis eines BEKANNTEN Treffers?
                     Wer „bailando" sagt, sagt daneben eher „bailar" als
                     zufällig ein deutsches Wort. Stärkstes Einzelsignal.

     3. STICHWORT    Steht in der Nähe eine deutsche Stelle, an der über
                     Spanisch geredet wird („auf Spanisch", „heißt", „Vokabel")?
                     Dort steht das spanische Wort meist mit Übersetzung daneben.

     4. KETTE        Zwei oder mehr Wörterbuch-Treffer direkt hintereinander.
                     Das ist kein eingestreutes Wort mehr, das ist ein Satz —
                     und Sätze sind der stärkste Beleg dafür, dass jemand
                     wirklich spricht. Werden separat ausgegeben.

   Gegen Gleichschreiber hilft zusätzlich die Dokumentfrequenz: ein Wort, das in
   80 von 228 Folgen vorkommt, ist deutsch. Echtes Spanisch ist selten und
   klumpt in wenigen Folgen.

   Das Skript ZÄHLT NICHTS und ändert keine Daten. Es legt Fundstellen zum
   Nachlesen vor; was ins Lexikon wandert, wird von Hand entschieden.

   Nutzung:
     node scripts/audit-full.mjs                # Top 60 Kandidaten
     node scripts/audit-full.mjs --top 150
     node scripts/audit-full.mjs --ketten       # nur die Wortketten
     node scripts/audit-full.mjs --wort ayuda   # alle Stellen eines Worts
*/

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { toPlainText, matchSpanish, SPANISH, BAUSTEIN_SET, ES_DE, epNum } from './lib/spanish.mjs';

/* Alles, was die Daten bereits kennen: Einzelwörter und ihre Aliasse (SPANISH),
   die Satzbausteine, und jedes Token, das in einer Mehrwort-Phrase steckt.
   Ohne den dritten Teil meldet das Audit „primero", „segunda" und „caliente" als
   Fund, obwohl sie längst als Teil ganzer Sätze gezählt werden. */
const BEKANNT = new Set([...SPANISH, ...BAUSTEIN_SET]);
for (const k of Object.keys(ES_DE)) for (const t of k.split(/\s+/)) if (t) BEKANNT.add(t);

const CACHE_DIR = join(tmpdir(), 'kevin-es-cache');
const CHANNEL_HITS = join(process.cwd(), 'scripts', 'data', 'channel-hits.json');
const PODCAST_HITS = join(process.cwd(), 'scripts', 'data', 'podcast-hits.json');

const args = process.argv.slice(2);
const TOP = args.includes('--top') ? Number(args[args.indexOf('--top') + 1]) || 60 : 60;
const NUR_KETTEN = args.includes('--ketten');
const WORT = args.includes('--wort') ? String(args[args.indexOf('--wort') + 1] || '').toLowerCase() : null;

/* --------------------------------------------------------------------------
   Grundwortschatz Spanisch A1–B2.
   Bewusst DRAUSSEN: alles, was im Deutschen genauso geschrieben wird (in, so,
   was, die, der, den, ist, an, am, um, hat, kann, man, mal, no, si, wie) und
   die englischen Gleichschreiber, die im Podcast dauernd fallen (come, no,
   real, total, final, actual, general).
   -------------------------------------------------------------------------- */
const DICT = `
hola adios adiós gracias perdon perdón disculpe disculpa senor señor senora señora
senorita señorita amigo amiga amigos amigas buenos buenas dias días noches tardes
llamo llamas llama nombre apellido gusto encantado mucho mucha muchos muchas
soy eres somos sois son estoy estas estás esta está estamos estan están fui era
tengo tienes tiene tenemos tienen tuve habia había hay haya
quiero quieres quiere queremos quieren queria quería quisiera
puedo puedes puede podemos pueden podria podría
hablo hablas habla hablamos hablan hablar hablando hablado
entiendo entiendes entiende entender comprendo sabe sabes saber sabía
conozco conoces conocer voy vas vamos van ido venir vengo vienes viene
hacer hago haces hace hecho comer como comes comiendo bebo bebes beber
tomar tomo tomas toma tomando vivir vivo vives vive viviendo
trabajo trabajas trabaja trabajar estudio estudias estudia estudiar
comprar compro compras compra comprando pagar pago pagas paga
vender vendo vendes querer amar amo amas gustar gusta gustan encanta
casa calle ciudad pueblo pais país mundo tierra cielo mar playa montana montaña
campo bosque rio río lago isla puente parque plaza jardin jardín
agua vino cerveza cafe café leche pan queso carne pescado pollo arroz fruta
manzana naranja platano plátano huevo huevos sopa ensalada postre helado
azucar azúcar sal aceite mantequilla desayuno almuerzo cena comida bebida
perro gato caballo pajaro pájaro raton ratón vaca cerdo oveja pez pescar
hombre mujer nino niño nina niña chico chica hijo hija padre madre hermano hermana
abuelo abuela tio tío tia tía primo prima esposo esposa novio novia
libro mesa silla puerta ventana cama coche carro tren avion avión barco
bicicleta moto autobus autobús taxi metro camion camión
dinero tiempo hora minuto segundo semana mes ano año años dia día días
lunes martes miercoles miércoles jueves viernes sabado sábado domingo
enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre
primavera verano otono otoño invierno frio frío calor caliente lluvia nieve sol luna
rojo verde azul amarillo negro blanco gris rosado morado
grande pequeno pequeño alto bajo largo corto nuevo viejo joven bueno buena
malo mala mejor peor bonito bonita feo fea facil fácil dificil difícil
rapido rápido lento fuerte debil débil listo lista
feliz triste contento contenta enfadado cansado enfermo sano loco loca
guapo guapa hermoso hermosa maravilloso increible increíble
uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce
quince dieciseis dieciséis diecisiete dieciocho diecinueve veinte veintiuno
treinta cuarenta cincuenta sesenta setenta ochenta noventa cien ciento
mil millon millón primero primera segundo segunda tercero tercera ultimo último
donde dónde cuando cuándo cuanto cuánto quien quién porque porqué
siempre nunca ahora luego despues después antes hoy manana mañana ayer
temprano tarde pronto todavia todavía ya
aqui aquí alli allí ahi ahí cerca lejos dentro fuera arriba abajo
izquierda derecha delante detras detrás encima debajo
tambien también tampoco pero aunque entonces ademas además claro
gente persona familia escuela universidad profesor maestro estudiante alumno
medico médico hospital farmacia tienda mercado supermercado restaurante hotel
banco correo aeropuerto estacion estación museo iglesia castillo
fiesta musica música cancion canción baile bailar bailando canto cantar cantante
amor vida muerte suerte verdad mentira problema pregunta respuesta ayuda
salud dolor cabeza mano pie ojo ojos boca nariz oreja pelo cuerpo corazon corazón
brazo pierna dedo diente espalda
abierto cerrado lleno vacio vacío limpio sucio caro barato gratis
entrar salir subir bajar abrir cerrar empezar terminar esperar buscar encontrar
llevar traer dar recibir poner quitar mirar oir oír escuchar leer escribir
dormir despertar levantar sentar correr caminar andar viajar volar nadar
ganar perder jugar juego ayudar necesito necesita necesitas
espanol español ingles inglés aleman alemán frances francés italiano
espana españa alemania francia italia inglaterra mexico méxico argentina colombia
peru perú chile cuba brasil portugal madrid barcelona sevilla valencia
foto fotos vacaciones viaje maleta pasaporte billete boleto entrada llave
ropa camisa pantalon pantalón zapato zapatos sombrero abrigo vestido falda
trabajo oficina empresa jefe companero compañero reunion reunión
telefono teléfono ordenador computadora pantalla teclado internet correo
palabra frase idioma lengua letra numero número pagina página
cosa cosas algo alguien nada nadie todo todos toda todas
poco poca mucho bastante demasiado menos mas más
querido querida gracias favor lastima lástima ojala ojalá venga vale
`.trim().split(/\s+/).filter(Boolean);
const DICTSET = new Set(DICT);

/* Deutsche/englische Gleichschreiber, die trotz Kuratierung durchrutschen.
   Alle einzeln im Kontext geprüft und als Rauschen bestätigt. */
const RAUSCHEN = new Set(`
mar leer come comes metro mayo total real final general super mama papa
banana pizza taxi hotel radio video studio auto foto motor moment
ok okay bar tour star hobby party baby lady body
`.trim().split(/\s+/));

/* Deutsche Stellen, an denen über Spanisch geredet wird. */
const CUES = [
  'auf spanisch', 'spanische', 'spanisch', 'espanol', 'español',
  'duolingo', 'vokabel', 'lektion', 'sprachkurs', 'heißt', 'heisst', 'bedeutet',
  'übersetzt', 'ubersetzt', 'lehrer',
];

if (!existsSync(CACHE_DIR)) {
  console.error(`Kein Untertitel-Cache unter ${CACHE_DIR}.`);
  process.exit(1);
}

/* Kanal-Videos aussortieren, hier geht es nur um den Podcast. */
const kanalIds = new Set();
if (existsSync(CHANNEL_HITS)) {
  try {
    for (const v of JSON.parse(readFileSync(CHANNEL_HITS, 'utf8')).videos || []) kanalIds.add(v.id);
  } catch { /* egal */ }
}
const titelVon = new Map();
if (existsSync(PODCAST_HITS)) {
  try {
    for (const f of JSON.parse(readFileSync(PODCAST_HITS, 'utf8')).folgen || []) titelVon.set(f.id, f.title);
  } catch { /* egal */ }
}

const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith('.vtt') && !kanalIds.has(f.replace(/\.vtt$/, '')));

const NAH = 160;        // Zeichen-Radius für Nachbarschaft und Stichwort
const kandidaten = new Map();   // wort -> { treffer: [], folgen:Set }
const ketten = [];

for (const f of files) {
  const id = f.replace(/\.vtt$/, '');
  const text = toPlainText(readFileSync(join(CACHE_DIR, f), 'utf8')).normalize('NFC');
  const low = text.toLowerCase();

  /* Positionen der bereits BEKANNTEN Treffer — die Anker für Signal 2. */
  const anker = matchSpanish(text).map((h) => h.start);

  /* Positionen der deutschen Stichwörter — Signal 3. */
  const cuePos = [];
  for (const c of CUES) {
    let i = 0;
    while ((i = low.indexOf(c, i)) !== -1) { cuePos.push(i); i += c.length; }
  }

  const nahBei = (pos, liste) => liste.some((p) => Math.abs(p - pos) <= NAH);

  const toks = [...text.matchAll(/[\p{L}áéíóúüñÁÉÍÓÚÑ]+/gu)];
  let kette = [];

  for (let k = 0; k < toks.length; k++) {
    const m = toks[k];
    const w = m[0].toLowerCase();
    const istDict = DICTSET.has(w) && !RAUSCHEN.has(w);

    /* Signal 4: Ketten aus Wörterbuch-Treffern (bekannt ODER unbekannt),
       die direkt nebeneinander stehen. */
    if (istDict || BEKANNT.has(w)) {
      const vorher = kette.length ? kette[kette.length - 1] : null;
      if (!vorher || m.index - (vorher.index + vorher[0].length) <= 3) kette.push(m);
      else { if (kette.length >= 3) ketten.push({ id, toks: kette }); kette = [m]; }
    } else {
      if (kette.length >= 3) ketten.push({ id, toks: kette });
      kette = [];
    }

    if (!istDict || BEKANNT.has(w)) continue;   // die Daten kennen es schon

    if (!kandidaten.has(w)) kandidaten.set(w, { treffer: [], folgen: new Set() });
    const e = kandidaten.get(w);
    e.folgen.add(id);
    if (e.treffer.length < 40) {
      e.treffer.push({
        id,
        pos: m.index,
        ankerNah: nahBei(m.index, anker),
        cueNah: nahBei(m.index, cuePos),
        snip: text.slice(Math.max(0, m.index - 150), m.index + 190).replace(/\s+/g, ' '),
      });
    }
  }
  if (kette.length >= 3) ketten.push({ id, toks: kette });
}

const folgeVon = (id) => {
  const t = titelVon.get(id);
  const n = t ? epNum(t) : null;
  return n ? `#${n}` : id;
};

/* ---------- Ausgabe: Ketten ---------- */
if (NUR_KETTEN) {
  console.log(`${files.length} Folgen, ${ketten.length} Wortketten aus 3+ spanischen Tokens:\n`);
  const seen = new Set();
  for (const k of ketten) {
    const s = k.toks.map((t) => t[0]).join(' ');
    if (seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    console.log(`── ${folgeVon(k.id)}  „${s}"`);
  }
  process.exit(0);
}

/* ---------- Ausgabe: alle Stellen EINES Worts ---------- */
if (WORT) {
  const e = kandidaten.get(WORT);
  if (!e) { console.log(`„${WORT}" kommt im Korpus nicht vor (oder steht schon im Lexikon).`); process.exit(0); }
  console.log(`„${WORT}": ${e.treffer.length} Stellen in ${e.folgen.size} Folgen\n`);
  for (const t of e.treffer) {
    console.log(`── ${folgeVon(t.id)}${t.ankerNah ? '  [neben bekanntem Spanisch]' : ''}${t.cueNah ? '  [neben Spanisch-Stichwort]' : ''}`);
    console.log(`   …${t.snip}…\n`);
  }
  process.exit(0);
}

/* ---------- Ausgabe: Rangliste ---------- */
const bewertet = [...kandidaten.entries()].map(([w, e]) => {
  const anker = e.treffer.filter((t) => t.ankerNah).length;
  const cue = e.treffer.filter((t) => t.cueNah).length;
  /* Streuung: in vielen Folgen verteilt = eher deutsches Wort.
     Geklumpt in wenigen Folgen = eher echtes Spanisch. */
  const streuung = e.folgen.size / Math.max(1, e.treffer.length);
  const punkte = anker * 5 + cue * 2 + (e.treffer.length <= 6 ? 2 : 0) - streuung * 3
    - (e.folgen.size > 12 ? 8 : 0);
  return { w, e, anker, cue, punkte };
}).sort((a, b) => b.punkte - a.punkte);

console.log(`Folgen im Korpus: ${files.length}`);
console.log(`Wörterbuch-Kandidaten ausserhalb des Lexikons: ${bewertet.length}`);
console.log(`Wortketten (3+ Tokens): ${ketten.length}   →  node scripts/audit-full.mjs --ketten\n`);
console.log(`Die ${Math.min(TOP, bewertet.length)} aussichtsreichsten:\n`);

for (const b of bewertet.slice(0, TOP)) {
  const marken = [
    b.anker ? `${b.anker}× neben bekanntem Spanisch` : null,
    b.cue ? `${b.cue}× neben Stichwort` : null,
  ].filter(Boolean).join(', ');
  console.log(`### ${b.w}  (${b.e.treffer.length}× in ${b.e.folgen.size} Folgen)${marken ? '  — ' + marken : ''}`);
  const zeigen = [...b.e.treffer].sort((x, y) => (y.ankerNah + y.cueNah) - (x.ankerNah + x.cueNah)).slice(0, 2);
  for (const t of zeigen) console.log(`   [${folgeVon(t.id)}] …${t.snip}…`);
  console.log();
}

console.log('Alle Stellen eines Worts:  node scripts/audit-full.mjs --wort <wort>');
