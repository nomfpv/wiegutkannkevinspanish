import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

/* ══ AUSGEBLENDET ══════════════════════════════════════════════════════════
   Die Seite ist bewusst eine reine Übersicht: kein Login, kein Mini-Test,
   kein Anki-Import. Der Code bleibt vollständig erhalten und ist nur
   auskommentiert — alle betroffenen Stellen sind mit „AUSGEBLENDET" markiert
   (hier, in Nav, in App sowie in src/pages/Home.jsx).
   Zum Reaktivieren: die auskommentierten Blöcke wieder aktivieren.
   Die Dateien src/pages/Trainer.jsx, src/pages/Anki.jsx, src/lib/auth.js und
   src/lib/anki.js liegen unverändert im Projekt, werden aber nicht gebündelt.
   ═════════════════════════════════════════════════════════════════════════ */

import Home from './pages/Home';
import Wortschatz from './pages/Wortschatz';
import Folgen from './pages/Folgen';
import Soundboard from './pages/Soundboard';
// import Trainer from './pages/Trainer';                      // AUSGEBLENDET
// import Anki from './pages/Anki';                            // AUSGEBLENDET
import { getTheme, setTheme } from './lib/theme';
import { EierEbene, EierSchalter } from './lib/Ostereier';
// import { isAuthed, login, logout } from './lib/auth';        // AUSGEBLENDET

const ROUTES = [
  { key: 'home', hash: '#/', label: 'Übersicht', Comp: Home, protected: false },
  { key: 'wortschatz', hash: '#/wortschatz', label: 'Wortschatz', Comp: Wortschatz, protected: false },
  { key: 'folgen', hash: '#/folgen', label: 'Folgen', Comp: Folgen, protected: false },
  { key: 'soundboard', hash: '#/soundboard', label: 'Soundboard', Comp: Soundboard, protected: false },
  // AUSGEBLENDET — geschützte Routen:
  // { key: 'trainer', hash: '#/trainer', label: 'Mini-Test', Comp: Trainer, protected: true },
  // { key: 'anki', hash: '#/anki', label: 'Anki-Import', Comp: Anki, protected: true },
];

function currentKey() {
  const h = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return h || 'home';
}

