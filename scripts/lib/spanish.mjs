/* Geteilt von extract.mjs und build-data.mjs:
   spanisches Lexikon + Übersetzungen, Untertitel-Parsing, yt-dlp-Helfer.

   Grundidee der Erkennung
   -----------------------
   Der Edeltalk ist ein DEUTSCHER Podcast. YouTube liefert die Original-
   Transkription (Auto-Untertitel `de` / `de-orig`) und maschinelle
   ÜBERSETZUNGEN in jede Sprache. Die spanische Übersetzung (`es`) ist eine
   Komplett-Übersetzung des deutschen Tons → nutzlos, um zu erkennen, ob Kevin
   wirklich Spanisch spricht. Wir nutzen deshalb NUR die deutsche
   Original-Spur und suchen darin nach eindeutig spanischen Wörtern.

   „Logisch richtig" heißt hier: KEINE deutschen Homographen zählen. Das alte
   Skript zählte u.a. das deutsche „mal" (4478×) als spanisch „schlecht" und
   dominierte damit die Charts. Die Whitelist unten enthält deshalb nur Wörter,
   die im Deutschen praktisch nie vorkommen (hola, gracias, burrito, tapas …).
*/

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

/* --------------------------------------------------------------------------
   Kuratiertes Lexikon mit ZWEI Ebenen (tier):

     tier 'real'     = echtes Spanisch. Begrüßungen, Ausdrücke, Übersetzungen,
                       Grammatik, Zahlen — Dinge, die zeigen, dass Kevin wirklich
                       SPANISCH SPRICHT. NUR das zählt als „Spanischkenntnis".

     tier 'lehnwort' = spanischstämmiges Essen/Kultur, das im Deutschen längst
                       ein Alltagswort ist (Burrito, Tapas, Tortilla, Tequila…).
                       Wenn Kevin „Tapas essen" sagt, spricht er KEIN Spanisch.
                       Wird separat gezeigt und zählt NICHT zur Spanischkenntnis.

   Kanonische (schön akzentuierte) Schreibweise → { de, tier, aliases }.
   `aliases` = weitere Schreibweisen (ohne Akzent, Plural, ASR-Verhörer).
   Deutsche Homographen (mal, no, so, si, uno, dia, grande, ole/Ole …) sind RAUS.
   -------------------------------------------------------------------------- */
