/**
 * OpenGrad Outreach - JSON API for the dashboard website.
 *
 * This is a SEPARATE Apps Script project from the hourly follow-up script.
 *  - It only READS the "Follow-up Log" tab (never changes it).
 *  - It can add contacts to a "Leads" tab (people you plan to email / outreach you logged).
 *  - Access: "Sign in with Google". With OPEN_ACCESS (Settings) anyone can sign in, and every
 *    person only ever receives their OWN rows ("Sent by" / "Added by"). With OPEN_ACCESS = false,
 *    only the owner and the "Dashboard Access" tab list get in.
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
    // Calls from the "Outreach Sync" script, running as each person with their own Gmail permission.
    if (/^sync/.test(String(body.action || ''))) {
      const syncer = checkAccessToken_(body.accessToken);
      if (syncer.error) return json_(syncer);
      if (body.action === 'syncPull') return json_({ rows: syncPull_(syncer.email, body.ids), account: accountInfo_(syncer.email), companies: companiesFor_(syncer.email) });
      if (body.action === 'syncPush') return json_(syncPush_(syncer.email, body.rows || [], body.error));
      if (body.action === 'syncConnect') return json_(setAccount_(syncer.email, true, body.name));
      if (body.action === 'syncDisconnect') return json_(setAccount_(syncer.email, false));
      return json_({ error: 'unknown action' });
    }

    const who = checkUser_(body.idToken);
    if (who.error) return json_(who);

    // Everything below only ever sees / changes the signed-in person's own rows.
    const me = who.email;
    if (!body.action || body.action === 'get') {
      // "Anything new since my last look?" If not, answer in a few milliseconds without reading the sheet.
      const ver = getVer_(me);
      if (body.since && String(body.since) === ver) return json_({ unchanged: true, ver: ver, account: accountInfo_(me) });
      return json_({ rows: getData(me), leads: getLeads(me), touches: getTouches(me), companies: getCompanies(me), user: me, account: accountInfo_(me), ver: ver });
    }
    if (body.action === 'gmailStatus') return json_({ account: accountInfo_(me) });
    let res;
    if (body.action === 'addLead') res = addLead(body.lead || {}, me);
    else if (body.action === 'contactedLead') res = updateLead(body.id, { status: 'Contacted', channel: body.channel, contactedOn: body.contactedOn }, me);
    else if (body.action === 'removeLead') res = updateLead(body.id, { status: 'Removed' }, me);
    else if (body.action === 'mark') res = markStage(body.id, body.stage, me);
    else if (body.action === 'addTouch') res = addTouch(body.touch || {}, me);
    else if (body.action === 'removeTouch') res = removeTouch(body.id, me);
    else if (body.action === 'setCompany') res = setCompany(body.email, body.company, me);
    if (res) { if (res.ok) bumpVer_(me); return json_(res); }
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
  // Open access: any signed-in Gmail gets in, but only ever sees its own rows (see belongsTo_).
  // Set OPEN_ACCESS = false in Settings to allow only the "Dashboard Access" list instead.
  const open = typeof OPEN_ACCESS === 'undefined' ? true : OPEN_ACCESS === true;
  if (!open && allowedEmails_().indexOf(email) < 0) return { error: 'not_allowed', email: email };
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
    let companyCol = -1;
    header.forEach(function (h, i) { if (companyCol < 0 && /^company$/i.test(String(h).trim())) companyCol = i; });

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
        company: companyCol >= 0 && !/^(-|\(none\))$/.test(String(r[companyCol] || '').trim()) ? String(r[companyCol] || '').trim() : '',
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

/* ---------- Gmail sync (data sent in by each person's "Outreach Sync") ---------- */
// Columns A-J of the Follow-up Log. "Sent by" (J) is always set here to the verified Gmail.
const LOG_HEADER = ['Thread ID', 'Contact', 'Email', 'Subject', 'First Sent', 'Follow-ups Sent', 'Status', 'Last Action', 'Reply Snippet', 'Sent by', 'Company'];
const ACCOUNTS_HEADER = ['Gmail address', 'Name to sign with', 'Active (Yes/No)'];