function useHashRoute() {
  const [key, setKey] = useState(currentKey);
  useEffect(() => {
    const onChange = () => {
      setKey(currentKey());
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return key;
}

/* ---------- Theme toggle (Light / Dark) ---------- */
function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme);
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  }
  const dark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label="Dark Mode umschalten"
      title={dark ? 'Light Mode' : 'Dark Mode'}
      className="relative h-6 w-11 shrink-0 rounded-full border border-hair bg-cloud transition-colors"
    >
      <span className={'absolute top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow transition-all ' + (dark ? 'left-[22px]' : 'left-0.5')}>
        {dark ? (
          <svg className="h-3 w-3 text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>
        ) : (
          <svg className="h-3 w-3 text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        )}
      </span>
    </button>
  );
}

/* ---------- Login modal — AUSGEBLENDET ----------
function LoginModal({ onClose, onSuccess }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (login(pw)) onSuccess();
    else {
      setErr(true);
      setPw('');
    }
  }
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fade-in fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.45)' }} onClick={onClose}>
      <div className="modal-in w-full max-w-sm surface p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-cloud">
          <svg className="h-5 w-5 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        </div>
        <h2 className="text-center font-semibold t-h3 text-ink">Anmeldung</h2>
        <p className="mt-1 text-center t-meta text-ink-soft">Nur für Papaplatte.</p>

        <form onSubmit={submit} className="mt-6">
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(false); }}
            placeholder="Passwort"
            className={'w-full rounded-xl border bg-card px-4 py-3 t-ui text-ink outline-none placeholder:text-ink-soft/60 ' + (err ? 'border-no focus:border-no' : 'border-hair focus:border-apple')}
          />
          {err && <p className="mt-2 t-meta text-no">Falsches Passwort.</p>}
          <button type="submit" className="mt-4 w-full rounded-xl bg-ink px-5 py-3 t-ui font-medium text-bg transition-opacity hover:opacity-90">
            Anmelden
          </button>
        </form>
        <button onClick={onClose} className="mt-3 w-full text-center t-meta font-medium text-ink-soft transition-colors hover:text-ink">
          Abbrechen
        </button>
      </div>
    </div>
  );
}
---------- Ende LoginModal ---------- */

/* ---------- Locked gate for protected routes — AUSGEBLENDET ----------
function Locked({ label, onLogin }) {
  return (
    <section className="mx-auto max-w-xl px-6 py-24 text-center lg:py-32">
      <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-hair bg-cloud">
        <svg className="h-7 w-7 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
      </div>
      <h1 className="text-balance font-semibold t-h2 text-ink">{label} ist geschützt.</h1>
      <p className="mx-auto mt-4 t-lead text-ink-soft">Nur für Papaplatte. Alle anderen sehen die Stats.</p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <button onClick={onLogin} className="btn btn-primary btn-lg">Anmelden</button>
        <a href="#/wortschatz" className="btn btn-secondary btn-lg">Zu den Stats</a>
      </div>
    </section>
  );
}
---------- Ende Locked ---------- */

function Nav({ activeKey }) {   // AUSGEBLENDET: authed, onLoginClick, onLogout
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);

  // AUSGEBLENDET: const visible = ROUTES.filter((r) => !r.protected || authed);
  const visible = ROUTES;

  return (
    <header className="sticky top-0 z-50 border-b border-hair/70 bg-card/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
        <a href="#/" className="t-ui font-semibold tracking-tight text-ink">
          kevin<span className="text-ink-soft">.es</span>
        </a>

        <nav className="hidden items-center gap-8 t-meta sm:flex">
          {visible.map((r) => (
            <a key={r.key} href={r.hash} className={'transition-colors ' + (activeKey === r.key ? 'text-ink' : 'text-ink-soft hover:text-ink')}>
              {r.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 sm:flex">
          <ThemeToggle />
          {/* AUSGEBLENDET — An-/Abmelden im Desktop-Header:
          {authed ? (
            <button onClick={onLogout} className="t-meta font-medium text-ink-soft transition-colors hover:text-ink">
              Abmelden
            </button>
          ) : (
            <button onClick={onLoginClick} className="btn btn-primary btn-sm">
              Anmelden
            </button>
          )}
          */}
        </div>

        <div className="flex items-center gap-3 sm:hidden">
          <ThemeToggle />
          <button onClick={() => setOpen((o) => !o)} aria-label="Menü" aria-expanded={open} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink transition-colors hover:bg-cloud">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? <path d="M18 6 6 18M6 6l12 12" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="menu-in border-t border-hair bg-card sm:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-6 py-2">
            {visible.map((r) => (
              <a key={r.key} href={r.hash} onClick={() => setOpen(false)} className={'border-b border-hair/60 py-3 t-ui ' + (activeKey === r.key ? 'font-medium text-ink' : 'text-ink-soft')}>
                {r.label}
              </a>
            ))}
            {/* AUSGEBLENDET — An-/Abmelden im Mobil-Menü:
            {authed ? (
              <button onClick={() => { setOpen(false); onLogout(); }} className="py-3 text-left t-ui text-ink-soft">Abmelden</button>
            ) : (
              <button onClick={() => { setOpen(false); onLoginClick(); }} className="py-3 text-left t-ui font-medium text-apple">Anmelden</button>
            )}
            */}
          </nav>
        </div>
      )}
    </header>
  );
}

/* Discord-Namen kann man nicht verlinken, deshalb zum Kopieren statt als Link. */
function DiscordTag({ name }) {
  const [kopiert, setKopiert] = useState(false);
  async function kopieren() {
    try { await navigator.clipboard.writeText(name); setKopiert(true); setTimeout(() => setKopiert(false), 1600); }
    catch { /* ohne Zwischenablage bleibt der Name lesbar stehen */ }
  }
  return (
    <button
      type="button" onClick={kopieren}
      title="Discord-Namen kopieren"
      className="inline-flex items-center gap-1.5 t-meta text-ink-soft transition-colors hover:text-ink"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19.3 5.3A16.6 16.6 0 0 0 15.2 4l-.2.4a15.4 15.4 0 0 1 3.6 1.2c-1.8-.9-3.6-1.3-5.4-1.3-1.8 0-3.6.4-5.4 1.3A15.4 15.4 0 0 1 11.4 4.4L11.2 4c-1.5.3-2.9.7-4.1 1.3C4.4 9.4 3.6 13.4 4 17.4a16.6 16.6 0 0 0 5 2.6l.7-1.2c-.7-.3-1.4-.6-2-1l.5-.4a11.9 11.9 0 0 0 10 0l.5.4c-.6.4-1.3.7-2 1l.7 1.2a16.6 16.6 0 0 0 5-2.6c.5-4.6-.7-8.6-3.1-12.1ZM9.6 15c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm4.8 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
      </svg>
      {kopiert ? 'kopiert' : name}
    </button>
  );
}

function Footer() {
  return (
    <footer className="border-t border-hair bg-cloud">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-6 py-10 sm:flex-row">
        <span className="t-meta font-semibold text-ink">
          kevin.<span className="text-ink-soft">es</span>
        </span>

        <EierSchalter />

        <div className="flex items-center gap-5">
          <a
            href="https://github.com/nomfpv/wiegutkannkevinspanish" target="_blank" rel="noopener noreferrer"
            title="Quelltext auf GitHub"
            className="group inline-flex items-end gap-3 t-meta text-ink-soft transition-colors hover:text-ink"
          >
            {/* Reine Deko, deshalb aria-hidden — der Linktext daneben trägt die Bedeutung. */}
            <pre aria-hidden="true" className="font-mono text-[10px] leading-[1.15] text-ink-soft/70 transition-colors group-hover:text-ink-soft">{
` _______
< ¿qué? >
 -------
  \\ (o_o)`}</pre>
            <span>quelltext</span>
          </a>
          <DiscordTag name="nom787" />
        </div>
      </div>
    </footer>
  );
}

function App() {
  const activeKey = useHashRoute();
  // AUSGEBLENDET — Login-Zustand:
  // const [authed, setAuthed] = useState(isAuthed());
  // const [loginOpen, setLoginOpen] = useState(false);

  const route = ROUTES.find((r) => r.key === activeKey) || ROUTES[0];
  const Page = route.Comp;
  // AUSGEBLENDET: const blocked = route.protected && !authed;

  // AUSGEBLENDET — Abmelden:
  // function onLogout() {
  //   logout();
  //   setAuthed(false);
  //   if (route.protected) window.location.hash = '#/';
  // }

  return (
    <>
      <Nav activeKey={route.key} />
      <main>
        <div key={route.key} className="page-in">
          <Page />
        </div>
      </main>
      <Footer />
      <EierEbene />
      {/* AUSGEBLENDET — Login-Dialog:
      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onSuccess={() => { setAuthed(true); setLoginOpen(false); }}
        />
      )}
      */}
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