const LEX = {
  // ===== tier 'real' — echtes Spanisch =====
  // Begrüßung & Höflichkeit
  'Hola':      { de: 'Hallo', tier: 'real' },
  'Adiós':     { de: 'Tschüss', tier: 'real', aliases: ['adios'] },
  'Gracias':   { de: 'Danke', tier: 'real' },
  'Perdón':    { de: 'Entschuldigung', tier: 'real', aliases: ['perdon'] },
  'Señor':     { de: 'Herr', tier: 'real', aliases: ['senor'] },
  'Señora':    { de: 'Frau', tier: 'real', aliases: ['senora'] },
  'Señorita':  { de: 'Fräulein', tier: 'real', aliases: ['senorita'] },
  'Amigo':     { de: 'Freund', tier: 'real', aliases: ['amigos'] },
  'Amiga':     { de: 'Freundin', tier: 'real', aliases: ['amigas'] },
  'Muchacho':  { de: 'Junge', tier: 'real' },
  // Sprache & Land
  'Español':   { de: 'Spanisch', tier: 'real', aliases: ['espanol'] },
  // Übersetzungen / Vokabeln, die Kevin bewusst benutzt
  'Gato':      { de: 'Katze', tier: 'real', aliases: ['gatto'] },
  'Perro':     { de: 'Hund', tier: 'real' },
  'Agua':      { de: 'Wasser', tier: 'real' },
  'Fuego':     { de: 'Feuer', tier: 'real' },
  // „Playa" bewusst NICHT: im Transkript nur in Strand-Eigennamen (Playa de la
  // Barceloneta …) — Ortsnamen, kein Vokabel-Können. Wie „Sagrada Familia".
  'Dinero':    { de: 'Geld', tier: 'real' },
  'Amor':      { de: 'Liebe', tier: 'real' },
  'Mañana':    { de: 'morgen', tier: 'real', aliases: ['manana'] },
  // Ausdrücke & Adjektive
  'Vamos':     { de: 'los / gehen wir', tier: 'real' },
  'Loco':      { de: 'verrückt', tier: 'real' },
  'Guapo':     { de: 'hübsch', tier: 'real' },
  // Zahlen (erst ab tres eindeutig; uno/dos zu ambig)
  'Tres':      { de: 'drei', tier: 'real' },
  'Cuatro':    { de: 'vier', tier: 'real' },
  'Cinco':     { de: 'fünf', tier: 'real', aliases: ['sinko'] },
  'Queso':     { de: 'Käse', tier: 'real', aliases: ['kesso'] },

  /* Vokabeln aus den Spanisch-Lektionen im Podcast (#344–#400). Gefunden mit
     scripts/audit-recall.mjs — die alte Whitelist konnte sie prinzipiell nicht
     sehen, weil sie nur Einzelwörter kannte, Kevin aber in Sätzen lernt.
     `aliases` fängt die ASR-Schreibweisen ab: die deutsche Spracherkennung
     schreibt „kero" für quiero, „disculper" für disculpe, „bonbona" für bombona. */
  'Quiero':      { de: 'ich möchte', tier: 'real', aliases: ['kero'] },
  'Quieres':     { de: 'möchtest du', tier: 'real' },
  'Tengo':       { de: 'ich habe', tier: 'real' },
  'Soy':         { de: 'ich bin', tier: 'real' },
  'Años':        { de: 'Jahre', tier: 'real', aliases: ['anos'] },
  'Veintinueve': { de: 'neunundzwanzig', tier: 'real', aliases: ['ventinueve'] },
  'Disculpe':    { de: 'Entschuldigen Sie', tier: 'real', aliases: ['disculper'] },
  'Bombona':     { de: 'Gasflasche', tier: 'real', aliases: ['bonbona', 'bombana', 'bombono'] },
  /* Zweiter Durchgang: gefunden über die Gegenprobe „wo wird im Podcast ÜBER
     Spanisch geredet?" (deutsche Stichwörter wie „auf Spanisch", „Vokabel",
     „Duolingo"). Diese Wörter fallen sowohl durch die Whitelist als auch durch
     den Dichte-Detektor, weil sie als EINZELNES Wort in deutschem Text stehen. */
  'Ayuda':       { de: 'Hilfe', tier: 'real' },
  'Bienvenidos': { de: 'Willkommen', tier: 'real' },
  /* `alemannia` ergänzt beim Fuzzy-Audit (scripts/audit-fuzzy.mjs) gefunden:
     In #399 zählt Kevin auf, was seine Anki-Stapel enthalten — „die Zahlen bis
     30, dann die Länder und wie die Leute da heißen". Die Erkennung schreibt
     alle drei Formen mit Doppel-n, deshalb sah der exakte Matcher nichts.
     Achtung: `alemannia` fällt zusätzlich zweimal im RIN-Interview, dort aber
     als deutsch-türkisches „Almanya" — das klärt die Sprecherprüfung. */
  'Alemania':    { de: 'Deutschland', tier: 'real', aliases: ['alemannia'] },
  'Alemán':      { de: 'Deutscher', tier: 'real', aliases: ['aleman', 'alemann'] },
  'Alemana':     { de: 'Deutsche', tier: 'real', aliases: ['alemanna'] },
  'Luna':        { de: 'Mond', tier: 'real' },
  // Wochentage — Kevin zählt sie in einer Folge auf, die ASR verhört sie.
  'Lunes':       { de: 'Montag', tier: 'real' },
  'Martes':      { de: 'Dienstag', tier: 'real', aliases: ['martis'] },
  'Miércoles':   { de: 'Mittwoch', tier: 'real', aliases: ['miercoles', 'mirculis'] },
  'Jueves':      { de: 'Donnerstag', tier: 'real', aliases: ['juevis'] },
  'Sábado':      { de: 'Samstag', tier: 'real', aliases: ['sabado'] },
  'Domingo':     { de: 'Sonntag', tier: 'real' },

  /* Folge #415 („Kopfhörer im Gulli") — die erste Folge seit #400 mit einem
     richtigen Spanisch-Block. Zwei Quellen darin:
     1. Kevin beschreibt auf Aufforderung („Sag mal auf Spanisch") die Bilder
        aus seiner Lektion → die Sätze stehen unten in PHRASES, `cicleta`
        (Kevins Kurzform von bicicleta) übersetzt er selbst mit „Fahrrad".
     2. Spanische Songs als Eselsbrücke — bailar/bailando, la gente está muy
        loca, muy caliente. Das ist Wortschatz aus Liedzeilen, kein Unterricht;
        wer im Wechsel was sagt, ist dort teils nicht auflösbar (→ verdict
        „unsicher" in podcast-hits.json). */
  'Bicicleta':   { de: 'Fahrrad', tier: 'real', aliases: ['cicleta'] },
  'Noche':       { de: 'Nacht', tier: 'real' },
  'Gente':       { de: 'Leute', tier: 'real' },
  'Muy':         { de: 'sehr', tier: 'real' },
  'Bailar':      { de: 'tanzen', tier: 'real' },
  'Bailando':    { de: 'tanzend', tier: 'real', aliases: ['beilando'] },

  /* Vierter Durchgang (2026-08-11), gefunden mit zwei NEUEN Prüfverfahren:
     (a) Nachbarschaft — seltene Tokens (Dokumentfrequenz ≤ 1 über alle 93
         Folgen) im Umkreis eines bekannten Treffers oder einer Spanisch-Stelle;
     (b) Wörterbuch-Gegenprobe — ein A1/A2-Grundwortschatz wird gegen den
         ganzen Korpus gehalten, statt im Text nach Auffälligkeiten zu suchen.
     Beide finden, was Dichte und Stichwörter prinzipiell nicht sehen können:
     ein EINZELNES spanisches Wort mitten im deutschen Satz. */
  'Nuevo':          { de: 'neu', tier: 'real' },              // #400, im Laden: „nee nee, Nuevo"
  'Dos':            { de: 'zwei', tier: 'real' },             // #399, „Sektion Uno, Sektion Dos"
  'Bueno':          { de: 'gut', tier: 'real' },              // #399, „Bueno heißt gut"
  'Colonia':        { de: 'Köln', tier: 'real', aliases: ['seolonia'] },
  'Vacaciones':     { de: 'Urlaub', tier: 'real', aliases: ['vaconis'] },
  'Estadounidense': { de: 'US-amerikanisch', tier: 'real', aliases: ['unidense'] },
  'Encantado':      { de: 'sehr erfreut', tier: 'real', aliases: ['enkado'] },
  'Ocho':           { de: 'acht', tier: 'real' },
  /* Fünfter Durchgang: gleiche Wörterbuch-Gegenprobe, nur mit einem doppelt so
     großen Wortschatz (A2/B1, Reise, Restaurant, Verbformen). */
  'Pagar':          { de: 'bezahlen', tier: 'real' },         // #400: „so Pagar, also so bezahlen"
  'Compañero':      { de: 'Kumpel', tier: 'real', aliases: ['companero'] },  // #381, Ausspracheübung
  'Disculpa':       { de: 'Entschuldigung', tier: 'real' },   // #400 — sagt der Verkäufer, nicht Kevin
  /* NICHT aufgenommen, obwohl im Korpus: „Estrella" (Biermarke), „Pueblo
     Espanyol" und „Playa …" (Ortsnamen), „Aire Fresco" (Songtitel), „patata"
     als Eigenname-Teil — dieselbe Regel wie bei „Sagrada Familia". */
  /* „Loca" bewusst NICHT als Einzelwort: einer von drei Treffern ist deutsches
     Gestammel („so 'ne Loca…", #341). Zählt nur in den Phrasen unten. */

  /* Bewusst NICHT als Einzelwörter, obwohl Kevin sie sagt:
     - „Ola": die ASR schreibt „Hola" oft ohne H — aber 2 der 4 Treffer sind
       eine PERSON namens Ola („Ilan und Ola"). Genau wie „Ole"/„Ole" raus.
     - „café": im Deutschen Alltagswort. 6 der 8 Treffer sind „im Café sitzen",
       nur 2 sind Kevins Satz. Zählt deshalb nur INNERHALB der Phrasen unten.
     - „té", „un", „una", „y", „o", „de", „mis": Funktionswörter/Fragmente, die
       massiv Fehltreffer erzeugen („edeltalk.de", die y-Achse aus der
       Mathe-Erklärung, „wir fahren los"). Ebenfalls nur in Phrasen. */

  // ===== tier 'lehnwort' — spanischstämmiges Essen/Kultur (zählt NICHT) =====
  // de = die wörtliche/eigentliche Bedeutung (nützt Wort-Anzeige + Mini-Test).
  'Burrito':   { de: 'kleiner Esel', tier: 'lehnwort', aliases: ['burritos'] },
  'Taco':      { de: 'Maisfladen', tier: 'lehnwort', aliases: ['tacos'] },
  'Tapas':     { de: 'Häppchen', tier: 'lehnwort' },
  'Tortilla':  { de: 'Omelett', tier: 'lehnwort', aliases: ['tortillas'] },
  'Paella':    { de: 'Reispfanne', tier: 'lehnwort' },
  'Nachos':    { de: 'Maischips', tier: 'lehnwort' },
  'Guacamole': { de: 'Avocadocreme', tier: 'lehnwort' },
  'Churros':   { de: 'Fettgebäck', tier: 'lehnwort' },
  'Chorizo':   { de: 'Paprikawurst', tier: 'lehnwort' },
  'Jamón':     { de: 'Schinken', tier: 'lehnwort', aliases: ['jamon'] },
  'Sangría':   { de: 'Weinbowle', tier: 'lehnwort', aliases: ['sangria'] },
  'Tequila':   { de: 'Agavenschnaps', tier: 'lehnwort' },
  'Mezcal':    { de: 'Agavenbrand', tier: 'lehnwort' },
  'Patatas':   { de: 'Kartoffeln', tier: 'lehnwort', aliases: ['patata'] },
  'Cerveza':   { de: 'Bier', tier: 'lehnwort' },
  'Siesta':    { de: 'Mittagsschlaf', tier: 'lehnwort' },
  'Sombrero':  { de: 'Hut', tier: 'lehnwort' },
  'Fiesta':    { de: 'Fest', tier: 'lehnwort' },
};

