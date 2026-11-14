/* Simple client-side gate for the interactive areas (Trainer + Anki-Import).
   Public visitors can only see the stats; Papaplatte logs in to unlock the rest.

   NOTE: This is a client-side lock only — the password ships in the bundle and
   is NOT real server-side security. It keeps casual visitors out, nothing more.

   The login is commented out in src/app.jsx (AUSGEBLENDET), so this file is not
   bundled. The repo is public: PASSWORD stays empty here, and an empty password
   never matches. Set it locally before re-enabling the login — do not commit it. */

const PASSWORD = '';
const KEY = 'kevin.es.auth';

export function isAuthed() {
  try {
    return localStorage.getItem(KEY) === 'ok';
  } catch (e) {
    return false;
  }
}

export function login(pw) {
  if (PASSWORD && pw === PASSWORD) {
    try {
      localStorage.setItem(KEY, 'ok');
    } catch (e) {}
    return true;
  }
  return false;
}

export function logout() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
}