// A Google access token from the sync script proves which Gmail is calling.
function checkAccessToken_(token) {
  token = String(token || '');
  if (token.length < 20) return { error: 'signin' };
  const cache = CacheService.getScriptCache();
  const key = 'at_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  const hit = cache.get(key);
  if (hit) return { email: hit };
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { error: 'expired' };
  const info = JSON.parse(res.getContentText());
  const email = String(info.email || '').toLowerCase();
  if (!email || String(info.email_verified) !== 'true' || !(Number(info.expires_in) > 0)) return { error: 'signin' };
  cache.put(key, email, Math.max(1, Math.min(600, Number(info.expires_in))));
  return { email: email };
}

function masterSheet_() {
  const ids = sheetIds_();
  if (!ids.length) throw new Error('No sheet ID set in Settings.');
  return SpreadsheetApp.openById(ids[0]); // the first sheet ID is the master: all new data goes there
}

function logTab_() {
  const ss = masterSheet_();
  let sh = ss.getSheetByName(LOG_TAB);
  if (!sh) {
    sh = ss.insertSheet(LOG_TAB);
    sh.getRange(1, 1, 1, LOG_HEADER.length).setValues([LOG_HEADER]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else {
    // Tabs made by older versions: add the missing headers (J = Sent by, K = Company).
    const h = sh.getRange(1, 10, 1, 2).getValues()[0];
    if (String(h[0]).trim() !== 'Sent by') sh.getRange(1, 10).setValue('Sent by').setFontWeight('bold');
    if (String(h[1]).trim() !== 'Company') sh.getRange(1, 11).setValue('Company').setFontWeight('bold');
  }
  return sh;
}

// This person's rows (and older rows with no sender, which may be theirs) as plain values.
// `ids` (optional): only these Thread IDs, so the every-minute check stays small with hundreds of rows.
function syncPull_(me, ids) {
  const sh = logTab_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const want = Array.isArray(ids) ? ids.reduce(function (m, id) { m[String(id)] = 1; return m; }, {}) : null;
  return sh.getRange(2, 1, n, LOG_HEADER.length).getValues().filter(function (r) {
    const id = String(r[0] || '').trim();
    const by = String(r[9] || '').trim().toLowerCase();
    return id && (by === me || !by) && (!want || want[id]);
  }).map(function (r) {
    return r.map(function (v) { return v instanceof Date ? v.getTime() : v; });
  });
}

// Insert or update this person's rows (matched by Thread ID). Dates arrive as numbers.
function syncPush_(me, rows, error) {
  // The every-minute check reports problems here, so the dashboard can show them.
  const sp = PropertiesService.getScriptProperties();
  if (error) {
    sp.setProperty('syncerr_' + me, JSON.stringify({ at: Date.now(), msg: clean_(error, 300) }));
    return { ok: true, saved: 0 };
  }
  sp.deleteProperty('syncerr_' + me);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = logTab_();
    const n = sh.getLastRow() - 1;
    const existing = n > 0 ? sh.getRange(2, 1, n, LOG_HEADER.length).getValues() : [];
    const rowOf = {};
    existing.forEach(function (r, i) {
      const id = String(r[0] || '').trim();
      const by = String(r[9] || '').trim().toLowerCase();
      if (id && (by === me || (!by && rowOf[id] === undefined))) rowOf[id] = i + 2;
    });
    const appends = [];
    (Array.isArray(rows) ? rows : []).slice(0, 1000).forEach(function (r) {
      if (!Array.isArray(r) || !String(r[0] || '').trim()) return;
      const v = [
        String(r[0]).trim(), safeCell_(clean_(r[1], 200)), clean_(r[2], 200), safeCell_(clean_(r[3], 300)),
        r[4] ? new Date(Number(r[4]) || r[4]) : '', Number(r[5]) || 0, clean_(r[6], 120),
        r[7] ? new Date(Number(r[7]) || r[7]) : '', safeCell_(clean_(r[8], 1000)), me, safeCell_(clean_(r[10], 120))
      ];
      if (rowOf[v[0]]) sh.getRange(rowOf[v[0]], 1, 1, LOG_HEADER.length).setValues([v]);
      else { appends.push(v); rowOf[v[0]] = -1; }
    });
    if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, LOG_HEADER.length).setValues(appends);
    PropertiesService.getScriptProperties().setProperty('sync_' + me, String(Date.now()));
    if ((rows || []).length) bumpVer_(me);
    return { ok: true, saved: (rows || []).length };
  } finally {
    lock.releaseLock();
  }
}

