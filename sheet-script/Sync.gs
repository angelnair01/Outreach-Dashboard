/**
 * OpenGrad Outreach - Gmail sync for the MASTER sheet (multi-user).
 *
 * Paste this into the master sheet: Extensions > Apps Script.
 * Every person whose outreach should be tracked opens the sheet once and clicks
 *   Outreach > Connect my Gmail   (then "Allow").
 * From then on, every minute, for THAT person's Gmail:
 *   - threads labelled "Outreach" are written to the "Follow-up Log" tab, tagged "Sent by" = their Gmail
 *   - replies are detected (status "Replied", label "Outreach-Replied", reply text saved)
 *   - bounces are detected (status "Bounced")
 *   - after 7 days without reply, follow-up 1 is sent in the same thread, 7 days later follow-up 2,
 *     then it stops ("Stopped (no reply)", label "Outreach-Done")
 * Everyone's rows live in this one sheet. The dashboard shows each person only their own rows.
 *
 * SAFETY
 *   MODE = 'test' : reads and logs everything, sends NOTHING (status "TEST: would send follow-up N").
 *   MODE = 'live' : actually sends follow-ups.
 *   A thread first seen when it is already older than MAX_AGE_DAYS_FOR_NEW never gets follow-ups.
 *   Follow-ups already in a Gmail thread are counted, so nothing is sent twice.
 *   At most MAX_SENDS_PER_RUN follow-ups per run, only inside the send window.
 */

/* ===================== SETTINGS (safe to edit) ===================== */

const MODE = 'test';                    // 'test' first. Change to 'live' when the dashboard looks right.

const OUTREACH_LABEL = 'Outreach';
const REPLIED_LABEL = 'Outreach-Replied';
const DONE_LABEL = 'Outreach-Done';

const FOLLOWUP_DAYS = 7;                // days without reply before each follow-up
const MAX_FOLLOWUPS = 2;
const MAX_AGE_DAYS_FOR_NEW = 30;        // older threads seen for the first time: logged, never followed up
const MAX_SENDS_PER_RUN = 10;

const SEND_DAYS = [1, 2, 3, 4, 5];      // 0 = Sunday ... 6 = Saturday (sheet script time zone)
const SEND_FROM_HOUR = 9;               // 09:00
const SEND_TO_HOUR = 18;                // until 18:00

// {first_name} {sender_name} {subject} are filled in automatically.
const FOLLOWUP_TEMPLATES = [
  'Hi {first_name},\n\nI wanted to follow up on my email below in case it got buried. ' +
  'I would love to hear your thoughts whenever you have a moment.\n\nBest regards,\n{sender_name}',

  'Hi {first_name},\n\nJust checking in one last time on my note below. ' +
  'If now is not the right time, no worries at all, happy to reconnect later.\n\nBest regards,\n{sender_name}'
];

/* ===================== (no need to edit below) ===================== */

const LOG_TAB = 'Follow-up Log';
const ACCOUNTS_TAB = 'Accounts';
const LOG_HEADER = ['Thread ID', 'Contact', 'Email', 'Subject', 'First Sent', 'Follow-ups Sent', 'Status', 'Last Action', 'Reply Snippet', 'Sent by'];
const COL = { id: 0, name: 1, email: 2, subject: 3, first: 4, fu: 5, status: 6, last: 7, snippet: 8, sentBy: 9 };
const QUICK_THREADS = 50;               // newest Outreach threads checked every minute
const FULL_THREADS = 500;               // all Outreach threads checked every 30 minutes
const FULL_EVERY_MIN = 30;
const DAY = 86400000;