/* Mehrwort-Phrasen = starkes Signal für echtes Sprechen. Werden VOR den
   Einzelwörtern gematcht und aus dem Text ausgeblendet (kein Doppelzählen).
   `aliases` fängt ASR-Verhörer & akzentlose Schreibweisen ab. */
const PHRASES = {
  /* Ganze Sätze aus den Spanisch-Lektionen. Das ist der stärkste Beleg dafür,
     dass Kevin wirklich SPRICHT und nicht nur ein Wort einstreut.
     ACHTUNG Reihenfolge: längere Phrasen müssen VOR den kürzeren stehen, die in
     ihnen enthalten sind — der Matcher blendet Treffer aus, wer zuerst kommt,
     gewinnt. „Quiero un café y un té" also vor „Quiero un café". */
  'Quiero un café y un té':  { de: '„Ich möchte einen Kaffee und einen Tee."', tier: 'real', aliases: ['quiero un cafe y un te'] },
  'Quieres un café o un té': { de: '„Möchtest du einen Kaffee oder einen Tee?"', tier: 'real', aliases: ['quieres un cafe o un te'] },
  'Tengo veintinueve años':  { de: '„Ich bin 29 Jahre alt."', tier: 'real', aliases: ['tengo veintinueve anos', 'tengo ventinueve años', 'tengo ventinueve anos'] },
  'Disculpe señora':         { de: '„Entschuldigen Sie, gnädige Frau"', tier: 'real', aliases: ['disculper senora', 'disculpe senora'] },
  'Bombona de gas':          { de: 'Gasflasche', tier: 'real', aliases: ['bonbona de gas', 'bombana de gas'] },
  'Quiero un café':          { de: '„Ich möchte einen Kaffee."', tier: 'real', aliases: ['quiero un cafe'] },
  'Quiero un té':            { de: '„Ich möchte einen Tee."', tier: 'real', aliases: ['quiero un te'] },
  'Mis amigos':              { de: 'meine Freunde', tier: 'real' },

  /* #344 — die ERSTEN eigenen Sätze überhaupt, direkt aus der Duolingo-App
     („wenn meine Duolingo-App nicht lügt"). Die ASR schreibt durchgehend
     „voy" statt „soy"; die App lehrt „Yo soy Kevin", also ist das die
     kanonische Form und „io voy" die Verhörung. Längere Variante zuerst. */
  'Yo soy Kevin':            { de: '„Ich bin Kevin."', tier: 'real', aliases: ['io voy kevin', 'yo voy kevin', 'voy kevin'] },
  'Soy de Alemania':         { de: '„Ich komme aus Deutschland."', tier: 'real', aliases: ['voy de alemania', 'soy de alemania'] },
  'Yo soy':                  { de: '„ich bin"', tier: 'real' },
  /* #400 — im Laden nach dem Grill gefragt; er sagt es selbst an: „ich habe
     glaube ich gesagt Donest da und dann habe ich gesagt, wo ist der Grill". */
  'Dónde está':              { de: '„Wo ist …?"', tier: 'real', aliases: ['donde esta', 'donest da'] },
  /* #388 — auf die Frage „Wie heißt du?" führt er den Satz vor. */
  'Cómo te llamas':          { de: '„Wie heißt du?"', tier: 'real', aliases: ['como te llamas', 'komteamas'] },

  /* #415: Kevins Bildbeschreibung aus der Lektion, wörtlich so gesagt (inkl.
     seiner Fehler — „un cicleta", „segunda foto"). Genau das ist der Beleg,
     dass er selbst formuliert, statt Vokabeln aufzusagen. */
  'Primero foto es un cicleta':     { de: '„Das erste Foto ist ein Fahrrad."', tier: 'real' },
  'Y un segunda foto es no cicleta': { de: '„Und das zweite Foto ist kein Fahrrad."', tier: 'real' },
  /* #415, 52:53 — beim Nachprüfen der letzten drei Folgen gefunden. Kevin
     erzählt, dass er in der Lektion Interviews über Madrid geguckt und sie aus
     dem Kontext verstanden hat, und sagt dann den Ausdruck selbst. Die
     Spracherkennung schreibt „La Vive de la Noche"; ohne diesen Eintrag zerfiel
     der Satz in die Einzelteile La / de / la / Noche und stand als vier
     zusammenhanglose Fragmente in der Wortliste. */
  'La vida de la noche':     { de: 'das Nachtleben', tier: 'real', aliases: ['la vive de la noche'] },
  /* #415: Liedzeilen, die im Podcast übersetzt werden. Längere vor kürzeren. */
  'La gente está muy loca':  { de: '„Die Leute sind verrückt." (Liedzeile)', tier: 'real', aliases: ['la gente esta muy loca'] },
  'Muy loca':                { de: 'sehr verrückt', tier: 'real' },
  'Muy caliente':            { de: 'sehr scharf', tier: 'real' },

  /* `olla kital` aus #407: „Herzlich willkommen zum Edeltalk zusammen mit
     Dominik und Jo. Jo. Olla Kital Freunde, was geht ab?" — dieselbe Begrüssung,
     nur bis zur Unkenntlichkeit verhört. Genau solche Formen findet keine
     Alias-Liste von allein, sondern nur die Fuzzy-Suche. */
  'Hola qué tal':   { de: '„Hallo, wie geht’s?“', tier: 'real', aliases: ['hola que tal', 'hola ketal', 'olla kital'] },
  'Qué tal':        { de: '„Wie geht’s?“', tier: 'real', aliases: ['que tal', 'ketal'] },
  'Por favor':      { de: 'bitte', tier: 'real', aliases: ['porfavor'] },
  'Muchas gracias': { de: 'vielen Dank', tier: 'real' },
  'Buenos días':    { de: 'guten Morgen', tier: 'real', aliases: ['buenos dias'] },
  'Buenas noches':  { de: 'gute Nacht', tier: 'real' },
  'Cómo estás':     { de: 'wie geht es dir', tier: 'real', aliases: ['como estas'] },
  'Muy bien':       { de: 'sehr gut', tier: 'real' },
  'Hasta luego':    { de: 'bis später', tier: 'real' },
  'De nada':        { de: 'keine Ursache', tier: 'real' },
  'Lo siento':      { de: 'tut mir leid', tier: 'real' },
  'No sé':          { de: 'ich weiß nicht', tier: 'real', aliases: ['no se'] },
  'Me llamo':       { de: 'ich heiße', tier: 'real' },
  'Un poco':        { de: 'ein bisschen', tier: 'real' },

  /* Lehnwort-Ebene: Cocktailname, im Deutschen Alltagswort (#403, #415). */
  'Piña colada':    { de: 'gesiebte Ananas', tier: 'lehnwort', aliases: ['pina colada'] },

  /* `wenn die nueve` aus #398 (16.08.2026 ergänzt). Kevin sagt dort: „das
     Unangenehmste in meinen 29 Jahren oder wie wir Spanier sagen würden,
     [veintinueve] años." YouTube hat die Auto-Untertitel dieser Folge im
     August 2026 neu erzeugt: vorher stand da „Ventinueve" (vom Alias in LEX
     erfasst), jetzt der deutsche Verhörer „wenn die nueve". Ohne diesen
     Eintrag fällt „Veintinueve" komplett aus der Wortliste, obwohl die
     Tonspur unverändert ist — dieselbe Lage wie bei `olla kital` in #407.

     Warum hier unten in PHRASES und nicht als Alias in LEX: der Verhörer geht
     über drei Tokens, und LEX-Aliasse werden Token für Token aufgelöst.
     Muss NACH „Tengo veintinueve años" stehen, sonst zerlegt dieser Eintrag
     die längere Phrase. Die Wortfolge kommt genau einmal im ganzen Korpus vor
     (228 Transkripte geprüft), ist also eindeutig. */
  'Veintinueve':    { de: 'neunundzwanzig', tier: 'real', aliases: ['wenn die nueve'] },
};