function accountsTab_() {
  const ss = masterSheet_();
  let sh = ss.getSheetByName('Accounts');
  if (!sh) {
    sh = ss.insertSheet('Accounts');
    sh.getRange(1, 1, 1, 3).setValues([ACCOUNTS_HEADER]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// { connected, name, lastSync } for the dashboard and the sync script.
function accountInfo_(me) {
  const sh = accountsTab_();
  const n = sh.getLastRow() - 1;
  let row = null;
  if (n > 0) sh.getRange(2, 1, n, 3).getValues().forEach(function (r) { if (String(r[0]).trim().toLowerCase() === me) row = r; });
  const active = row ? ['yes', 'active', 'true', 'y', '1'].indexOf(String(row[2]).trim().toLowerCase()) >= 0 || row[2] === true : false;
  return {
    connected: active,
    name: row ? String(row[1] || '').trim() : '',
    lastSync: Number(PropertiesService.getScriptProperties().getProperty('sync_' + me) || 0),
    lastError: (function () { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('syncerr_' + me) || 'null'); } catch (e) { return null; } })()
  };
}

function setAccount_(me, on, name) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = accountsTab_();
    const n = sh.getLastRow() - 1;
    let rowNum = 0;
    if (n > 0) sh.getRange(2, 1, n, 1).getValues().forEach(function (r, i) { if (String(r[0]).trim().toLowerCase() === me) rowNum = i + 2; });
    name = clean_(name, 80);
    if (!rowNum) {
      if (!on) return { ok: true };
      sh.appendRow([me, safeCell_(name || me.split('@')[0]), 'Yes']);
    } else {
      sh.getRange(rowNum, 3).setValue(on ? 'Yes' : 'No');
      if (on && name) sh.getRange(rowNum, 2).setValue(safeCell_(name));
    }
    return { ok: true, account: accountInfo_(me) };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Manual follow-ups ("touches") by Email / LinkedIn / WhatsApp ---------- */
// One row per follow-up you mark by hand on the dashboard. Later, LinkedIn / WhatsApp syncs can write here too.
const TOUCHES_TAB = 'Touches';
const TOUCHES_HEADER = ['Touch ID', 'Contact ID', 'Contact email', 'Contact name', 'Channel', 'Sent at', 'Note', 'Added by'];
const TOUCH_CHANNELS = ['Email', 'LinkedIn', 'WhatsApp'];

function touchesTab_(create) {
  const ss = masterSheet_();
  let sh = ss.getSheetByName(TOUCHES_TAB);
  if (!sh && create) {
    sh = ss.insertSheet(TOUCHES_TAB);
    sh.getRange(1, 1, 1, TOUCHES_HEADER.length).setValues([TOUCHES_HEADER]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getTouches(me) {
  const sh = touchesTab_(false);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, TOUCHES_HEADER.length).getValues().filter(function (r) {
    return String(r[0] || '').trim() && TOUCH_CHANNELS.indexOf(String(r[4])) >= 0 && String(r[7] || '').trim().toLowerCase() === me;
  }).map(function (r) {
    return { id: String(r[0]), cid: String(r[1]), email: String(r[2] || ''), name: String(r[3] || ''), channel: String(r[4]), at: toMs_(r[5]), note: String(r[6] || '') };
  }).sort(function (a, b) { return b.at - a.at; });
}

function addTouch(input, me) {
  const channel = TOUCH_CHANNELS.indexOf(input.channel) >= 0 ? input.channel : '';
  const cid = clean_(input.cid, 200);
  if (!channel) return { error: 'Choose Email, LinkedIn or WhatsApp.' };
  if (!cid) return { error: 'Missing contact.' };
  let at = Number(input.at) || Date.now();
  if (at > Date.now() + 60000) at = Date.now(); // no future dates
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = touchesTab_(true);
    const id = 'T' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
    const t = { id: id, cid: cid, email: clean_(input.email, 200).toLowerCase(), name: clean_(input.name, 120), channel: channel, at: at, note: clean_(input.note, 500) };
    sh.appendRow([id, t.cid, t.email, safeCell_(t.name), channel, new Date(at), safeCell_(t.note), me]);
    return { ok: true, touch: t };
  } finally {
    lock.releaseLock();
  }
}

// Undo: the row is kept but marked, so nothing is lost ("Removed (WhatsApp)").
function removeTouch(id, me) {
  id = String(id || '').trim();
  const sh = touchesTab_(false);
  if (!id || !sh || sh.getLastRow() < 2) return { error: 'not found' };
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, TOUCHES_HEADER.length).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) !== id) continue;
    if (String(vals[i][7] || '').trim().toLowerCase() !== me) return { error: 'not found' };
    sh.getRange(i + 2, 5).setValue('Removed (' + vals[i][4] + ')');
    return { ok: true, id: id };
  }
  return { error: 'not found' };
}

