/**
 * OpenGrad Outreach - JSON API for the dashboard website.
 *
 * This is a SEPARATE Apps Script project from the hourly follow-up script.
 *  - It only READS the "Follow-up Log" tab (never changes it).
 *  - It can add contacts to a "Leads" tab (people you plan to email / outreach you logged).
 *  - Access: "Sign in with Google". Only the script owner and the Gmail addresses listed in the
 *    "Dashboard Access" tab of the master sheet get any data. That tab is created automatically.
 *  - It stores small "stage" marks (call / whatsapp) in its own Script Properties.
 * It never sends email.
 *
 * Your sheet ID and Google Client ID live in the separate "Settings" file (Settings.gs),
 * so this whole file can be replaced on updates.
 */

const LOG_TAB = 'Follow-up Log';
const LEADS_TAB = 'Leads';
const ACCESS_TAB = 'Dashboard Access';
const LEADS_HEADER = ['Lead ID', 'Name', 'Email', 'Organisation', 'Subject', 'Notes', 'Added', 'Status', 'Channel', 'Contacted On', 'Added by'];
const ADDED_BY_COL = 11; // column K of the Leads tab
const CHANNELS = ['Email', 'LinkedIn', 'Call', 'WhatsApp', 'In person', 'Other'];

/* ---------- entry points ---------- */

// Opening the URL in a browser just says the API is running. No data without signing in.
function doGet() {
  return json_({ ok: true, message: 'Outreach API is running. Open the dashboard website and sign in with Google.' });
}

// The website sends a small JSON message: { idToken, action, ... }
function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ error: 'bad request' }); }
  try {
    const who = checkUser_(body.idToken);
    if (who.error) return json_(who);

    // Everything below only ever sees / changes the signed-in person's own rows.
    const me = who.email;
    if (!body.action || body.action === 'get') return json_({ rows: getData(me), leads: getLeads(me), user: me });
    if (body.action === 'addLead') return json_(addLead(body.lead || {}, me));
    if (body.action === 'contactedLead') return json_(updateLead(body.id, { status: 'Contacted', channel: body.channel, contactedOn: body.contactedOn }, me));
    if (body.action === 'removeLead') return json_(updateLead(body.id, { status: 'Removed' }, me));
    if (body.action === 'mark') return json_(markStage(body.id, body.stage, me));
    return json_({ error: 'unknown action' });
  } catch (err) {
    return json_({ error: errText_(err) });
  }
}

/* ---------- Google sign-in check ---------- */

// Returns { email } or { error: 'signin' | 'expired' | 'not_allowed', email? }.
function checkUser_(idToken) {
  if (typeof GOOGLE_CLIENT_ID !== 'string' || !/apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID)) {
    throw new Error('GOOGLE_CLIENT_ID is not set in the Settings file.');
  }
  idToken = String(idToken || '');
  if (idToken.split('.').length !== 3) return { error: 'signin' };

  // Google checks the sign-in ticket for us. Results are cached briefly to keep the dashboard fast.
  const cache = CacheService.getScriptCache();
  const key = 'id_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  let info = null;
  const cached = cache.get(key);
  if (cached) {
    info = JSON.parse(cached);
  } else {
    const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { error: 'expired' };
    info = JSON.parse(res.getContentText());
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (info.aud !== GOOGLE_CLIENT_ID) return { error: 'signin' };
  if (info.iss !== 'accounts.google.com' && info.iss !== 'https://accounts.google.com') return { error: 'signin' };
  if (String(info.email_verified) !== 'true') return { error: 'signin' };
  if (!(Number(info.exp) > nowSec)) return { error: 'expired' };
  if (!cached) cache.put(key, JSON.stringify(info), Math.max(1, Math.min(600, Number(info.exp) - nowSec)));

  const email = String(info.email || '').toLowerCase();
  if (allowedEmails_().indexOf(email) < 0) return { error: 'not_allowed', email: email };
  return { email: email };
}