/* --------------------------------------------------------------------------
   Thematische Gruppen.

   Warum: 24 der 37 Wörter kommen genau EINMAL vor. Nach Häufigkeit sortiert
   ergibt das eine endlose Liste identischer 1×-Zeilen — die Zahl trägt dort
   keine Information mehr. Thematisch gruppiert erzählen dieselben Daten dagegen
   etwas: dass Kevin die Wochentage am Stück gelernt hat, dass es einen ganzen
   Block ums Bestellen gibt. Die Gruppe ist die Aussage, nicht der Balken.

   Was hier nicht steht, landet in 'vokabel'.
   -------------------------------------------------------------------------- */
export const KATEGORIEN = [
  { key: 'gruss',      label: 'Begrüßen & Höflichkeit', hint: 'Womit alles anfing, und wo es bei den meisten aufhört.' },
  { key: 'vorstellen', label: 'Sich vorstellen',        hint: 'Name, Herkunft, Alter. Der erste zusammenhängende Satz.' },
  { key: 'bestellen',  label: 'Etwas bestellen',        hint: 'Im Café, im Laden, an der Gasflaschen-Theke.' },
  { key: 'beschreiben', label: 'Aus dem Unterricht',    hint: 'Die Aufgaben der Lektion: zwei Fotos beschreiben, ein Interview verstehen.' },
  { key: 'wochentag',  label: 'Die Wochentage',         hint: 'In einer einzigen Folge gelernt, teils falsch aufgesagt.' },
  { key: 'song',       label: 'Aus spanischen Songs',   hint: 'Kevins eigene Methode: Liedzeilen als Eselsbrücke.' },
  { key: 'vokabel',    label: 'Einzelne Vokabeln',      hint: 'Aufgeschnappt, übersetzt, meist genau einmal gesagt.' },
  { key: 'baustein',   label: 'Satzbausteine',          hint: 'Artikel und kleine Wörter. Zählen nur innerhalb eines spanischen Satzes.' },
];

const KAT_OF = {};
for (const [key, list] of Object.entries({
  gruss: ['Hola', 'Adiós', 'Gracias', 'Perdón', 'Señor', 'Señora', 'Señorita', 'Bienvenidos',
    'Hola qué tal', 'Qué tal', 'Buenos días', 'Buenas noches', 'Cómo estás', 'Muy bien',
    'Hasta luego', 'De nada', 'Lo siento', 'Muchas gracias', 'Por favor', 'Mis amigos',
    'Disculpe', 'Disculpe señora'],
  vorstellen: ['Soy', 'Tengo', 'Años', 'Veintinueve', 'Alemania', 'Alemán', 'Alemana', 'Yo soy',
    'Tengo veintinueve años', 'Me llamo', 'Yo soy Kevin', 'Soy de Alemania',
    'Cómo te llamas', 'Colonia', 'Vacaciones', 'Estadounidense'],
  bestellen: ['Quiero', 'Quieres', 'Bombona', 'Bombona de gas', 'Quiero un café y un té',
    'Quiero un té', 'Quieres un café o un té', 'Un poco', 'No sé',
    'Dónde está', 'Nuevo', 'Encantado', 'Pagar'],
  wochentag: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Sábado', 'Domingo'],
  beschreiben: ['Primero foto es un cicleta', 'Y un segunda foto es no cicleta', 'Bicicleta',
    'La vida de la noche'],
  song: ['La gente está muy loca', 'Muy loca', 'Muy caliente', 'Bailar', 'Bailando',
    'Gente', 'Muy', 'Noche'],
})) for (const w of list) KAT_OF[w.toLowerCase()] = key;

/* Gruppe eines kanonischen Worts/einer Phrase. */
export function katFor(word) {
  return KAT_OF[String(word).toLowerCase()] || 'vokabel';
}

/* --------------------------------------------------------------------------
   Echte Edeltalk-Folgennummer aus dem Titel.

   Der Kanal benutzt drei Schreibweisen, historisch gewachsen:
     „Kopfhörer im Gulli (#415)"                 → geklammert, neuere Folgen
     „Kevin hat das Lesen verlernt - Edeltalk #295"
     „… teure Spa's - EDELTALK 242"              → ganz alte, ohne Raute

   Die zweite und dritte Form kannte der Parser nicht; diese Folgen liefen
   deshalb unter ihrem chronologischen Index statt unter ihrer echten Nummer.

   Zwei Fallen, an denen eine naive Regex scheitert: „Der große Edeltalk
   Jahresrückblick 2023" und „EDELTALK TOUR: … // München 2023" enden beide auf
   eine Jahreszahl. Deshalb muss die Zahl UNMITTELBAR auf „Edeltalk" folgen und
   darf höchstens dreistellig sein — Folgennummern liegen bei 1 bis 415,
   Jahreszahlen sind vierstellig und fallen von selbst raus.
   -------------------------------------------------------------------------- */
