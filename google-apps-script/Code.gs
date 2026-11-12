/**
 * OpenGrad Outreach – Google Sheet + Gmail sync
 * ==============================================
 * Paste this whole file into the Apps Script editor of your Google Sheet
 * (Extensions → Apps Script). Full step-by-step guide: google-apps-script/SETUP.md
 *
 * What it does
 *  1. Keeps a "Contacts" tab in the sheet with one row per contact.
 *  2. Every few minutes, looks through the Gmail of each person who turned on auto-sync and
 *     fills in: email sent + date, follow-ups done, last outreach date, replied + reply date,
 *     and schedules the next follow-up.
 *  3. Optional: any email you SEND with the Gmail label "Outreach" adds a new contact automatically.
 *  4. Acts as a small private API for the dashboard (list / add / update contacts),
 *     protected by an access key.
 */

// ---------------------------------------------------------------------------
// Settings – safe to change
// ---------------------------------------------------------------------------
const CONFIG = {
  SHEET_NAME: 'Contacts',

  // Sent emails with this Gmail label create new contacts automatically. Set to '' to turn off.
  OUTREACH_LABEL: 'Outreach',

  // Follow-up rules: first follow-up N days after the first email, then every M days.
  FIRST_FOLLOW_UP_DAYS: 4,
  NEXT_FOLLOW_UP_DAYS: 7,

  // How often the automatic Gmail sync runs (must be 1, 5, 10, 15 or 30).
  SYNC_EVERY_MINUTES: 15,

  // The first time a contact is checked, look this far back in Gmail.
  LOOKBACK_DAYS: 365,

  // New contacts whose Gmail history is checked per sync run (keeps each run under Google's time limit).
  BACKFILL_PER_RUN: 25,

  // Pressing "Sync Gmail" on the dashboard won't start a new sync more often than this.
  MIN_SECONDS_BETWEEN_SYNCS: 120,

  // Optional: show nicer owner names. { 'asha@opengrad.in': 'Asha K.' }
  OWNER_NAMES: {},
};

// Allowed values – keep these in step with src/config/lists.js in the dashboard.
const LISTS = {
  reachingOutFor: ['CSR funding', 'Individual donation', 'Partnership', 'Mentorship / volunteers', 'Other'],
  nextStep: [
    'Send intro email', 'Send LinkedIn request', 'Send LinkedIn message', 'Follow-up email', 'Follow-up LinkedIn',
    'Schedule call / meeting', 'Send proposal', 'Waiting for reply', 'Close',
  ],
  interestedInFunding: ['Not known yet', 'Yes', 'Maybe', 'No'],
  fundingStatus: ['Not discussed', 'Discussing', 'Committed', 'Funded', 'Declined'],
  callOutcome: ['Positive – moving ahead', 'Needs more information', 'Asked us to wait', 'Not interested'],
};

// Column key (used by the dashboard) → header text (shown in the sheet). Columns can be in any order.
const COLUMNS = [
  ['id', 'ID'],
  ['company', 'Company'],
  ['contactPerson', 'Contact person'],
  ['designation', 'Designation'],
  ['email', 'Email'],
  ['linkedinProfile', 'LinkedIn profile'],
  ['reachingOutFor', 'Reaching out for'],
  ['emailSent', 'Email sent'],
  ['emailDate', 'Email date'],
  ['linkedinSent', 'LinkedIn sent'],
  ['linkedinDate', 'LinkedIn date'],
  ['followUpsDone', 'Follow-ups done'],
  ['lastOutreachDate', 'Last outreach date'],
  ['nextStep', 'Next step'],
  ['nextFollowUpDate', 'Next follow-up date'],
  ['replied', 'Replied'],
  ['replyDate', 'Reply date'],
  ['callDone', 'Call done'],
  ['callDate', 'Call date'],
  ['callOutcome', 'Call outcome'],
  ['callNotes', 'Call notes'],
  ['interestedInFunding', 'Interested in funding'],
  ['fundingStatus', 'Funding status'],
  ['owner', 'Owner'],
  ['notes', 'Notes'],
  ['gmailChecked', 'Gmail history checked'],
];
const BOOL_KEYS = ['emailSent', 'linkedinSent', 'replied', 'callDone'];
const DATE_KEYS = ['emailDate', 'linkedinDate', 'lastOutreachDate', 'nextFollowUpDate', 'replyDate', 'callDate', 'gmailChecked'];
const NUMBER_KEYS = ['followUpsDone'];
const EDITABLE_KEYS = COLUMNS.map((c) => c[0]).filter((k) => k !== 'id' && k !== 'gmailChecked');
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Sheet menu
// ---------------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Outreach dashboard')
    .addItem('1. Set up this sheet', 'setup')
    .addItem('2. Turn on automatic Gmail sync (for me)', 'turnOnAutoSync')
    .addSeparator()
    .addItem('Sync Gmail now', 'syncGmailFromMenu')
    .addItem('Show access key', 'showAccessKey')
    .addItem('Turn off automatic Gmail sync (for me)', 'turnOffAutoSync')
    .addToUi();
}