/* ---------- Company per contact (set on the dashboard) ---------- */
// The dashboard guesses the company from the email address; this tab stores the ones you set or correct.
const COMPANIES_TAB = 'Companies';
const COMPANIES_HEADER = ['Contact email', 'Company', 'Added by', 'Updated'];

function companiesTab_(create) {
  const ss = masterSheet_();
  let sh = ss.getSheetByName(COMPANIES_TAB);
  if (!sh && create) {
    sh = ss.insertSheet(COMPANIES_TAB);
    sh.getRange(1, 1, 1, COMPANIES_HEADER.length).setValues([COMPANIES_HEADER]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// { "person@school.edu": "Lakeside School", ... } for this person's own entries.
function getCompanies(me) {
  const sh = companiesTab_(false), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r) {
    const email = String(r[0] || '').trim().toLowerCase();
    if (email && String(r[2] || '').trim().toLowerCase() === me) out[email] = String(r[1] || '');
  });
  return out;
}

// Companies for the follow-up emails: Organisation typed on "Add & log", overridden by ones set on the dashboard.
function companiesFor_(me) {
  const out = {};
  getLeads(me).forEach(function (l) { if (l.email && l.org) out[String(l.email).toLowerCase()] = l.org; });
  const set = getCompanies(me);
  Object.keys(set).forEach(function (k) { if (set[k]) out[k] = set[k]; });
  return out;
}

function setCompany(email, company, me) {
  email = clean_(email, 200).toLowerCase();
  company = clean_(company, 120);
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return { error: 'Missing contact email.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = companiesTab_(true);
    const n = sh.getLastRow() - 1;
    const vals = n > 0 ? sh.getRange(2, 1, n, 3).getValues() : [];
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0]).trim().toLowerCase() === email && String(vals[i][2]).trim().toLowerCase() === me) {
        sh.getRange(i + 2, 2, 1, 3).setValues([[safeCell_(company), me, new Date()]]);
        return { ok: true, email: email, company: company };
      }
    }
    sh.appendRow([email, safeCell_(company), me, new Date()]);
    return { ok: true, email: email, company: company };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- "has anything changed?" version per person ---------- */

function getVer_(me) { return PropertiesService.getScriptProperties().getProperty('ver_' + me) || 'v0'; }
function bumpVer_(me) { PropertiesService.getScriptProperties().setProperty('ver_' + me, 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)); }

/* ---------- load-test helpers (run from the Apps Script editor) ---------- */