export function epNum(title) {
  const t = String(title).trim();
  const klammer = t.match(/\(#?(\d{2,4})\)\s*$/);
  if (klammer) return Number(klammer[1]);
  const nachname = t.match(/edeltalk\s*#?\s*(\d{1,3})\s*$/i);
  if (nachname) return Number(nachname[1]);
  return null;
}

/* Titel ohne den Nummern-Anhang, für die Anzeige. */
export function cleanTitle(title) {
  return String(title)
    .replace(/\s*\(#?\d{2,4}\)\s*$/, '')
    .replace(/\s*[-–—/|]*\s*edeltalk\s*#?\s*\d{1,3}\s*$/i, '')
    .trim();
}

/* Alias/kanonisch (klein) → kanonische Anzeige-Schreibweise. */
export const CANON = new Map();
/* Kanonisch (klein) → deutsche Übersetzung. */
export const ES_DE = {};
/* Kanonisch (klein) → 'real' | 'lehnwort'. */
export const TIER = new Map();
for (const [canon, { de, tier = 'real', aliases = [] }] of Object.entries(LEX)) {
  const key = canon.toLowerCase();
  CANON.set(key, canon);
  ES_DE[key] = de;
  TIER.set(key, tier);
  for (const a of aliases) CANON.set(a.toLowerCase(), canon);
}
/* Phrasen: [kanonisch, [alle Schreibweisen klein], de, tier] */
const PHRASE_LIST = Object.entries(PHRASES).map(([canon, { de, tier = 'real', aliases = [] }]) => {
  const key = canon.toLowerCase();
  ES_DE[key] = de;
  TIER.set(key, tier);
  return { canon, variants: [key, ...aliases.map((a) => a.toLowerCase())] };
});

/* Alle erkennbaren Einzel-Tokens (klein, inkl. Aliasse). */
export const SPANISH = new Set(CANON.keys());

/* tier-Lookup für ein kanonisches Wort/Phrase. */
export function tierFor(word) {
  const canon = CANON.get(String(word).toLowerCase());
  const key = (canon || word).toLowerCase();
  return TIER.get(key) || 'real';
}

/* --------------------------------------------------------------------------
   yt-dlp
   -------------------------------------------------------------------------- */
function getYtDlpPath() {
  const candidates = [
    join(homedir(), 'AppData', 'Local', 'Python', 'pythoncore-3.14-64', 'Scripts', 'yt-dlp.exe'),
    join(homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python314', 'Scripts', 'yt-dlp.exe'),
    'yt-dlp',
  ];
  for (const p of candidates) {
    if (p === 'yt-dlp' || existsSync(p)) return p;
  }
  return 'yt-dlp';
}
const YT_DLP = getYtDlpPath();

/* yt-dlp gibt auf Windows sonst cp1252 aus → Umlaute/Akzente werden zu „�".
   PYTHONIOENCODING=utf-8 erzwingt saubere UTF-8-Ausgabe. */
const YT_ENV = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };

export function have(cmd) {
  const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', env: YT_ENV });
  return r.status === 0;
}

/* --------------------------------------------------------------------------
   VTT/SRT → sauberer Fließtext
   YouTube-Auto-VTT wiederholt jede Zeile ~3× (getimte <c>-Zeile + zwei
   „gesettelte" Klartext-Wiederholungen). Wir nehmen bevorzugt die getimte
   Spur (enthält jedes Wort genau einmal) und deduplizieren zusätzlich
   aufeinanderfolgende identische Zeilen.
   -------------------------------------------------------------------------- */
export function toPlainText(raw) {
  const lines = String(raw).split(/\r?\n/);
  const hasTimed = lines.some((l) => /<\d{2}:\d{2}:\d{2}\.\d{3}>/.test(l));
  const out = [];
  let last = '';
  for (let line of lines) {
    line = line.trim();
    if (!line || line === 'WEBVTT') continue;
    if (line.startsWith('Kind:') || line.startsWith('Language:')) continue;
    if (/^\d+$/.test(line)) continue;        // SRT-Index
    if (/-->/.test(line)) continue;          // Timestamps-Zeile
    // Wenn eine getimte Spur existiert, nur diese Zeilen nehmen (dedupliziert von selbst).
    if (hasTimed && !/<\d{2}:\d{2}:\d{2}\.\d{3}>/.test(line)) continue;
    line = line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line || line === last) continue;    // aufeinanderfolgende Duplikate
    last = line;
    out.push(line);
  }
  return out.join(' ');
}

/* --------------------------------------------------------------------------
   VTT → Cues MIT Zeitstempel: [{ t, text }] (t = Sekunden ab Videostart).
   Gleiche Dedup-Logik wie `toPlainText`, aber die Startzeit jedes Blocks
   bleibt erhalten — nötig, um für jeden Treffer einen YouTube-Link mit
   `&t=` und den Gesprächskontext zu bauen.
   -------------------------------------------------------------------------- */
export function toCues(raw) {
  const lines = String(raw).split(/\r?\n/);
  const hasTimed = lines.some((l) => /<\d{2}:\d{2}:\d{2}\.\d{3}>/.test(l));
  const cues = [];
  let cur = null;   // Startzeit des laufenden Blocks
  let last = '';
  for (let line of lines) {
    line = line.trim();
    if (!line || line === 'WEBVTT') continue;
    if (line.startsWith('Kind:') || line.startsWith('Language:')) continue;
    if (/^\d+$/.test(line)) continue;
    const ts = line.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->/);
    if (ts) { cur = +ts[1] * 3600 + +ts[2] * 60 + +ts[3]; continue; }
    if (hasTimed && !/<\d{2}:\d{2}:\d{2}\.\d{3}>/.test(line)) continue;
    line = line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line || line === last) continue;
    last = line;
    cues.push({ t: cur ?? 0, text: line });
  }
  return cues;
}

/* --------------------------------------------------------------------------
   VTT → Wörter MIT eigenem Zeitstempel.

   YouTube-Auto-Untertitel enthalten die Zeit für JEDES Wort einzeln:
     Herzlich<00:00:00.399><c> willkommen</c><00:00:01.000><c> zum</c>
   `toCues` wirft diese Marken weg und kennt nur den Blockanfang. Ein Block
   dauert aber bis zu vier Sekunden — deshalb lagen die Soundboard-Clips daneben.
   Hier wird pro Wort die echte Zeit übernommen.
   -------------------------------------------------------------------------- */
export function toTimedWords(raw) {
  const lines = String(raw).split(/\r?\n/);
  const out = [];
  let cueStart = 0;
  let last = '';

  for (let line of lines) {
    line = line.trim();
    if (!line || line === 'WEBVTT') continue;
    if (line.startsWith('Kind:') || line.startsWith('Language:')) continue;

    const ts = line.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->/);
    if (ts) { cueStart = +ts[1] * 3600 + +ts[2] * 60 + +ts[3] + +ts[4] / 1000; continue; }

    // Nur die getimte Spur nehmen; die Klartext-Wiederholungen ignorieren.
    if (!/<\d{2}:\d{2}:\d{2}\.\d{3}>/.test(line)) continue;
    const plain = line.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!plain || plain === last) continue;
    last = plain;

    /* <c>/</c> vorher entfernen. Ohne das griff die Regex nach dem „<" den
       Rest ab und „/c>" landete als Wort im Text. */
    const rein = line.replace(/<\/?c(?:\.[^>]*)?>/g, '');

    let cur = cueStart;
    const re = /<(\d{2}):(\d{2}):(\d{2})\.(\d{3})>|([^<]+)/g;
    let m;
    while ((m = re.exec(rein))) {
      if (m[1] !== undefined) {
        cur = +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
      } else {
        for (const w of (m[5].match(/\S+/g) || [])) out.push({ w, t: cur });
      }
    }
  }
  return out;
}

/* --------------------------------------------------------------------------
   VTT → Cue-BLÖCKE mit Anfang UND Ende: [{ t, ende, text }].

   Unterschied zu `toCues`: dort ist jede Textzeile ein eigener Eintrag und die
   Millisekunden fallen weg. Für die Soundboard-Clips brauchen wir beides —
   die Blockgrenze (t…ende) und die volle Genauigkeit —, weil die Zeit der
   einzelnen Wörter darin interpoliert wird.

   `toCues` bleibt deshalb unverändert: scan-channels.mjs baut seine Schlüssel
   aus Zeichen-Offsets dieses Textes; würde sich die Textzusammensetzung ändern,
   verlören alle handgesetzten Sprecher-Urteile ihren Anker.
   -------------------------------------------------------------------------- */
export function toCueBlocks(raw) {
  const lines = String(raw).split(/\r?\n/);
  const hasTimed = lines.some((l) => /<\d{2}:\d{2}:\d{2}\.\d{3}>/.test(l));
  const out = [];
  let von = null, bis = null, buf = [], last = '';

  const schliessen = () => {
    const text = buf.join(' ').trim();
    buf = [];
    if (von !== null && text) out.push({ t: von, ende: bis ?? von + 2, text });
  };

  for (let line of lines) {
    line = line.trim();
    if (!line || line === 'WEBVTT') continue;
    if (line.startsWith('Kind:') || line.startsWith('Language:')) continue;
    if (/^\d+$/.test(line)) continue;
    const ts = line.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
    if (ts) {
      schliessen();
      von = +ts[1] * 3600 + +ts[2] * 60 + +ts[3] + +ts[4] / 1000;
      bis = +ts[5] * 3600 + +ts[6] * 60 + +ts[7] + +ts[8] / 1000;
      continue;
    }
    if (hasTimed && !/<\d{2}:\d{2}:\d{2}\.\d{3}>/.test(line)) continue;
    line = line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line || line === last) continue;
    last = line;
    buf.push(line);
  }
  schliessen();
  return out;
}

