/* Light/Dark theme: persisted in localStorage, falls back to the OS preference.
   The initial class is set by an inline script in index.html to avoid a flash. */

const KEY = 'kevin.es.theme';
let _timer = null;

export function getTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch (e) {}
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

export function applyTheme(theme) {
  const el = document.documentElement;
  if (theme === 'dark') el.classList.add('dark');
  else el.classList.remove('dark');
}

export function setTheme(theme) {
  const el = document.documentElement;
  // Enable a coordinated colour transition for the duration of the switch,
  // so every element fades together instead of some snapping and some easing.
  el.classList.add('theme-transition');
  applyTheme(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch (e) {}
  window.clearTimeout(_timer);
  _timer = window.setTimeout(() => el.classList.remove('theme-transition'), 320);
}