/** Creates/updates the Contacts tab: headers, checkboxes, dropdowns, date formats, and the access key. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) sh = ss.insertSheet(CONFIG.SHEET_NAME);

  // Add any missing headers at the end (existing columns are kept as they are).
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const missing = COLUMNS.filter(([, label]) => headers.indexOf(label) < 0).map(([, label]) => label);
  const firstEmpty = headers.every((h) => !h) ? 1 : headers.length + 1;
  if (missing.length) sh.getRange(1, firstEmpty, 1, missing.length).setValues([missing]);

  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#eef2ff');

  const map = headerMap_(sh);
  const rows = Math.max(sh.getMaxRows() - 1, 999);
  const col = (key) => sh.getRange(2, map[key] + 1, rows, 1);

  BOOL_KEYS.forEach((k) => col(k).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build()));
  DATE_KEYS.forEach((k) => col(k).setNumberFormat('yyyy-mm-dd'));
  col('followUpsDone').setNumberFormat('0');
  Object.keys(LISTS).forEach((k) => {
    col(k).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(LISTS[k], true).setAllowInvalid(false).build()
    );
  });

  const key = getOrCreateAccessKey_();
  ensureIds_(sh, map);
  safeAlert_(
    'Sheet is ready ✅\n\n' +
      'Your access key for the dashboard is:\n\n' + key + '\n\n' +
      'Next: Outreach dashboard → "2. Turn on automatic Gmail sync (for me)", then deploy as a web app (see SETUP.md).'
  );
}

/** Installs a time trigger that runs syncGmail() as YOU, reading YOUR Gmail. Each teammate can do this. */
function turnOnAutoSync() {
  turnOffAutoSync(true);
  ScriptApp.newTrigger('syncGmail').timeBased().everyMinutes(CONFIG.SYNC_EVERY_MINUTES).create();
  const result = syncGmail();
  safeAlert_(
    'Automatic Gmail sync is ON for ' + Session.getEffectiveUser().getEmail() +
      ' (every ' + CONFIG.SYNC_EVERY_MINUTES + ' minutes).\n\nFirst sync: ' + describeSync_(result)
  );
}

function turnOffAutoSync(silent) {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'syncGmail')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  if (silent !== true) safeAlert_('Automatic Gmail sync is OFF for you.');
}

function syncGmailFromMenu() {
  safeAlert_('Sync finished: ' + describeSync_(syncGmail()));
}

function showAccessKey() {
  safeAlert_('Dashboard access key:\n\n' + getOrCreateAccessKey_() + '\n\nShare it only with the OpenGrad team.');
}

// ---------------------------------------------------------------------------
// Gmail sync
// ---------------------------------------------------------------------------

/**
 * Reads the Gmail of the person running it and updates the Contacts tab.
 * - New contacts (never checked): looks back CONFIG.LOOKBACK_DAYS for all emails with them.
 * - Everyone else: only looks at messages since this person's last sync, so it stays fast.
 */