/* --------------------------------------------------------------------------
   Ein Wort → das Zeitfenster, in dem es BELEGT fällt: { w, t, bis }.

   Zwei Sorten Untertitel liegen im Kanal, und der Unterschied war der Grund,
   warum viele Soundboard-Knöpfe danebenlagen:

     wortgenau — jedes Wort trägt seine eigene Marke (<00:12:03.400>). Fenster
                 = diese Marke bis zur Marke des nächsten Worts. Auf Zehntel
                 genau; `genau: true`.

     Block     — nur Anfang und Ende eines Cue-Blocks mit im Schnitt sieben
                 Wörtern in rund zwei Sekunden. WO im Block ein Wort fällt,
                 steht nirgends. Vorher bekam jedes Wort des Blocks den
                 Blockanfang als Zeit und endete 0,8 s später — beim letzten
                 Wort eines Blocks war der Clip damit vorbei, bevor das Wort
                 überhaupt fiel. Jetzt ist das Fenster der GANZE Block: nicht
                 die schärfste Angabe, aber eine, die das Wort garantiert
                 enthält. Raten wäre hier schlimmer als großzügig sein.

   Beide Male gilt: t…bis enthält das Wort. Darauf verlässt sich `clipFenster`.
   -------------------------------------------------------------------------- */
export function toWordTimes(raw) {
  const wortgenau = toTimedWords(raw);
  if (wortgenau.length >= 20) {
    return {
      genau: true,
      words: wortgenau.map(({ w, t }, i) => ({ w, t, bis: wortgenau[i + 1]?.t ?? t + 1 })),
    };
  }

  const words = [];
  for (const c of toCueBlocks(raw)) {
    for (const w of c.text.match(/\S+/g) || []) words.push({ w, t: c.t, bis: c.ende });
  }
  return { words, genau: false };
}

/* --------------------------------------------------------------------------
   Treffer → abspielbares Fenster fürs Soundboard.

   t…tEnde enthält das Wort bereits (siehe `toWordTimes`); hier kommt nur der
   Vor- und Nachlauf dazu, damit der Wortanfang nicht angeschnitten klingt und
   YouTube Zeit hat, sauber an die Stelle zu springen.

   Steht hier und nicht in build-data.mjs, damit scripts/audit-clips.mjs
   dasselbe Fenster prüft, das auch ausgeliefert wird.
   -------------------------------------------------------------------------- */
