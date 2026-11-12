/**
 * Where the dashboard finds your Google Sheet.
 * The web app URL and access key are entered once in the "Connect" window and saved in THIS browser only
 * (never in the code), so the public GitHub repo and website don't contain anything private.
 *
 * Optional: set VITE_SHEETS_API_URL in a .env.local file to pre-fill the URL for everyone.
 */
const STORAGE_KEY = 'opengrad-outreach-connection';
const DEFAULT_URL = import.meta.env.VITE_SHEETS_API_URL || '';

export function getConnection() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.url && saved.key) return { url: saved.url, key: saved.key };
  } catch {
    // Storage blocked (private window etc.) – fall through to "not connected".
  }
  return { url: DEFAULT_URL, key: '' };
}

export function saveConnection({ url, key }) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: url.trim(), key: key.trim() }));
    return true;
  } catch {
    return false;
  }
}

export function clearConnection() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isConnected() {
  const { url, key } = getConnection();
  return Boolean(url && key);
}