/* ---------- menu ---------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Outreach')
    .addItem('Connect my Gmail', 'connectMyGmail')
    .addItem('Sync my Gmail now', 'syncNow')
    .addItem('My status', 'showMyStatus')
    .addSeparator()
    .addItem('Disconnect my Gmail', 'disconnectMyGmail')
    .addToUi();
}

function connectMyGmail() {
  const ui = SpreadsheetApp.getUi();
  const me = myEmail_();
  const acc = accountsTab_();
  let row = findAccountRow_(acc, me);
  if (!row) {
    const r = ui.prompt('Connect my Gmail', 'Your name, used to sign follow-up emails (e.g. "Angel Nair"):', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    const name = String(r.getResponseText() || '').trim() || me.split('@')[0];
    const h = acc.header;
    const newRow = new Array(Math.max(h.length, 3)).fill('');
    newRow[acc.emailCol] = me; newRow[acc.nameCol] = name; newRow[acc.statusCol] = 'Active';
    acc.sheet.appendRow(newRow);
  } else {
    setActive_(acc, row, true);
  }
  logSheet_(); // make sure the tab + "Sent by" column exist
  removeMyTriggers_();
  ScriptApp.newTrigger('syncMine').timeBased().everyMinutes(1).create();
  PropertiesService.getUserProperties().deleteProperty('lastFull');
  const res = syncMine();
  ui.alert('Connected',
    me + ' is now connected.\n\nYour emails labelled "' + OUTREACH_LABEL + '" are checked every minute and appear on the dashboard when you sign in with this Gmail.\n\n' +
    'First sync: ' + (res ? res.summary : 'done') + '\nMode: ' + MODE.toUpperCase() + (MODE === 'test' ? ' (no follow-ups are sent)' : ''),
    ui.ButtonSet.OK);
}

function disconnectMyGmail() {
  removeMyTriggers_();
  const acc = accountsTab_();
  const row = findAccountRow_(acc, myEmail_());
  if (row) setActive_(acc, row, false);
  SpreadsheetApp.getUi().alert('Disconnected. Your Gmail is no longer checked. Your rows stay in the sheet.');
}

function syncNow() {
  PropertiesService.getUserProperties().deleteProperty('lastFull');
  const res = syncMine();
  SpreadsheetApp.getUi().alert('Sync done: ' + (res ? res.summary : 'skipped (not connected or busy)'));
}

function showMyStatus() {
  const me = myEmail_();
  const acc = accountsTab_();
  const row = findAccountRow_(acc, me);
  const status = row ? acc.sheet.getRange(row, acc.statusCol + 1).getValue() : 'not connected';
  const timers = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'syncMine'; }).length;
  SpreadsheetApp.getUi().alert(me + '\nAccounts tab: ' + status + '\nAutomatic sync: ' + (timers ? 'ON (every minute)' : 'OFF') + '\nMode: ' + MODE);
}

/* ---------- the sync (runs every minute, as each connected person) ---------- */

function syncMine() {
  const me = myEmail_();
  const acc = accountsTab_();
  const accRow = findAccountRow_(acc, me);
  if (!accRow) return null;
  const accVals = acc.sheet.getRange(accRow, 1, 1, acc.sheet.getLastColumn()).getValues()[0];
  if (!isActive_(accVals[acc.statusCol])) return null;
  const senderName = String(accVals[acc.nameCol] || '').trim() || me.split('@')[0];

  const props = PropertiesService.getUserProperties();
  const now = Date.now();
  const full = now - Number(props.getProperty('lastFull') || 0) > FULL_EVERY_MIN * 60000;
  const threads = GmailApp.search('label:"' + OUTREACH_LABEL + '"', 0, full ? FULL_THREADS : QUICK_THREADS);
  if (full) props.setProperty('lastFull', String(now));

  const myAddrs = [me].concat(GmailApp.getAliases().map(function (a) { return a.toLowerCase(); }));
  const sh = logSheet_();
  const existing = readMyRows_(sh, me);         // key threadId -> { rowNum, vals }
  const updates = [];                            // { rowNum, vals }
  const appends = [];
  let sends = 0, changed = 0;
  const labels = {};
  const label = function (n) { return labels[n] || (labels[n] = GmailApp.getUserLabelByName(n) || GmailApp.createLabel(n)); };

  threads.forEach(function (thread) {
    const id = thread.getId();
    const ex = existing[id];
    const lastMsgMs = thread.getLastMessageDate().getTime();
    const prev = ex ? ex.vals : null;

    // Unchanged thread and not time for a follow-up: nothing to do (no extra Gmail reads).
    if (prev && Math.abs(toMs_(prev[COL.last]) - lastMsgMs) < 1000 && !needsTimeCheck_(prev, now)) {
      if (!String(prev[COL.sentBy]).trim()) { prev[COL.sentBy] = me; updates.push(ex); }
      return;
    }

    const a = analyze_(thread, myAddrs);
    if (!a) return; // labelled, but no mail from me in it

    let status, fu = a.fu, last = a.lastMs;
    if (a.bounced) {
      status = 'Bounced';
      thread.addLabel(label(DONE_LABEL));
    } else if (a.replied) {
      status = 'Replied';
      thread.addLabel(label(REPLIED_LABEL));
    } else if (fu >= MAX_FOLLOWUPS) {
      if (now - a.lastMineMs >= FOLLOWUP_DAYS * DAY) { status = 'Stopped (no reply)'; thread.addLabel(label(DONE_LABEL)); }
      else status = 'Waiting (follow-up ' + fu + ' sent)';
    } else if (now - a.lastMineMs < FOLLOWUP_DAYS * DAY) {
      status = fu ? 'Waiting (follow-up ' + fu + ' sent)' : 'Waiting (first mail sent)';
    } else if (!prev && now - a.firstMs > MAX_AGE_DAYS_FOR_NEW * DAY) {
      status = 'Stopped (older than ' + MAX_AGE_DAYS_FOR_NEW + ' days, not followed up)';
    } else if (prev && /older than/i.test(String(prev[COL.status]))) {
      status = String(prev[COL.status]);
    } else {
      const n = fu + 1;
      if (MODE !== 'live') status = 'TEST: would send follow-up ' + n;
      else if (!inSendWindow_(new Date(now))) status = 'Follow-up ' + n + ' due (waiting for send window)';
      else if (sends >= MAX_SENDS_PER_RUN) status = 'Follow-up ' + n + ' due (waiting for send window)';
      else {
        sendFollowUp_(thread, a, n, senderName, me);
        sends++; fu = n; last = Date.now();
        status = 'Follow-up ' + n + ' sent';
      }
    }

    const vals = [id, a.name, a.email, a.subject, new Date(a.firstMs), fu, status, new Date(last), a.snippet, me];
    if (prev) {
      const same = vals.every(function (v, i) { return i === COL.first || i === COL.last ? Math.abs(toMs_(prev[i]) - toMs_(v)) < 1000 : String(prev[i]) === String(v); });
      if (!same) { updates.push({ rowNum: ex.rowNum, vals: vals }); changed++; }
    } else {
      appends.push(vals); changed++;
    }
  });

  // Write everything in one go, holding a lock so two people syncing at once don't clash.
  if (updates.length || appends.length) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      updates.forEach(function (u) { sh.getRange(u.rowNum, 1, 1, LOG_HEADER.length).setValues([u.vals.slice(0, LOG_HEADER.length)]); });
      if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, LOG_HEADER.length).setValues(appends);
    } finally { lock.releaseLock(); }
  }
  return { summary: threads.length + ' Outreach threads checked, ' + changed + ' updated, ' + sends + ' follow-ups sent', sends: sends, changed: changed };
}