export function clipFenster(hit) {
  const eng = hit.genau === true;
  return {
    start: Math.max(0, hit.t - (eng ? 0.7 : 0.6)),
    ende: (hit.tEnde ?? hit.t + 2) + (eng ? 0.9 : 0.6),
    eng,
  };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* --------------------------------------------------------------------------
   Findet jeden Spanisch-Treffer MIT Position im Text.
   → [{ canon, tier, start, end }] (aufsteigend nach start).

   Erst Mehrwort-Phrasen (die dann längentreu ausgeblendet werden, damit ihre
   Einzelwörter nicht doppelt zählen), dann Einzelwörter. Weil das Ausblenden
   die Länge erhält, bleiben alle Offsets gültig für den ORIGINALTEXT
   (normalisiert via `normalizeForScan`).
   -------------------------------------------------------------------------- */
export function normalizeForScan(text) {
  return String(text).normalize('NFC');
}

/* --------------------------------------------------------------------------
   Satzbausteine: zählen NUR im spanischen Satz.

   Das Problem, das sie lösen: In Folge #400 sagt Kevin „kero una bombona de
   gas … grande grande". Gezählt wurde davon bisher nur „quiero" und „bombona",
   weil un/una/de/grande als Einzelwörter im Deutschen zu viele Fehltreffer
   erzeugen (UNO-Kartenspiel, „edeltalk.de", „Rio Grande").

   Regel: ein Baustein zählt nur, wenn innerhalb von ANKER_FENSTER Zeichen ein
   unstrittiger spanischer Treffer steht. Im deutschen Fließtext steht dort
   keiner, im spanischen Satz immer.
   -------------------------------------------------------------------------- */
const BAUSTEINE = {
  un: 'ein', una: 'eine', uno: 'eins', unos: 'einige', unas: 'einige',
  el: 'der', la: 'die', las: 'die', del: 'vom', al: 'zum',
  y: 'und', o: 'oder', de: 'von', con: 'mit', sin: 'ohne',
  por: 'für', para: 'für', en: 'in',
  grande: 'groß', pequeño: 'klein', mucho: 'viel', mucha: 'viel',
  mi: 'mein', mis: 'meine', su: 'sein',
  aquí: 'hier', ahora: 'jetzt', hoy: 'heute', más: 'mehr',
};
/* Nachträglich WIEDER RAUSGEWORFEN, weil die Ankerregel sie nicht rettet:
   - „los": deutsches Alltagswort („was ist los", „fahren wir los"). Beide
     bisher gezählten Treffer waren genau das, nur zufällig neben einem
     spanischen Anker.
   - „tu": deutscher Imperativ („tu das mal"). */
/* Bewusst NICHT dabei: es, no, so, man, die, der, das, am, in — die sind auch
   im Deutschen zu häufig, da würde selbst die Ankerregel nicht reichen. */
const ANKER_FENSTER = 90;   // Zeichen links und rechts

export const BAUSTEIN_SET = new Set(Object.keys(BAUSTEINE));
/* Eigene Gruppe, sonst stehen „Uno" und „De" zwischen den echten Vokabeln.
   Steht hier und nicht oben bei KAT_OF, weil BAUSTEINE erst hier existiert. */
for (const w of BAUSTEIN_SET) KAT_OF[w] = 'baustein';
for (const [w, de] of Object.entries(BAUSTEINE)) {
  const key = w.toLowerCase();
  if (!CANON.has(key)) {
    CANON.set(key, w.charAt(0).toUpperCase() + w.slice(1));
    ES_DE[key] = de;
    TIER.set(key, 'real');
  }
}

export function matchSpanish(text) {
  const hits = [];
  let low = normalizeForScan(text).toLowerCase();

  // 1) Phrasen
  for (const { canon, variants } of PHRASE_LIST) {
    for (const v of variants) {
      const re = new RegExp('(?<![\\p{L}])' + escapeRe(v) + '(?![\\p{L}])', 'giu');
      low = low.replace(re, (m, off) => {
        hits.push({ canon, tier: tierFor(canon), start: off, end: off + m.length });
        return ' '.repeat(m.length);
      });
    }
  }

  /* 2) Einzelwörter. Bausteine kommen erst in den Korb, wenn ein Anker steht.

     Die Zeichenklasse muss ALLE Buchstaben enthalten, auch die deutschen.
     Vorher stand hier `[a-zñáéíóúü]+`: ohne ä, ö und ß zerfiel jedes deutsche
     Wort mit diesen Zeichen in Bruchstücke, und die trafen dann auf die
     spanischen Funktionswörter — „heißen" wurde zu „hei"+„en" (Treffer „en"),
     „Käo" zu „k"+„o" (Treffer „o"). Beide standen als gezählte Nennungen in
     data.js. Mit \p{L} bleibt jedes Wort ein Token. */
  const bausteine = [];
  const re = /[\p{L}]+/gu;
  let m;
  while ((m = re.exec(low))) {
    const canon = CANON.get(m[0]);
    if (!canon) continue;
    const treffer = { canon, tier: tierFor(canon), start: m.index, end: m.index + m[0].length };
    if (BAUSTEIN_SET.has(m[0])) { treffer.baustein = true; bausteine.push(treffer); }
    else hits.push(treffer);
  }

  // 3) Anker sind alle bisherigen Treffer (Phrasen + eindeutige Einzelwörter).
  const anker = hits.map((h) => h.start).sort((a, b) => a - b);
  if (anker.length) {
    for (const b of bausteine) {
      // nächstgelegenen Anker per Binärsuche finden
      let lo = 0, hi = anker.length - 1, nah = Infinity;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        nah = Math.min(nah, Math.abs(anker[mid] - b.start));
        if (anker[mid] < b.start) lo = mid + 1; else hi = mid - 1;
      }
      if (nah <= ANKER_FENSTER) hits.push(b);
    }
  }

  return hits.sort((a, b) => a.start - b.start);
}

/* --------------------------------------------------------------------------
   Zählt Spanisch → Map(kanonischeAnzeige → count).
   -------------------------------------------------------------------------- */
export function countSpanish(text) {
  const counts = new Map();
  for (const h of matchSpanish(text)) counts.set(h.canon, (counts.get(h.canon) || 0) + 1);
  return counts;
}

/* --------------------------------------------------------------------------
   Alle Spanisch-Treffer eines VTT MIT Zeitstempel, Kontext und stabilem Key.
   Von scan-channels.mjs und scan-podcast.mjs gemeinsam genutzt: beide brauchen
   dieselbe Vorlage für die Sprecher-Prüfung von Hand.
   -------------------------------------------------------------------------- */
export function hitsWithContext(vtt, { id, ctxChars = 300 } = {}) {
  /* Text aus den EINZELWORT-Zeiten aufbauen: so zeigt jeder Zeichen-Offset auf
     das Wort, das dort steht, und damit auf dessen echte Sekunde.

     NICHT jede Folge hat wortgenaue Marken — ältere Auto-Untertitel liefern nur
     Blöcke. `toWordTimes` fängt beide Fälle ab und sagt über `genau`, wie
     verlässlich die Sekunde ist. Ohne diesen Rückfall lieferten die Block-
     Folgen gar keine Treffer mehr (120 → 56). */
  const { words, genau } = toWordTimes(vtt);

  const starts = [];
  let text = '';
  for (const { w, t, bis } of words) {
    starts.push({ off: text.length, t, bis });
    text += (text ? ' ' : '') + w;
  }
  text = normalizeForScan(text);

  /* Das Wort, in dem Zeichen-Offset `idx` liegt: letzter Wortanfang <= idx. */
  const wortBei = (idx) => {
    let lo = 0, hi = starts.length - 1, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid].off <= idx) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return starts[best];
  };
  const hhmmss = (sec) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  };

  /* Schlüssel OHNE Zeichen-Offset: „das n-te Vorkommen dieses Worts in diesem
     Video". Der Offset änderte sich, sobald der Parser sich änderte — dabei
     gingen einmal alle handgesetzten Sprecher-Urteile verloren. Die Reihenfolge
     der Vorkommen bleibt dagegen stabil. */
  const lfd = new Map();
  return matchSpanish(text).map((h) => {
    /* Ein Treffer kann mehrere Wörter lang sein („Yo soy Kevin") und dabei über
       eine Cue-Grenze laufen. Deshalb Anfang vom ERSTEN und Ende vom LETZTEN
       Wort des Treffers nehmen — nicht vom Wort danach, das kann nach einer
       Sprechpause beliebig weit weg liegen. */
    const erstes = wortBei(h.start);
    const letztes = wortBei(h.end - 1);
    const t = erstes?.t ?? 0;
    const n = (lfd.get(h.canon) || 0) + 1;
    lfd.set(h.canon, n);
    return {
      key: `${id}|${h.canon}#${n}`,
      videoId: id,
      t,
      /* Belegtes Ende. Zwölf Sekunden Deckel, damit ein kaputter Untertitel
         nicht einen Clip von Minutenlänge erzeugt. */
      tEnde: Math.min(Math.max(t + 0.8, letztes?.bis ?? t + 1), t + 12),
      /* Wortgenaue Marke oder nur der Cue-Block? Steuert den Vor-/Nachlauf. */
      genau,
      time: hhmmss(t),
      link: `https://www.youtube.com/watch?v=${id}&t=${Math.max(0, t - 4)}`,
      es: h.canon,
      de: deFor(h.canon) || '',
      tier: h.tier,
      ...(h.baustein ? { baustein: true } : {}),
      context: `${text.slice(Math.max(0, h.start - ctxChars), h.start)}⟦${text.slice(h.start, h.end)}⟧${text.slice(h.end, h.end + ctxChars)}`,
    };
  });
}