// The script owner, plus every email in column A of the "Dashboard Access" tab.
function allowedEmails_() {
  const owner = ownerEmail_();
  const list = owner ? [owner] : [];
  const ids = sheetIds_();
  if (!ids.length) return list;
  const ss = SpreadsheetApp.openById(ids[0]);
  let sheet = ss.getSheetByName(ACCESS_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(ACCESS_TAB);
    sheet.getRange(1, 1, 1, 2).setValues([['Email', 'Name / note']]).setFontWeight('bold');
    if (owner) sheet.getRange(2, 1, 1, 2).setValues([[owner, 'Owner (always allowed)']]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 4).setValue('Add one Gmail address per row in column A. Only these people can open the dashboard. Delete a row to remove someone.');
  }
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach(function (r) {
      const e = String(r[0] || '').trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+$/.test(e) && list.indexOf(e) < 0) list.push(e);
    });
  }
  return list;
}

/* ---------- Follow-up Log (read only) ---------- */

// Only the rows sent by `me`. Which Gmail sent a mail comes from a column headed "Sent by"
// (or "Account" / "Sender") in the Follow-up Log. Rows with no sender yet count as the owner's.
function getData(me) {
  const props = PropertiesService.getScriptProperties().getProperties();
  const rows = [];

  sheetIds_().forEach(function (sheetId) {
    const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(LOG_TAB);
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const lastCol = Math.max(sheet.getLastColumn(), 9);
    const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    let senderCol = -1;
    header.forEach(function (h, i) { if (senderCol < 0 && /^(sent by|account|sender|gmail account)$/i.test(String(h).trim())) senderCol = i; });

    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    values.forEach(function (r) {
      const id = String(r[0] || '').trim();
      if (!id) return;
      if (!belongsTo_(senderCol >= 0 ? r[senderCol] : '', me)) return;
      const status = String(r[6] || '').trim();
      const fu = Number(r[5]) || 0;
      const mark = props['stage_' + id];

      let stage;
      if (mark === 'call' || mark === 'whatsapp') stage = mark;
      else if (/^replied$/i.test(status)) stage = 'replied';
      else if (/stopped|bounced/i.test(status)) stage = 'stopped';
      else if (fu > 0) stage = 'followup';
      else stage = 'waiting';

      rows.push({
        id: id,
        name: String(r[1] || '').trim(),
        email: String(r[2] || '').trim(),
        subject: String(r[3] || '').trim(),
        first: toMs_(r[4]),
        fu: fu,
        status: status,
        last: toMs_(r[7]),
        snippet: String(r[8] || ''),
        stage: stage,
        due: /due|would send/i.test(status)
      });
    });
  });

  rows.sort(function (a, b) { return (b.first || 0) - (a.first || 0); });
  return rows;
}

function markStage(id, stage, me) {
  id = String(id || '').trim();
  if (!id) return { error: 'missing id' };
  if (!getData(me).some(function (r) { return r.id === id; })) return { error: 'not found' };
  const props = PropertiesService.getScriptProperties();
  if (stage === 'call' || stage === 'whatsapp') {
    props.setProperty('stage_' + id, stage);
  } else {
    props.deleteProperty('stage_' + id);
  }
  return { ok: true, id: id, stage: (stage === 'call' || stage === 'whatsapp') ? stage : null };
}

/* ---------- Leads tab: new contacts and outreach you log by hand ---------- */
// Status "To contact" = you plan to reach out. "Contacted" = outreach done (Channel + Contacted On).
// "Removed" = hidden from the dashboard (the row stays, nothing is deleted).