function syncGmail() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) return { skipped: true };
  try {
    const me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
    const userProps = PropertiesService.getUserProperties();
    const now = new Date();
    const lastRun = userProps.getProperty('LAST_GMAIL_SYNC');
    const since = lastRun ? new Date(lastRun) : new Date(now.getTime() - CONFIG.LOOKBACK_DAYS * DAY_MS);

    const sh = getSheet_();
    let added = 0;
    if (CONFIG.OUTREACH_LABEL) added = addContactsFromLabel_(sh, me, since);

    const table = readTable_(sh);
    const rowByEmail = {};
    table.records.forEach((rec, i) => {
      const e = normEmail_(rec.email);
      if (e) rowByEmail[e] = i;
    });

    // 1) Back-fill: full Gmail history for contacts that were never checked.
    const backfilled = {};
    const fullActivity = {};
    table.records
      .filter((rec) => normEmail_(rec.email) && !rec.gmailChecked)
      .slice(0, CONFIG.BACKFILL_PER_RUN)
      .forEach((rec) => {
        const e = normEmail_(rec.email);
        backfilled[e] = true;
        fullActivity[e] = historyFor_(e);
      });

    // 2) Recent: every message since the last run, matched to contacts.
    const recentActivity = recentActivity_(since, rowByEmail, backfilled);

    // 3) Write changes.
    let updated = 0;
    const todayStr = dayKey_(now);
    Object.keys(rowByEmail).forEach((e) => {
      const i = rowByEmail[e];
      const rec = table.records[i];
      let changes = {};
      if (backfilled[e]) {
        changes = applyActivity_(rec, fullActivity[e], true, me);
        changes.gmailChecked = todayStr;
      } else if (recentActivity[e]) {
        changes = applyActivity_(rec, recentActivity[e], false, me);
      }
      if (Object.keys(changes).length) {
        writeChanges_(sh, table.map, table.rowNumbers[i], changes);
        if (Object.keys(changes).some((k) => k !== 'gmailChecked')) updated++;
      }
    });

    userProps.setProperty('LAST_GMAIL_SYNC', now.toISOString());
    PropertiesService.getScriptProperties().setProperty('LAST_SYNCED', now.toISOString());
    return { added: added, updated: updated };
  } finally {
    lock.releaseLock();
  }
}

/** All emails with one contact (both directions) in the last LOOKBACK_DAYS. */
function historyFor_(email) {
  const act = { sent: [], received: [] };
  const query = '(from:' + email + ' OR to:' + email + ' OR cc:' + email + ') newer_than:' + CONFIG.LOOKBACK_DAYS + 'd';
  GmailApp.search(query, 0, 50).forEach((thread) => {
    thread.getMessages().forEach((m) => {
      if (m.isDraft()) return;
      const from = extractEmails_(m.getFrom());
      const to = extractEmails_([m.getTo(), m.getCc(), m.getBcc()].join(','));
      if (from.indexOf(email) >= 0) act.received.push(m.getDate());
      else if (to.indexOf(email) >= 0) act.sent.push(m.getDate());
    });
  });
  return act;
}

/** Messages since `since`, grouped by contact email: { email: { sent: [dates], received: [dates] } } */
function recentActivity_(since, rowByEmail, skip) {
  const out = {};
  const add = (email, kind, date) => {
    if (!(email in rowByEmail) || skip[email]) return;
    out[email] = out[email] || { sent: [], received: [] };
    out[email][kind].push(date);
  };
  const query = 'after:' + Math.floor(since.getTime() / 1000);
  GmailApp.search(query, 0, 300).forEach((thread) => {
    thread.getMessages().forEach((m) => {
      if (m.isDraft() || m.getDate() <= since) return;
      const from = extractEmails_(m.getFrom());
      const fromContact = from.filter((e) => e in rowByEmail);
      if (fromContact.length) {
        fromContact.forEach((e) => add(e, 'received', m.getDate()));
        return;
      }
      extractEmails_([m.getTo(), m.getCc(), m.getBcc()].join(',')).forEach((e) => add(e, 'sent', m.getDate()));
    });
  });
  return out;
}

/**
 * Turns Gmail activity into sheet changes.
 * full = true: `act` is the whole history; false: `act` is only new messages since the last run.
 */