// Adds `n` fake rows (Thread ID starts with TEST-) for the script owner, to test speed with lots of mail.
function addTestRows(n) {
  n = Number(n) || 300;
  const me = ownerEmail_();
  const statuses = ['Waiting (first mail sent)', 'Waiting (follow-up 1 sent)', 'Waiting (follow-up 2 sent)', 'Replied',
    'Stopped (no reply)', 'Stopped (no reply)', 'Stopped (no reply)', 'Bounced', 'Follow-up 1 due (waiting for send window)'];
  const now = Date.now(), rows = [];
  for (let i = 0; i < n; i++) {
    const s = statuses[i % statuses.length];
    const first = new Date(now - (i % 120) * 86400000 - i * 60000);
    const fu = /follow-up 2|Stopped/.test(s) ? 2 : /follow-up 1/.test(s) ? 1 : 0;
    rows.push(['TEST-' + (100000 + i), 'Test Person ' + (i + 1), 'test' + (i + 1) + '@example.com', 'Load test mail ' + (i + 1),
      first, fu, s, new Date(first.getTime() + fu * 7 * 86400000), s === 'Replied' ? 'Thanks, sounds interesting! (test reply ' + (i + 1) + ')' : '', me, 'Test Company ' + (i % 25 + 1)]);
  }
  const sh = logTab_();
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, LOG_HEADER.length).setValues(rows);
  bumpVer_(me);
  Logger.log('Added ' + n + ' test rows for ' + me + '. Run removeTestRows to delete them.');
}
function addTestRows300() { addTestRows(300); }
function addTestRows700() { addTestRows(700); }

/* Realistic dummy outreach for trying the dashboard (run addDummyData from the editor).
   ~350 emails over the last 90 days to ~30 organisations: replies with real-looking text,
   people waiting after the first mail / follow-up 1 / follow-up 2, some follow-ups due today,
   closed (no reply) and a few bounced. Email addresses end in @example.com, a reserved domain
   that can never receive mail. Thread IDs start with TEST-, so removeTestRows deletes them all. */