function getLeads(me) {
  const sheet = leadsSheet_(false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const width = Math.max(sheet.getLastColumn(), LEADS_HEADER.length);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  const leads = [];
  values.forEach(function (r) {
    const id = String(r[0] || '').trim();
    const status = String(r[7] || '').trim();
    if (!id || /^removed$/i.test(status)) return;
    if (!belongsTo_(r[ADDED_BY_COL - 1], me)) return;
    leads.push({
      id: id,
      name: String(r[1] || '').trim(),
      email: String(r[2] || '').trim(),
      org: String(r[3] || '').trim(),
      subject: String(r[4] || '').trim(),
      notes: String(r[5] || ''),
      added: toMs_(r[6]),
      status: /^contacted$/i.test(status) ? 'Contacted' : 'To contact',
      channel: String(r[8] || '').trim(),
      contactedOn: toMs_(r[9])
    });
  });
  leads.sort(function (a, b) { return (b.contactedOn || b.added || 0) - (a.contactedOn || a.added || 0); });
  return leads;
}

function addLead(input, me) {
  const email = clean_(input.email, 200).toLowerCase();
  const name = clean_(input.name, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'That email address does not look right.' };
  if (!email && !name) return { error: 'Please enter at least a name or an email.' };

  const done = input.kind === 'done';
  const channel = done ? (CHANNELS.indexOf(input.channel) >= 0 ? input.channel : 'Other') : '';
  const contactedOn = done ? parseDay_(input.contactedOn) : '';
  const lead = { org: clean_(input.org, 160), subject: clean_(input.subject, 200), notes: clean_(input.notes, 2000) };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = leadsSheet_(true);
    if (email && !done) {
      const dup = getLeads(me).filter(function (l) { return l.email.toLowerCase() === email && l.status === 'To contact'; })[0];
      if (dup) return { error: email + ' is already in your To contact list.', duplicate: true };
    }
    const id = 'L' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    const status = done ? 'Contacted' : 'To contact';
    sheet.appendRow([id, safeCell_(name), email, safeCell_(lead.org), safeCell_(lead.subject), safeCell_(lead.notes),
      new Date(), status, channel, contactedOn, me]);
    return { ok: true, lead: { id: id, name: name, email: email, org: lead.org, subject: lead.subject, notes: lead.notes,
      added: Date.now(), status: status, channel: channel, contactedOn: contactedOn ? contactedOn.getTime() : null } };
  } finally {
    lock.releaseLock();
  }
}

// Change a lead's status ("Contacted" with channel/date, or "Removed").
function updateLead(id, change, me) {
  id = String(id || '').trim();
  const sheet = leadsSheet_(false);
  if (!id || !sheet || sheet.getLastRow() < 2) return { error: 'not found' };
  const width = Math.max(sheet.getLastColumn(), ADDED_BY_COL);
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() !== id) continue;
    if (!belongsTo_(ids[i][ADDED_BY_COL - 1], me)) return { error: 'not found' };
    const row = i + 2;
    if (change.status === 'Contacted') {
      const ch = CHANNELS.indexOf(change.channel) >= 0 ? change.channel : 'Email';
      sheet.getRange(row, 8, 1, 3).setValues([['Contacted', ch, parseDay_(change.contactedOn)]]);
    } else {
      sheet.getRange(row, 8).setValue('Removed');
    }
    return { ok: true, id: id };
  }
  return { error: 'not found' };
}

// "2026-11-13" -> Date at noon (avoids time-zone day shifts); anything else -> today.
function parseDay_(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}

/* ---------- helpers ---------- */

function ownerEmail_() {
  return String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
}

// A row belongs to `me` if its sender/added-by cell is my Gmail. Empty = the owner's (older rows).
function belongsTo_(cell, me) {
  const v = String(cell == null ? '' : cell).trim().toLowerCase();
  me = String(me || '').toLowerCase();
  if (!me) return false;
  return v ? v === me : me === ownerEmail_();
}

function sheetIds_() {
  return SHEET_IDS.filter(function (s) { return s && String(s).indexOf('PASTE') !== 0; });
}

// Leads live in the first (master) sheet.
function leadsSheet_(create) {
  const ids = sheetIds_();
  if (!ids.length) throw new Error('No sheet ID set in Settings.');
  const ss = SpreadsheetApp.openById(ids[0]);
  let sheet = ss.getSheetByName(LEADS_TAB);
  if (!sheet && create) {
    sheet = ss.insertSheet(LEADS_TAB);
    sheet.getRange(1, 1, 1, LEADS_HEADER.length).setValues([LEADS_HEADER]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else if (sheet && create && !String(sheet.getRange(1, ADDED_BY_COL).getValue()).trim()) {
    sheet.getRange(1, ADDED_BY_COL).setValue('Added by').setFontWeight('bold'); // tabs made before multi-user
  }
  return sheet;
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim().slice(0, max);
}

function safeCell_(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function toMs_(v) {
  if (v instanceof Date) return v.getTime();
  if (v === '' || v === null || v === undefined) return null;
  const t = new Date(v).getTime();
  return isNaN(t) ? null : t;
}

function errText_(err) {
  return String(err && err.message ? err.message : err);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