function applyActivity_(rec, act, full, me) {
  const ch = {};
  const sent = act.sent.slice().sort((a, b) => a - b);
  const recv = act.received.slice().sort((a, b) => a - b);
  const lastSent = sent.length ? sent[sent.length - 1] : null;
  const lastReply = recv.length ? recv[recv.length - 1] : null;
  const prevFollowUps = Number(rec.followUpsDone) || 0;
  let followUps = prevFollowUps;

  if (sent.length) {
    if (!rec.emailSent) ch.emailSent = true;
    if (!rec.emailDate || dayKey_(sent[0]) < rec.emailDate) ch.emailDate = dayKey_(sent[0]);
    followUps = full
      ? Math.max(prevFollowUps, sent.length - 1)
      : prevFollowUps + (rec.emailSent ? sent.length : sent.length - 1);
    if (followUps !== prevFollowUps) ch.followUpsDone = followUps;
    if (!rec.lastOutreachDate || dayKey_(lastSent) > rec.lastOutreachDate) ch.lastOutreachDate = dayKey_(lastSent);
    if (!rec.owner) ch.owner = ownerName_(me);
  }
  if (recv.length) {
    if (!rec.replied) ch.replied = true;
    if (!rec.replyDate || dayKey_(lastReply) > rec.replyDate) ch.replyDate = dayKey_(lastReply);
  }

  // Schedule the next follow-up, unless the contact is closed.
  const closed = rec.nextStep === 'Close' || rec.fundingStatus === 'Declined' || rec.fundingStatus === 'Funded';
  if (!closed) {
    const theyWroteLast = lastReply && (!lastSent || lastReply > lastSent);
    if (theyWroteLast && ch.replyDate) {
      // They replied: we owe them an answer, due from the day they wrote.
      ch.nextFollowUpDate = dayKey_(lastReply);
      if (['', 'Send intro email', 'Waiting for reply', 'Follow-up LinkedIn'].indexOf(rec.nextStep || '') >= 0) {
        ch.nextStep = 'Follow-up email';
      }
    } else if (!theyWroteLast && lastSent && ch.lastOutreachDate) {
      // We wrote last: follow up after the rule's number of days.
      const days = followUps === 0 ? CONFIG.FIRST_FOLLOW_UP_DAYS : CONFIG.NEXT_FOLLOW_UP_DAYS;
      ch.nextFollowUpDate = dayKey_(new Date(lastSent.getTime() + days * DAY_MS));
      if (['', 'Send intro email', 'Follow-up email'].indexOf(rec.nextStep || '') >= 0) ch.nextStep = 'Waiting for reply';
    }
  }
  return ch;
}

/** Sent emails labelled CONFIG.OUTREACH_LABEL → new contact rows for unknown recipients. */
function addContactsFromLabel_(sh, me, since) {
  const label = CONFIG.OUTREACH_LABEL.trim().replace(/\s+/g, '-');
  const myDomain = me.split('@')[1] || '';
  const table = readTable_(sh);
  const known = {};
  table.records.forEach((r) => {
    const e = normEmail_(r.email);
    if (e) known[e] = true;
  });

  const query = 'label:' + label + ' in:sent after:' + Math.floor(since.getTime() / 1000);
  const newRows = [];
  GmailApp.search(query, 0, 100).forEach((thread) => {
    thread.getMessages().forEach((m) => {
      if (m.isDraft() || extractEmails_(m.getFrom()).indexOf(me) < 0) return;
      splitRecipients_(m.getTo()).forEach((r) => {
        if (!r.email || known[r.email] || r.email.split('@')[1] === myDomain) return;
        known[r.email] = true;
        newRows.push({
          id: newId_(),
          company: guessCompany_(r.email),
          contactPerson: r.name,
          email: r.email,
          reachingOutFor: 'Other',
          interestedInFunding: 'Not known yet',
          fundingStatus: 'Not discussed',
          owner: ownerName_(me),
          notes: 'Added automatically from Gmail (label "' + CONFIG.OUTREACH_LABEL + '")',
        });
      });
    });
  });
  newRows.forEach((rec) => appendRecord_(sh, table.map, rec));
  return newRows.length;
}