/* ---------- reading one Gmail thread ---------- */

function analyze_(thread, myAddrs) {
  const msgs = thread.getMessages();
  const isMine = function (m) { return myAddrs.indexOf(addr_(m.getFrom())) >= 0; };
  const isBounce = function (m) {
    return /mailer-daemon|postmaster/i.test(m.getFrom()) ||
      /delivery status notification|undeliverable|delivery has failed|returned mail|mail delivery failed/i.test(m.getSubject());
  };
  let firstIdx = -1;
  for (let i = 0; i < msgs.length; i++) if (isMine(msgs[i])) { firstIdx = i; break; }
  if (firstIdx < 0) return null;
  const first = msgs[firstIdx];
  const to = parseAddress_(String(first.getTo()).split(',')[0]);

  let fu = 0, replied = false, bounced = false, replyMsg = null, lastMineMs = first.getDate().getTime();
  for (let i = firstIdx + 1; i < msgs.length; i++) {
    const m = msgs[i];
    if (isBounce(m)) { bounced = true; continue; }
    if (isMine(m)) {
      lastMineMs = m.getDate().getTime();
      if (!replied) fu++;
    } else {
      replied = true; replyMsg = m;
    }
  }
  return {
    name: to.name, email: to.email,
    subject: String(first.getSubject() || '').replace(/^(re|fwd?):\s*/i, ''),
    firstMs: first.getDate().getTime(),
    lastMs: msgs[msgs.length - 1].getDate().getTime(),
    lastMineMs: lastMineMs,
    fu: Math.min(fu, MAX_FOLLOWUPS),
    replied: replied, bounced: bounced && !replied,
    snippet: replyMsg ? cleanReply_(replyMsg.getPlainBody()) : '',
    lastMessage: msgs[msgs.length - 1]
  };
}

function sendFollowUp_(thread, a, n, senderName, me) {
  const tpl = FOLLOWUP_TEMPLATES[Math.min(n, FOLLOWUP_TEMPLATES.length) - 1];
  const firstName = (a.name || '').split(/\s+/)[0] || 'there';
  const body = tpl.replace(/\{first_name\}/g, firstName).replace(/\{sender_name\}/g, senderName).replace(/\{subject\}/g, a.subject);
  const subject = /^re:/i.test(a.subject) ? a.subject : 'Re: ' + a.subject;
  const msgId = a.lastMessage.getHeader('Message-ID');
  const enc = function (s) { return '=?UTF-8?B?' + Utilities.base64Encode(s, Utilities.Charset.UTF_8) + '?='; };
  const mime = [
    'From: ' + enc(senderName) + ' <' + me + '>',
    'To: ' + a.email,
    'Subject: ' + enc(subject),
    msgId ? 'In-Reply-To: ' + msgId : '',
    msgId ? 'References: ' + msgId : '',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Utilities.base64Encode(body, Utilities.Charset.UTF_8)
  ].filter(function (l, i, arr) { return l !== '' || i === arr.length - 2; }).join('\r\n');
  // Gmail API (advanced service "Gmail") keeps the follow-up inside the same conversation.
  Gmail.Users.Messages.send({ raw: Utilities.base64EncodeWebSafe(mime, Utilities.Charset.UTF_8), threadId: thread.getId() }, 'me');
}