export function deFor(word) {
  const key = String(word).toLowerCase();
  const canon = CANON.get(key);
  return canon ? ES_DE[canon.toLowerCase()] : (ES_DE[key] || '');
}

export function titleCase(word) {
  const canon = CANON.get(String(word).toLowerCase());
  return canon || (word.charAt(0).toUpperCase() + word.slice(1));
}

/* --------------------------------------------------------------------------
   Untertitel eines Videos holen.
   Nimmt die deutsche ORIGINAL-Spur (de-orig bevorzugt, sonst de/de-DE).
   Gibt { text, ok } zurück.
   -------------------------------------------------------------------------- */
export function fetchSubs(url) {
  const dir = mkdtempSync(join(tmpdir(), 'kev-subs-'));
  try {
    // Ein Aufruf: schreibt die de-Untertitel UND druckt Metadaten (--no-simulate
    // nötig, weil --print sonst in den Simulationsmodus schaltet).
    // `de.*` fängt ALLE deutschen Spuren ab: de-orig, de, de-DE und — wichtig
    // für ältere Folgen — den rohen ASR-Code (de--<id> / de-de--<id>). Ohne den
    // Wildcard scheiterten früher ~die Hälfte der älteren Folgen an
    // „no subtitles for the requested languages", obwohl Captions existieren.
    const r = spawnSync(YT_DLP, [
      '--skip-download', '--no-simulate',
      '--write-auto-subs', '--write-subs',
      '--sub-langs', 'de.*',
      '--sub-format', 'vtt', '--convert-subs', 'vtt',
      '--print', 'META\t%(upload_date)s\t%(duration)s\t%(title)s',
      '-o', join(dir, '%(id)s.%(ext)s'), url,
    ], { encoding: 'utf8', env: YT_ENV, timeout: 120000, maxBuffer: 64 * 1024 * 1024 });

    // Metadaten aus der META-Zeile ziehen.
    let uploadDate = null, duration = null, title = null;
    const metaLine = String(r.stdout || '').split('\n').find((l) => l.startsWith('META\t'));
    if (metaLine) {
      const [, ud, dur, ...rest] = metaLine.trim().split('\t');
      uploadDate = ud && ud !== 'NA' ? ud : null;
      duration = Number(dur) || null;
      title = rest.join('\t').trim() || null;
    }

    const vtts = readdirSync(dir).filter((f) => f.endsWith('.vtt'));
    if (!vtts.length) {
      if (r.stderr) console.error(`     ${r.stderr.split('\n').filter(Boolean).slice(-1)[0] || ''}`);
      return { text: '', ok: false, uploadDate, duration, title };
    }
    // Beste Spur wählen (nur EINE, sonst zählen wir doppelt):
    //   de-orig > de (plain) > de-DE > de--<id> (roher ASR) > de-de--<id> > erste.
    const pick =
      vtts.find((f) => /\.de-orig\.vtt$/.test(f)) ||
      vtts.find((f) => /\.de\.vtt$/.test(f)) ||
      vtts.find((f) => /\.de-DE\.vtt$/.test(f)) ||
      vtts.find((f) => /\.de--[^.]+\.vtt$/.test(f)) ||
      vtts.find((f) => /\.de-de--[^.]+\.vtt$/.test(f)) ||
      vtts.find((f) => /\.de[.-][^.]*\.vtt$/.test(f)) ||
      vtts[0];
    const text = readFileSync(join(dir, pick), 'utf8');
    return { text, ok: text.trim().length > 0, uploadDate, duration, title };
  } catch (err) {
    console.error(`  ❌ Untertitel-Fehler: ${err.message}`);
    return { text: '', ok: false, uploadDate: null, duration: null, title: null };
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* egal */ }
  }
}

/* --------------------------------------------------------------------------
   Playlist/Kanal → [{ id, title, duration, url }] (neueste zuerst).
   Umlaute korrekt dank PYTHONIOENCODING.
   -------------------------------------------------------------------------- */
export function fetchPlaylist(url, limit = 60) {
  if (!have(YT_DLP)) {
    console.error('❌ yt-dlp fehlt. Installieren:  python -m pip install -U yt-dlp');
    process.exit(1);
  }
  console.error('… hole Videoliste via yt-dlp …');
  const r = spawnSync(YT_DLP, [
    '--flat-playlist', '--playlist-items', `1-${limit}`,
    '--print', '%(id)s\t%(duration)s\t%(title)s',
    '--skip-download', url,
  ], { encoding: 'utf8', env: YT_ENV, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error('❌ Playlist konnte nicht geladen werden:', r.stderr?.slice(0, 400));
    process.exit(1);
  }
  return String(r.stdout).trim().split('\n').filter(Boolean).map((line) => {
    const [id, duration, ...rest] = line.split('\t');
    return {
      id,
      duration: Number(duration) || null,
      title: rest.join('\t').trim(),
      url: `https://www.youtube.com/watch?v=${id}`,
    };
  });
}

/* Volle Metadaten eines Videos (Upload-Datum) — leichter Einzelabruf. */
export function fetchMeta(url) {
  const r = spawnSync(YT_DLP, [
    '--skip-download', '--print', '%(upload_date)s\t%(duration)s\t%(title)s', url,
  ], { encoding: 'utf8', env: YT_ENV, maxBuffer: 16 * 1024 * 1024, timeout: 60000 });
  if (r.status !== 0) return { uploadDate: null, duration: null, title: null };
  const [uploadDate, duration, ...rest] = String(r.stdout).trim().split('\t');
  return {
    uploadDate: uploadDate && uploadDate !== 'NA' ? uploadDate : null,
    duration: Number(duration) || null,
    title: rest.join('\t').trim() || null,
  };
}