// ---------------------------------------------------------------------------
// Web app API for the dashboard (POST only, so the access key never sits in a URL)
// ---------------------------------------------------------------------------
function doGet() {
  return json_({ ok: true, message: 'OpenGrad Outreach API is running. The dashboard talks to it with POST requests.' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkKey_(body.key);
    const sh = getSheet_();

    if (body.action === 'list') {
      if (body.sync) maybeSync_();
      const table = readTable_(sh);
      return json_({
        ok: true,
        records: table.records.map(publicRecord_),
        lastSynced: PropertiesService.getScriptProperties().getProperty('LAST_SYNCED') || new Date().toISOString(),
      });
    }

    if (body.action === 'add') {
      const rec = cleanInput_(body.record || {});
      if (!rec.company && !rec.contactPerson && !rec.email) throw new Error('Add at least a company, a name or an email.');
      return withLock_(() => {
        const table = readTable_(sh);
        const email = normEmail_(rec.email);
        if (email && table.records.some((r) => normEmail_(r.email) === email)) {
          throw new Error('A contact with the email ' + email + ' already exists.');
        }
        rec.id = newId_();
        appendRecord_(sh, table.map, rec);
        return json_({ ok: true, record: publicRecord_(findById_(sh, rec.id).record) });
      });
    }

    if (body.action === 'update') {
      const changes = cleanInput_(body.changes || {});
      return withLock_(() => {
        const found = findById_(sh, body.id);
        if (!found) throw new Error('That contact was not found. Refresh and try again.');
        writeChanges_(sh, found.map, found.rowNumber, changes);
        return json_({ ok: true, record: publicRecord_(findById_(sh, body.id).record) });
      });
    }

    throw new Error('Unknown action.');
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function maybeSync_() {
  const last = PropertiesService.getScriptProperties().getProperty('LAST_SYNCED');
  if (!last || Date.now() - new Date(last).getTime() > CONFIG.MIN_SECONDS_BETWEEN_SYNCS * 1000) {
    try {
      syncGmail();
    } catch (err) {
      console.error('Sync from dashboard failed: ' + err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------------
function getSheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) throw new Error('The "' + CONFIG.SHEET_NAME + '" tab is missing. Run "Outreach dashboard → 1. Set up this sheet".');
  return sh;
}

function headerMap_(sh) {
  const headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map((h) => String(h).trim());
  const map = {};
  COLUMNS.forEach(([key, label]) => {
    const i = headers.indexOf(label);
    if (i >= 0) map[key] = i;
  });
  return map;
}

/** { records, rowNumbers, map } – blank rows are skipped. Missing IDs are filled in. */
function readTable_(sh) {
  const map = headerMap_(sh);
  ensureIds_(sh, map);
  const values = sh.getDataRange().getValues();
  const records = [];
  const rowNumbers = [];
  for (let r = 1; r < values.length; r++) {
    const rec = rowToRecord_(values[r], map);
    if (!rec.company && !rec.contactPerson && !rec.email) continue;
    records.push(rec);
    rowNumbers.push(r + 1);
  }
  return { records: records, rowNumbers: rowNumbers, map: map };
}

function rowToRecord_(row, map) {
  const tz = Session.getScriptTimeZone();
  const rec = {};
  COLUMNS.forEach(([key]) => {
    const i = map[key];
    let v = i === undefined ? '' : row[i];
    if (BOOL_KEYS.indexOf(key) >= 0) v = v === true || /^(true|yes|y|1)$/i.test(String(v).trim());
    else if (NUMBER_KEYS.indexOf(key) >= 0) v = Number(v) || 0;
    else if (DATE_KEYS.indexOf(key) >= 0) v = v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v || '').trim();
    else v = String(v === null || v === undefined ? '' : v).trim();
    rec[key] = v;
  });
  return rec;
}

function toCell_(key, value) {
  if (BOOL_KEYS.indexOf(key) >= 0) return value === true;
  if (NUMBER_KEYS.indexOf(key) >= 0) return Number(value) || 0;
  if (DATE_KEYS.indexOf(key) >= 0) {
    if (!value) return '';
    const s = value instanceof Date ? dayKey_(value) : String(value).slice(0, 10);
    return Utilities.parseDate(s, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value === null || value === undefined ? '' : String(value);
}

function writeChanges_(sh, map, rowNumber, changes) {
  Object.keys(changes).forEach((key) => {
    if (map[key] === undefined) return;
    sh.getRange(rowNumber, map[key] + 1).setValue(toCell_(key, changes[key]));
  });
}

function appendRecord_(sh, map, rec) {
  const width = sh.getLastColumn();
  const row = new Array(width).fill('');
  COLUMNS.forEach(([key]) => {
    if (map[key] !== undefined && rec[key] !== undefined) row[map[key]] = toCell_(key, rec[key]);
  });
  sh.appendRow(row);
}

function findById_(sh, id) {
  if (!id) return null;
  const table = readTable_(sh);
  const i = table.records.findIndex((r) => r.id === String(id));
  return i < 0 ? null : { record: table.records[i], rowNumber: table.rowNumbers[i], map: table.map };
}

function ensureIds_(sh, map) {
  if (map.id === undefined || sh.getLastRow() < 2) return;
  const range = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn());
  const values = range.getValues();
  values.forEach((row, i) => {
    const hasData = ['company', 'contactPerson', 'email'].some((k) => map[k] !== undefined && String(row[map[k]]).trim());
    if (hasData && !String(row[map.id]).trim()) sh.getRange(i + 2, map.id + 1).setValue(newId_());
  });
}

/** Only allowed keys, trimmed and typed. Unknown keys are ignored. */
function cleanInput_(input) {
  const out = {};
  EDITABLE_KEYS.forEach((key) => {
    if (!(key in input)) return;
    let v = input[key];
    if (BOOL_KEYS.indexOf(key) >= 0) v = v === true;
    else if (NUMBER_KEYS.indexOf(key) >= 0) v = Math.max(0, Math.round(Number(v) || 0));
    else if (DATE_KEYS.indexOf(key) >= 0) v = /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '';
    else v = String(v === null || v === undefined ? '' : v).trim().slice(0, 2000);
    if (LISTS[key] && v && LISTS[key].indexOf(v) < 0) throw new Error('"' + v + '" is not an allowed value for ' + key + '.');
    out[key] = v;
  });
  return out;
}

function publicRecord_(rec) {
  const out = Object.assign({}, rec);
  delete out.gmailChecked;
  return out;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function getOrCreateAccessKey_() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('ACCESS_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('ACCESS_KEY', key);
  }
  return key;
}

function checkKey_(provided) {
  const key = PropertiesService.getScriptProperties().getProperty('ACCESS_KEY');
  if (!key) throw new Error('The sheet is not set up yet. Run "Outreach dashboard → 1. Set up this sheet".');
  if (String(provided || '') !== key) throw new Error('Wrong access key.');
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20 * 1000)) throw new Error('The sheet is busy. Try again in a moment.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function dayKey_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function normEmail_(v) {
  const m = String(v || '').toLowerCase().match(/[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  return m ? m[0] : '';
}

function extractEmails_(text) {
  return (String(text || '').toLowerCase().match(/[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || []);
}

/** "Asha K <asha@x.org>, bob@y.com" → [{ name, email }] */
function splitRecipients_(text) {
  return String(text || '')
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((part) => {
      const email = normEmail_(part);
      const name = part.replace(/<[^>]*>/, '').replace(/["']/g, '').trim();
      return { email: email, name: name && name.toLowerCase() !== email ? name : '' };
    });
}

function guessCompany_(email) {
  const domain = (email.split('@')[1] || '').toLowerCase();
  const free = ['gmail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com', 'hotmail.com', 'icloud.com', 'rediffmail.com', 'proton.me'];
  if (!domain || free.indexOf(domain) >= 0) return 'Individual donor';
  const name = domain.split('.')[0].replace(/[-_]/g, ' ');
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

function ownerName_(email) {
  if (!email) return '';
  return CONFIG.OWNER_NAMES[email] || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function newId_() {
  return 'c-' + Utilities.getUuid().slice(0, 8);
}

function describeSync_(result) {
  if (!result || result.skipped) return 'another sync was already running, so this one was skipped.';
  return result.updated + ' contact(s) updated, ' + result.added + ' new contact(s) added from Gmail.';
}

function safeAlert_(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (err) {
    console.log(msg); // Running from the editor or a trigger: message goes to the execution log.
  }
}
