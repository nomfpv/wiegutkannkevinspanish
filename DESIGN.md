# Design

Visual system for **kevin.es** — a clean, deadpan, data-sheet-style Spanish-vocabulary tracker. Design serves a dry, factual voice: the numbers and their source (the podcast) are the hero. React + Tailwind (CDN), theme-token driven, light + dark.

## Overview

- **Feel:** editorial statistics report, not a streamer dashboard. Restrained one-accent colour strategy; typography and data do the talking.
- **Themes:** light + dark, driven by CSS variables on `:root` / `.dark`. Initial theme set pre-paint (no flash); toggle persists to `localStorage`; OS preference is the default. Theme switch does a coordinated colour cross-fade.

## Color

Tokens are CSS variables exposed to Tailwind as `rgb(var(--x) / <alpha-value>)` (`index.html`). Never hard-code hex in components; use `bg-*` / `text-*` / `border-*` token utilities.

| Token | Light | Dark | Role |
|---|---|---|---|
| `bg` | `#ffffff` | `#0c0d0f` | page base (dark = near-black, not pitch black) |
| `cloud` | `#f4f4f6` | `#121316` | alternating section band |
| `card` | `#ffffff` | `#1a1b1f` | elevated surface (cards, chart, nav) |
| `ink` | `#181819` | `#edeef1` | primary text / primary-button fill |
| `ink-soft` | `#636369` | `#9d9fa7` | secondary text, labels |
| `hair` | `#d6d6db` | `#2b2d33` | 1px hairlines / borders |
| `apple` | `#0a63d6` | `#60a5ff` | the single accent: links, chart, mastery bars (AA as text in both themes) |
| `ok` / `no` | green / red | green / red | quiz correct/incorrect, import status |

Dark mode reads as a layered near-black: `bg < cloud < card` with visible hairlines, so surfaces feel elevated rather than flat. The accent is used sparingly (≤10% of surface) — data and links only, never as a button fill.

## Typography

Two families on a contrast axis (grotesque × mono), loaded from Google Fonts. Deliberately **not** Inter / Space Grotesk / Geist (over-used tells).

### Scale (verbindlich)

Acht Stufen, Verhältnis ~1.27, definiert als CSS-Variablen in `index.html` und benutzt über die Klassen `.t-*`. **Keine Einzelwerte mehr in Komponenten** — kein `text-[15px]`, kein `text-3xl`. Vorher waren sechzehn verschiedene Größen im Umlauf; das ist der Unterschied zwischen „ordentlich" und „gebaut".

| Klasse | Größe | Zeilenhöhe | Rolle |
|---|---|---|---|
| `.t-h1` | clamp 40 → 72 | 1.02 | nur die Hero-Zeile auf der Übersicht |
| `.t-h2` | clamp 30 → 42 | 1.06 | Seitentitel, Abschnittsüberschriften |
| `.t-h3` | clamp 22 → 27 | 1.18 | Kartenkopf, die ganzen Sätze |
| `.t-lead` | clamp 18 → 21 | 1.5 | Vorspann unter einer Überschrift |
| `.t-body` | 17 | 1.62 | Fließtext |
| `.t-ui` | 15 | 1.5 | Listen, Bedienelemente |
| `.t-meta` | 13 | 1.5 | Beiwerk, Legenden |
| `.t-label` | 12 | 1.45 | Mono-Marginalien, Achsen, Kennzahlen |

Die Überschriftstufen sind `clamp()`, wachsen also stufenlos mit dem Fenster statt an einem Breakpoint zu springen. Die Klassen setzen **nur** Größe, Zeilenhöhe und Laufweite — Gewicht (`font-semibold`) und Umbruch (`text-balance`, `text-pretty`) bleiben bei Tailwind, sonst streiten zwei Systeme um dieselbe Eigenschaft. Im Dunkelmodus bekommen `.t-body` und `.t-lead` mehr Zeilenhöhe (1.68), weil helle Schrift auf dunklem Grund leichter wirkt.

- **Display & body:** `Schibsted Grotesk` (400–800). Body `text-pretty`, line length capped 54–65ch.
- **Data:** `Martian Mono` (`font-mono`) for numbers, %, chart axis/annotation, small meta labels, counters — the "readout" texture. Used small; big display numbers stay in Schibsted with `tabular-nums`.
- Hero clamp max ~6rem; no all-caps body; eyebrows are sentence-case mono, used once per page header (not above every section).

## Layout & Spacing

