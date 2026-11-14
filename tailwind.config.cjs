/** Tailwind-Konfiguration
 *  ----------------------
 *  Stand vorher als `tailwind.config = {...}` inline in index.html, direkt
 *  neben <script src="https://cdn.tailwindcss.com">. Dieser CDN-Build ist der
 *  "Play"-Build: er bringt den kompletten Compiler mit (407 kB, 126 kB gzip)
 *  und erzeugt das CSS erst im Browser bei jedem Seitenaufruf. Tailwind sagt
 *  in der eigenen Doku, dass das nicht in Produktion gehoert — es kostet mehr
 *  als die ganze App und die Seite steht bis zum Ende des Laufs ungestylt da.
 *
 *  Jetzt wird das CSS beim Build erzeugt (npm run build -> styles.css).
 *  Der Inhalt hier ist unveraendert aus index.html uebernommen.
 */
module.exports = {
  darkMode: 'class',

  /* app.js ist bewusst dabei: das ist das gebaute Bundle, in dem alle
     Klassennamen als Zeichenketten stehen. Wenn der Scanner nur src/ liest
     und dort eine Klasse anders zusammengesetzt wird, faellt sie raus und
     die Stelle bleibt ungestylt. Beides zu lesen kostet nur ein paar
     ungenutzte Regeln, aber nie eine fehlende. */
  content: [
    './index.html',
    './app.js',
    './src/**/*.{js,jsx}',
  ],

  theme: {
    extend: {
      fontFamily: {
        sans: ['"Schibsted Grotesk"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"Martian Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        cloud: 'rgb(var(--cloud) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--ink-soft) / <alpha-value>)',
        hair: 'rgb(var(--hair) / <alpha-value>)',
        apple: 'rgb(var(--apple) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)',
        no: 'rgb(var(--no) / <alpha-value>)',
      },
      letterSpacing: { tightest: '-0.035em' },
    },
  },
};
