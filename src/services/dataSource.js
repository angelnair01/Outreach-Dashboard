/**
 * The ONE place the dashboard reads and writes data.
 *
 * - Connected (web app URL + access key saved in the "Connect" window): talks to the Google Sheet's
 *   Apps Script (google-apps-script/Code.gs), which syncs with Gmail.
 * - Not connected: uses the made-up demo data in src/data/mockData.js. Adds and edits work too,
 *   but are forgotten when the page reloads.
 *
 * Record shape (one per contact; dates are "YYYY-MM-DD", blanks are ""):
 *   id, company, contactPerson, designation, email, linkedinProfile, reachingOutFor,
 *   emailSent (bool), emailDate, linkedinSent (bool), linkedinDate, followUpsDone (number),
 *   lastOutreachDate, nextStep, nextFollowUpDate, replied (bool), replyDate,
 *   callDone (bool), callDate, callOutcome, callNotes,
 *   interestedInFunding, fundingStatus, owner, notes
 */
import { buildMockRecords } from '../data/mockData.js';
import { getConnection, isConnected } from './connection.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const copy = (r) => ({ ...r });

// ---- Demo mode: an in-memory copy of the fake data ----
let demoStore = null;
const demoRecords = () => {
  if (!demoStore) demoStore = buildMockRecords();
  return demoStore;
};

// ---- Live mode: the Apps Script web app ----
async function callSheet(payload, connection = getConnection()) {
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(connection.url || '')) {
    throw new Error('The web app URL should start with https://script.google.com/');
  }
  let res;
  try {
    // text/plain keeps this a "simple" request, which Apps Script web apps accept from any website.
    res = await fetch(connection.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, key: connection.key }),
    });
  } catch {
    throw new Error('Couldn’t reach the Google Sheet. Check your internet connection and the web app URL.');
  }
  if (!res.ok) throw new Error(`The Google Sheet replied with an error (${res.status}).`);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Unexpected reply from Google. Check the URL, and that the web app access is set to “Anyone”.');
  }
  if (!data.ok) throw new Error(data.error || 'The Google Sheet reported an error.');
  return data;
}

/**
 * Load all contacts. `sync: true` also asks the sheet to check Gmail first (used by the Sync button).
 * Returns { records, lastSynced, mode: 'live' | 'demo' }.
 */
export async function getOutreachData({ sync = false } = {}) {
  if (!isConnected()) {
    await delay(500);
    return {
      records: demoRecords().map(copy),
      lastSynced: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      mode: 'demo',
    };
  }
  const data = await callSheet({ action: 'list', sync });
  return { records: data.records || [], lastSynced: data.lastSynced, mode: 'live' };
}

/** Add a new contact. Returns the saved record (with its id). */
export async function addContact(record) {
  if (!isConnected()) {
    await delay(300);
    const saved = { ...record, id: `demo-${Date.now()}` };
    demoRecords().push(saved);
    return copy(saved);
  }
  const data = await callSheet({ action: 'add', record });
  return data.record;
}

/** Change some fields of a contact. Returns the full saved record. */
export async function updateContact(id, changes) {
  if (!isConnected()) {
    await delay(200);
    const rec = demoRecords().find((r) => r.id === id);
    if (!rec) throw new Error('That contact was not found.');
    Object.assign(rec, changes);
    return copy(rec);
  }
  const data = await callSheet({ action: 'update', id, changes });
  return data.record;
}

/** Used by the Connect window: checks a URL + key before saving them. */
export async function testConnection(url, key) {
  const data = await callSheet({ action: 'list' }, { url: url.trim(), key: key.trim() });
  return { count: (data.records || []).length };
}
