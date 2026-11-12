/**
 * OpenGrad Outreach - JSON API for the dashboard website.
 *
 * This is a SEPARATE Apps Script project from the hourly follow-up script.
 *  - It only READS the "Follow-up Log" tab (never changes it).
 *  - It can add contacts to a "Leads" tab (people you plan to email). That tab is
 *    created automatically the first time you add someone.
 *  - It stores small "stage" marks (call / whatsapp) in its own Script Properties.
 * It never sends email.
 *
 * Your sheet ID and token live in the separate "Settings" file (Settings.gs),
 * so this whole file can be replaced on updates.
 */

const LOG_TAB = 'Follow-up Log';
const LEADS_TAB = 'Leads';
const LEADS_HEADER = ['Lead ID', 'Name', 'Email', 'Organisation', 'Subject', 'Notes', 'Added', 'Status', 'Channel', 'Contacted On'];
const CHANNELS = ['Email', 'LinkedIn', 'Call', 'WhatsApp', 'In person', 'Other'];

/* ---------- entry points ---------- */

// Reading data (and the simple "mark" action).
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!authorized_(p.token)) return json_({ error: 'unauthorized' });
  try {
    if (p.action === 'mark') return json_(markStage(p.id, p.stage));
    return json_({ rows: getData(), leads: getLeads() });
  } catch (err) {
    return json_({ error: errText_(err) });
  }
}

// Changing data: the website sends a small JSON message in the request body.
function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ error: 'bad request' }); }
  if (!authorized_(body.token)) return json_({ error: 'unauthorized' });
  try {
    if (body.action === 'addLead') return json_(addLead(body.lead || {}));
    if (body.action === 'contactedLead') return json_(updateLead(body.id, { status: 'Contacted', channel: body.channel, contactedOn: body.contactedOn }));
    if (body.action === 'removeLead') return json_(updateLead(body.id, { status: 'Removed' }));
    if (body.action === 'mark') return json_(markStage(body.id, body.stage));
    return json_({ error: 'unknown action' });
  } catch (err) {
    return json_({ error: errText_(err) });
  }
}

/* ---------- Follow-up Log (read only) ---------- */

function getData() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const rows = [];

  sheetIds_().forEach(function (sheetId) {
    const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(LOG_TAB);
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
    values.forEach(function (r) {
      const id = String(r[0] || '').trim();
      if (!id) return;
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

function markStage(id, stage) {
  id = String(id || '').trim();
  if (!id) return { error: 'missing id' };
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

function getLeads() {
  const sheet = leadsSheet_(false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const width = Math.max(sheet.getLastColumn(), LEADS_HEADER.length);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  const leads = [];
  values.forEach(function (r) {
    const id = String(r[0] || '').trim();
    const status = String(r[7] || '').trim();
    if (!id || /^removed$/i.test(status)) return;
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

function addLead(input) {
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
      const dup = getLeads().filter(function (l) { return l.email.toLowerCase() === email && l.status === 'To contact'; })[0];
      if (dup) return { error: email + ' is already in your To contact list.', duplicate: true };
    }
    const id = 'L' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    const status = done ? 'Contacted' : 'To contact';
    sheet.appendRow([id, safeCell_(name), email, safeCell_(lead.org), safeCell_(lead.subject), safeCell_(lead.notes),
      new Date(), status, channel, contactedOn]);
    return { ok: true, lead: { id: id, name: name, email: email, org: lead.org, subject: lead.subject, notes: lead.notes,
      added: Date.now(), status: status, channel: channel, contactedOn: contactedOn ? contactedOn.getTime() : null } };
  } finally {
    lock.releaseLock();
  }
}

// Change a lead's status ("Contacted" with channel/date, or "Removed").
function updateLead(id, change) {
  id = String(id || '').trim();
  const sheet = leadsSheet_(false);
  if (!id || !sheet || sheet.getLastRow() < 2) return { error: 'not found' };
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() !== id) continue;
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
  }
  return sheet;
}

function authorized_(token) {
  return typeof API_TOKEN === 'string' && API_TOKEN !== 'CHANGE-THIS' && API_TOKEN.length > 0 && token === API_TOKEN;
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