function addDummyData(n) {
  n = Number(n) || 350;
  const me = ownerEmail_();
  const DAY = 86400000, now = Date.now();
  let seed = 20261125;
  const rnd = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = function (a) { return a[Math.floor(rnd() * a.length)]; };
  const orgs = ['Lakeview Institute of Technology', 'Northbridge University', 'Sunrise Public School', 'Greenfield College', 'Horizon Business School',
    'Bright Path Foundation', 'Crestwood Academy', 'Riverside International School', 'Summit Global University', 'Meridian Institute of Management',
    'Oakwood College of Engineering', 'Blue Ridge Learning Trust', 'Silverline Technologies', 'Nexa Solutions Pvt Ltd', 'Pioneer EdTech',
    'Harbor Point Ventures', 'Evergreen CSR Foundation', 'Starlight Skills Council', 'Westfield Polytechnic', 'Kestrel Analytics',
    'Maple Leaf School', 'Arcadia Institute of Design', 'Vertex Consulting Group', 'Cedar Valley University', 'Orion Labs',
    'Unity Education Society', 'Brookstone College', 'Aurora Women\'s College', 'Trident Capital Partners', 'Lotus Learning Centre'];
  const first = ['Priya', 'Rahul', 'Ananya', 'Vikram', 'Sneha', 'Arjun', 'Kavya', 'Rohan', 'Meera', 'Aditya', 'Isha', 'Karan', 'Neha', 'Siddharth',
    'Pooja', 'Aman', 'Divya', 'Nikhil', 'Riya', 'Varun', 'Tanvi', 'Harsh', 'Shreya', 'Manish', 'Aisha', 'Kunal', 'Nisha', 'Dev'];
  const last = ['Sharma', 'Iyer', 'Menon', 'Kapoor', 'Nair', 'Rao', 'Das', 'Joshi', 'Pillai', 'Bose', 'Khan', 'Mehta', 'Reddy', 'Gupta', 'Verma', 'Shah'];
  const subjects = ['OpenGrad x {org}', 'Partnership with {org}', 'Collaboration opportunity: OpenGrad and {org}',
    'Supporting {org} students with OpenGrad', 'Quick idea for {org}'];
  const replies = [
    'Thanks for reaching out. This sounds interesting. Could we set up a short call next week?',
    'Happy to explore this. Please share a brief deck or overview before we speak.',
    'We would like to know more about the programme and costs involved. Can you call me on Thursday afternoon?',
    'Thank you for the note. I have forwarded this to our placement head, who will get in touch with you.',
    'Not right now, as we are in the middle of exams. Please check back in January.',
    'This aligns well with our CSR priorities for next year. Let us connect after the 10th.',
    'Could you share a few examples of institutions you are already working with?',
    'Interesting proposal. I am travelling this week but free on Monday. Does 11 am work?',
    'We already have a similar partnership in place, but I would be open to hearing what is different.',
    'Thanks, please send over the details and our team will review them internally.',
    'Yes, we would love to collaborate. Who would be the right person on your side to coordinate?',
    'Kindly share your proposal on official letterhead and we will take it to the committee.'
  ];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const org = pick(orgs);
    const fn = pick(first), ln = pick(last);
    const domain = org.toLowerCase().replace(/pvt ltd|'s/g, '').replace(/[^a-z]+/g, '').slice(0, 18) + '.example.com';
    const email = (fn + '.' + ln).toLowerCase() + (i % 7 === 0 ? i : '') + '@' + domain;
    const subject = pick(subjects).replace('{org}', org);
    const age = Math.floor(Math.pow(rnd(), 1.8) * 90);                     // days since the first email (more recent than old)
    const firstAt = now - age * DAY - Math.floor(rnd() * 10) * 3600000;
    let fu = 0, status, lastAt = firstAt, snippet = '';
    const roll = rnd();
    if (roll < 0.03 && age > 0) {
      status = 'Bounced'; lastAt = firstAt + 3600000;
    } else if (roll < 0.17 && age > 1) {
      fu = age > 14 && rnd() < 0.4 ? (rnd() < 0.5 ? 1 : 2) : 0;            // some replied only after a follow-up
      lastAt = Math.min(now - 3600000, firstAt + fu * 7 * DAY + (1 + Math.floor(rnd() * 5)) * DAY);
      status = 'Replied'; snippet = pick(replies);
    } else if (age < 7) {
      status = 'Waiting (first mail sent)';
    } else if (age < 14) {
      if (rnd() < 0.2) { status = 'Follow-up 1 due (waiting for send window)'; lastAt = firstAt; }
      else { fu = 1; lastAt = firstAt + 7 * DAY; status = 'Waiting (follow-up 1 sent)'; }
    } else if (age < 21) {
      if (rnd() < 0.15) { fu = 1; lastAt = firstAt + 7 * DAY; status = 'Follow-up 2 due (waiting for send window)'; }
      else { fu = 2; lastAt = firstAt + 14 * DAY; status = 'Waiting (follow-up 2 sent)'; }
    } else {
      fu = 2; lastAt = firstAt + 14 * DAY; status = 'Stopped (no reply)';
    }
    rows.push(['TEST-' + (200000 + i), fn + ' ' + ln, email, subject, new Date(firstAt), fu, status, new Date(lastAt), snippet, me, org]);
  }
  rows.sort(function (a, b) { return b[4] - a[4]; });
  const sh = logTab_();
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, LOG_HEADER.length).setValues(rows);
  bumpVer_(me);
  const count = function (re) { return rows.filter(function (r) { return re.test(r[6]); }).length; };
  Logger.log('Added ' + rows.length + ' dummy emails for ' + me + ': ' + count(/^Replied$/) + ' replied, ' +
    count(/^Waiting|due/) + ' waiting, ' + count(/Stopped/) + ' closed (no reply), ' + count(/Bounced/) + ' bounced. ' +
    'Run removeTestRows to delete them again.');
}

// Deletes every row whose Thread ID starts with TEST- (your real rows are not touched).
function removeTestRows() {
  const sh = logTab_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  const keep = sh.getRange(2, 1, n, LOG_HEADER.length).getValues().filter(function (r) { return String(r[0]).indexOf('TEST-') !== 0; });
  // Real rows are written first (moved up), then only the leftover rows at the bottom are cleared.
  if (keep.length) sh.getRange(2, 1, keep.length, LOG_HEADER.length).setValues(keep);
  if (n > keep.length) sh.getRange(2 + keep.length, 1, n - keep.length, LOG_HEADER.length).clearContent();
  lock.releaseLock();
  bumpVer_(ownerEmail_());
  Logger.log('Removed ' + (n - keep.length) + ' test rows. ' + keep.length + ' real rows kept.');
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