- Container `max-w-6xl` / `max-w-3xl` (prose) centered, `px-6`. Generous section padding (`py-16`–`py-28`).
- 2-col hero (headline + data card) collapses to 1-col; grid items carry `min-w-0` to prevent overflow.
- Rhythm via alternating `bg` / `cloud` sections and hairline dividers. Cards are used only where they're the right affordance (data card, word list, import panel) — no repeated identical card grids.

## Elevation & Oberflächen

Eine Karte war früher eine 1px-Linie um einen Kasten, also ein Drahtgitter. Damit eine Fläche wie Material wirkt, braucht sie drei Dinge: die Kante, den Schatten und im Dunkeln die Lichtkante.

| Token | Rolle |
|---|---|
| `--lift-1` | Ruhezustand jeder Fläche. **Zwei** Lagen: ein enger Kontaktschatten, der die Kante verankert, plus ein weiter weicher, der sie anhebt. Ein einzelner weichgezeichneter Schatten lässt eine Fläche wie einen Aufkleber aussehen. |
| `--lift-2` | Angehoben (Hover auf wirklich anfassbaren Flächen, Knöpfe). |
| `--sheen` | Innere Lichtkante oben. Im Dunkelmodus die eigentliche Arbeit: `inset 0 1px 0 rgb(255 255 255 / .07)` liest sich als Licht von oben, ohne dass ein Schatten auf schwarzem Grund sichtbar wäre. |

- **`.surface`** = `card`-Hintergrund + Haarlinie + 16px Radius + `--lift-1` + `--sheen`. Ersetzt überall das frühere `rounded-2xl border border-hair bg-card`.
- **`.surface-int`** hebt beim Überfahren an (`--lift-2`, kräftigere Kante, −2px). **Nur für Flächen, die man wirklich anklicken kann.** Eine Karte, die sich hebt, ohne dass etwas passiert, lügt.
- **`.lnk`** ist der Fließtext-Link: die Unterlinie liegt immer da, nur blass (32 % Akzent), und färbt beim Überfahren durch. `text-underline-offset: .22em` hält sie aus den Unterlängen. Ersetzt `text-apple hover:underline`, das die Linie hart anschaltet.
- Knöpfe: der Hover war `opacity: .86`, der billigste aller Zustände — die Fläche wird durchsichtig und nimmt die Farbe des Hintergrunds an, statt eine eigene zu haben. Jetzt mischt `color-mix(in oklab, …)` echte Farbe, der Schatten trägt die Bewegung (heben beim Überfahren, aufsetzen beim Drücken).
- Unter `prefers-reduced-motion` entfallen alle Verschiebungen, die Farb- und Schattenwechsel bleiben — sonst fehlt die Rückmeldung ganz.

## Components

- **Buttons** (`.btn` in `index.html`): `.btn-primary` = ink-inverted (`bg-ink text-bg`, black/white per theme, always AA) — the primary action; `.btn-secondary` = `bg-card` + hairline. Sizes `.btn-lg` / `.btn-sm`. Rectangular ink buttons for in-form CTAs (import).
- **Mastery bars:** hairline track (`overflow-hidden rounded-full`) + accent fill animated with `transform: scaleX(var(--s))` (no width animation). Flat right cap, clipped-round left.
- **Growth chart:** inline theme-aware SVG (`GrowthChart`) — accent line + 9% area fill, mono axis, current value annotated on the last point.
- **Word list:** bordered container of hairline-divided rows (word · translation · bar · status word · %). Status is text, never colour-only.
- **Login modal / Locked gate:** the extras (Mini-Test, Anki-Import) are gated behind a client-side Papaplatte login; public users see stats only.
- Focus: global `:focus-visible` outline in the accent.

## Motion

- **Reveal:** one-shot `revealUp` animation applied via an `.in` class from an IntersectionObserver. Content is visible by default — visibility is never gated on the class (so headless/background tabs never ship blank). Optional `.d1`–`.d4` stagger.
- **Counters:** `CountUp` animates on view; shows the final value immediately under reduced-motion or without IntersectionObserver.
- Easing: ease-out quint/expo curves (`cubic-bezier(.22,1,.36,.99)`). No bounce/elastic.
- **Reduced motion:** every animation has a `@media (prefers-reduced-motion: reduce)` path (instant / final-state). Bars jump to final scale; reveals/counters show final content.

## Build

Source in `src/` (React), bundled by esbuild to `app.js`, loaded by `index.html`. `npm run build` / `npm run dev`. Serve locally with `python -m http.server 5500`.