/* ---------- sheet helpers ---------- */

function logSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(LOG_TAB);
  if (!sh) {
    sh = ss.insertSheet(LOG_TAB);
    sh.getRange(1, 1, 1, LOG_HEADER.length).setValues([LOG_HEADER]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (String(sh.getRange(1, COL.sentBy + 1).getValue()).trim() !== 'Sent by') {
    sh.getRange(1, COL.sentBy + 1).setValue('Sent by').setFontWeight('bold');
  }
  return sh;
}

// My rows, plus older rows with no "Sent by" (claimed if the thread is found in my Gmail).
function readMyRows_(sh, me) {
  const out = {};
  const n = sh.getLastRow() - 1;
  if (n < 1) return out;
  sh.getRange(2, 1, n, LOG_HEADER.length).getValues().forEach(function (v, i) {
    const id = String(v[COL.id] || '').trim();
    const by = String(v[COL.sentBy] || '').trim().toLowerCase();
    if (id && (by === me || !by)) out[id] = { rowNum: i + 2, vals: v };
  });
  return out;
}

// Waiting rows may need a follow-up even when nothing new arrived in Gmail.
function needsTimeCheck_(vals, now) {
  const s = String(vals[COL.status] || '');
  if (/replied|bounced|stopped/i.test(s)) return false;
  // Already marked as due: only look again when a follow-up could actually be sent now.
  if (/TEST: would send|due \(waiting/i.test(s)) return MODE === 'live' && inSendWindow_(new Date(now));
  return now - toMs_(vals[COL.last]) >= FOLLOWUP_DAYS * DAY;
}

function isActive_(v) {
  return v === true || ['active', 'true', 'yes', 'y', '1'].indexOf(String(v).trim().toLowerCase()) >= 0;
}

// Accounts "status" cell: a checkbox column gets true/false, a text column gets Active/Inactive.
function setActive_(acc, row, on) {
  const cell = acc.sheet.getRange(row, acc.statusCol + 1);
  const cur = cell.getValue();
  cell.setValue(typeof cur === 'boolean' ? on : (on ? 'Active' : 'Inactive'));
}

function accountsTab_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(ACCOUNTS_TAB);
  if (!sh) {
    sh = ss.insertSheet(ACCOUNTS_TAB);
    sh.getRange(1, 1, 1, 3).setValues([['Email', 'Name', 'Status']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const header = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 3)).getValues()[0].map(function (h) { return String(h).trim(); });
  const find = function (re, def) { const i = header.findIndex(function (h) { return re.test(h); }); return i >= 0 ? i : def; };
  return { sheet: sh, header: header, emailCol: find(/mail/i, 0), nameCol: find(/name/i, 1), statusCol: find(/status|active/i, 2) };
}

function findAccountRow_(acc, email) {
  const n = acc.sheet.getLastRow() - 1;
  if (n < 1) return 0;
  const vals = acc.sheet.getRange(2, acc.emailCol + 1, n, 1).getValues();
  for (let i = 0; i < n; i++) if (String(vals[i][0]).trim().toLowerCase() === email) return i + 2;
  return 0;
}

function removeMyTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncMine') ScriptApp.deleteTrigger(t); // only this person's own timers are visible here
  });
}

/* ---------- small helpers ---------- */

function myEmail_() { return String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); }

function addr_(from) { return parseAddress_(from).email; }

function parseAddress_(s) {
  s = String(s || '').trim();
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(s);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { name: '', email: s.toLowerCase() };
}

function cleanReply_(body) {
  const lines = String(body || '').replace(/\r/g, '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*>/.test(l)) break;
    if (/^On .+wrote:\s*$/i.test(l) || /^-{2,}\s*Original Message/i.test(l) || /^From:\s/.test(l)) break;
    out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1000);
}

function inSendWindow_(d) {
  const tz = Session.getScriptTimeZone();
  const day = Number(Utilities.formatDate(d, tz, 'u')) % 7; // 'u' = 1 (Mon) .. 7 (Sun)
  const hour = Number(Utilities.formatDate(d, tz, 'H'));
  return SEND_DAYS.indexOf(day) >= 0 && hour >= SEND_FROM_HOUR && hour < SEND_TO_HOUR;
}

function toMs_(v) {
  if (v instanceof Date) return v.getTime();
  if (v === '' || v == null) return 0;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
}
