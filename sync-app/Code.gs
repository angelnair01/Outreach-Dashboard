/**
 * Outreach Sync - connects each person's Gmail to the dashboard.
 *
 * Deployed as a web app that runs AS THE PERSON USING IT. Each person, once:
 *   dashboard > "Connect my Gmail" > this page > Connect > Allow.
 * Then, every minute (and whenever they press "Sync" on the dashboard), for THAT person's Gmail:
 *   - threads labelled Outreach / Outreach-Replied / Outreach-Done are read
 *   - replies and bounces are detected, follow-ups 1 and 2 are sent after WAIT_DAYS (unless DRY_RUN)
 *   - the results are sent to the Outreach API, which writes them to the master sheet with "Sent by"
 * Nobody needs access to the sheet. Moving to another master sheet = change SHEET_IDS in the API only.
 * Settings are in the "Settings" file.
 */

const DAY = 86400000;
const QUICK_THREADS = 50;      // most recently active threads, checked every minute and on "Sync"
const MAX_IMPORT_THREADS = 3000; // upper limit for the full / import checks
const FULL_EVERY_MIN = 30;     // how often all ACTIVE threads are re-checked
const MAX_SENDS_PER_RUN = 10;
const COL = { id: 0, name: 1, email: 2, subject: 3, first: 4, fu: 5, status: 6, last: 7, snippet: 8, sentBy: 9 };

/* ---------- the page people see ---------- */

function doGet(e) {
  const action = (e && e.parameter && e.parameter.a) || 'connect';
  const t = HtmlService.createTemplate(PAGE_HTML);
  t.action = action;
  t.me = myEmail_();
  return t.evaluate().setTitle('Outreach Sync').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Called from the page.
function pageStatus() {
  const res = api_('syncPull', { ids: [] });   // just the account status, no rows
  return { me: myEmail_(), account: res.account || {}, timer: hasTimer_(), dryRun: DRY_RUN };
}

function connect(name) {
  api_('syncConnect', { name: String(name || '').slice(0, 80) });
  removeTimers_();
  ScriptApp.newTrigger('syncTimer').timeBased().everyMinutes(1).create();
  PropertiesService.getUserProperties().deleteProperty('lastFull');
  const r = syncMine_(true, true);
  return { summary: r.summary };
}

function disconnect() {
  removeTimers_();
  api_('syncDisconnect');
  return { ok: true };
}

function syncNow() {
  return syncMine_(true, false);
}

// The every-minute timer.
function syncTimer() {
  try {
    syncMine_(false, false);
  } catch (e) {
    // Tell the dashboard what went wrong (shown to this person only), then let Google log it too.
    try { api_('syncPush', { rows: [], error: String(e && e.message || e) }); } catch (x) {}
    throw e;
  }
}

/* ---------- the sync ---------- */

function syncMine_(manual, forceFull) {
  const lock = LockService.getUserLock();          // never two syncs at once for the same person
  if (!lock.tryLock(manual ? 25000 : 1000)) return { summary: 'A sync was already running. Try again in a few seconds.' };
  try {
    const me = myEmail_();
    const props = PropertiesService.getUserProperties();
    const now = Date.now(), started = Date.now();
    const allLabels = '{label:"' + OUTREACH_LABEL + '" label:"' + REPLIED_LABEL + '" label:"' + DONE_LABEL + '"}';

    // Which conversations to look at:
    //  - import : everything (first connect, continued in chunks until done)
    //  - full   : every 30 min, only ACTIVE ones (label Outreach = still waiting for a reply)
    //  - quick  : every minute / Sync button, the 50 most recently active (any label, so late replies are caught)
    let mode = 'quick';
    if (forceFull || props.getProperty('importPending')) mode = 'import';
    else if (!manual && now - Number(props.getProperty('lastFull') || 0) > FULL_EVERY_MIN * 60000) mode = 'full';
    const threads = mode === 'import' ? searchAll_(allLabels, MAX_IMPORT_THREADS)
      : mode === 'full' ? searchAll_('label:"' + OUTREACH_LABEL + '"', MAX_IMPORT_THREADS)
      : GmailApp.search(allLabels, 0, QUICK_THREADS);
    if (mode !== 'quick') props.setProperty('lastFull', String(now));

    // Only the sheet rows for these conversations (keeps every run small, however big the sheet gets).
    const pulled = api_('syncPull', { ids: threads.map(function (t) { return t.getId(); }) });
    const account = pulled.account || {};
    if (!account.connected) return { summary: 'This Gmail is not connected.' };
    const senderName = account.name || me.split('@')[0];
    const maxAnalyse = manual ? 60 : 250;   // conversations read in full per run; the rest continue next minute
    let analysed = 0, unfinished = false;

    const existing = {};
    (pulled.rows || []).forEach(function (r) { if (r && r[0]) existing[String(r[0])] = r; });
    const myAddrs = [me].concat(GmailApp.getAliases().map(function (a) { return a.toLowerCase(); }));
    const labels = {};
    const label = function (n) { return labels[n] || (labels[n] = GmailApp.getUserLabelByName(n) || GmailApp.createLabel(n)); };
    const out = [];
    let sends = 0;

    threads.forEach(function (thread) {
      const id = thread.getId();
      const prev = existing[id] || null;
      const lastMsgMs = thread.getLastMessageDate().getTime();

      // Unchanged and nothing due: no extra Gmail reads. Claim old rows that had no sender.
      if (prev && Math.abs(toMs_(prev[COL.last]) - lastMsgMs) < 1000 && !needsTimeCheck_(prev, now)) {
        if (!String(prev[COL.sentBy] || '').trim()) out.push(prev.slice(0, 9));
        return;
      }

      // Big mailbox: stop reading after a chunk (or 4 minutes) and continue on the next run.
      if (analysed >= maxAnalyse || Date.now() - started > 240000) { unfinished = true; return; }
      analysed++;
      const a = analyze_(thread, myAddrs);
      if (!a) return;

      let status, fu = a.fu, last = a.lastMs;
      if (a.bounced) {
        status = 'Bounced'; moveLabel_(thread, DONE_LABEL, label);
      } else if (a.replied) {
        status = 'Replied'; moveLabel_(thread, REPLIED_LABEL, label);
      } else if (fu >= MAX_FOLLOWUPS) {
        if (now - a.lastMineMs >= WAIT_DAYS * DAY) { status = 'Stopped (no reply)'; moveLabel_(thread, DONE_LABEL, label); }
        else status = 'Waiting (follow-up ' + fu + ' sent)';
      } else if (now - a.lastMineMs < WAIT_DAYS * DAY) {
        status = fu ? 'Waiting (follow-up ' + fu + ' sent)' : 'Waiting (first mail sent)';
      } else if (!prev && now - a.firstMs > MAX_AGE_DAYS_FOR_NEW * DAY) {
        status = 'Stopped (older than ' + MAX_AGE_DAYS_FOR_NEW + ' days, not followed up)';
      } else if (prev && /older than/i.test(String(prev[COL.status]))) {
        status = String(prev[COL.status]);
      } else {
        const n = fu + 1;
        if (DRY_RUN) status = 'TEST: would send follow-up ' + n;
        else if (!inSendWindow_(new Date(now)) || sends >= MAX_SENDS_PER_RUN || sentToday_() >= MAX_PER_DAY) {
          status = 'Follow-up ' + n + ' due (waiting for send window)';
        } else {
          sendFollowUp_(thread, a, n, senderName);
          sentToday_(1); sends++; fu = n; last = Date.now();
          status = 'Follow-up ' + n + ' sent';
        }
      }

      const vals = [id, a.name, a.email, a.subject, a.firstMs, fu, status, last, a.snippet];
      const same = prev && vals.every(function (v, i) {
        return i === COL.first || i === COL.last ? Math.abs(toMs_(prev[i]) - toMs_(v)) < 1000 : String(prev[i]) === String(v);
      }) && String(prev[COL.sentBy] || '').trim();
      if (!same) out.push(vals);
    });

    // Send in chunks of 300 rows, so a big first import never makes one huge request.
    for (let i = 0; i < out.length; i += 300) api_('syncPush', { rows: out.slice(i, i + 300) });
    if (!out.length) api_('syncPush', { rows: [] });   // also tells the dashboard "Gmail checked just now"
    if (mode === 'import' || unfinished) {
      if (unfinished) props.setProperty('importPending', '1'); else props.deleteProperty('importPending');
    }
    return {
      summary: threads.length + ' conversations checked, ' + out.length + ' updated, ' + sends + ' follow-ups sent' +
        (unfinished ? ' (big mailbox: the rest continues automatically over the next minutes)' : '') + (DRY_RUN ? ' (test mode)' : ''),
      updated: out.length
    };
  } finally {
    lock.releaseLock();
  }
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
    } else if (/out of office|automatic reply|auto-reply|autoreply/i.test(m.getSubject())) {
      continue; // auto-replies are not real replies
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
    snippet: replyMsg ? cleanReply_(replyMsg.getPlainBody()) : ''
  };
}

// Same way of sending as the original script: a reply inside the same Gmail thread.
function sendFollowUp_(thread, a, n, senderName) {
  const tpl = FOLLOWUP_TEXT[Math.min(n, FOLLOWUP_TEXT.length) - 1];
  const firstName = (a.name || '').split(/\s+/)[0] || 'there';
  thread.reply(tpl.replace(/\{\{name\}\}/g, firstName).replace(/\{\{sender\}\}/g, senderName));
  Utilities.sleep(1500);
}

function moveLabel_(thread, toName, label) {
  thread.addLabel(label(toName));
  try { thread.removeLabel(label(OUTREACH_LABEL)); } catch (e) {}
}

function needsTimeCheck_(vals, now) {
  const s = String(vals[COL.status] || '');
  if (/replied|bounced|stopped/i.test(s)) return false;
  if (/TEST: would send|due \(waiting/i.test(s)) return !DRY_RUN && inSendWindow_(new Date(now));
  return now - toMs_(vals[COL.last]) >= WAIT_DAYS * DAY;
}

function sentToday_(add) {
  const p = PropertiesService.getUserProperties();
  const key = 'sent_' + Utilities.formatDate(new Date(Date.now()), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const n = Number(p.getProperty(key)) || 0;
  if (add) p.setProperty(key, String(n + add));
  return n + (add || 0);
}

/* ---------- talking to the Outreach API ---------- */

function api_(action, extra) {
  const res = UrlFetchApp.fetch(API_URL, {
    method: 'post', contentType: 'text/plain', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify(Object.assign({ action: action, accessToken: ScriptApp.getOAuthToken() }, extra || {}))
  });
  let data;
  try { data = JSON.parse(res.getContentText()); } catch (e) { throw new Error('The Outreach API did not answer properly (check API_URL in Settings).'); }
  if (data && data.error) throw new Error('Outreach API: ' + data.error);
  return data;
}

/* ---------- small helpers ---------- */

// Gmail returns at most 500 conversations per search, so page through.
function searchAll_(query, max) {
  const out = [];
  for (let start = 0; start < max; start += 500) {
    const batch = GmailApp.search(query, start, Math.min(500, max - start));
    Array.prototype.push.apply(out, batch);
    if (batch.length < 500) break;
  }
  return out;
}

function hasTimer_() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'syncTimer'; });
}

function removeTimers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'syncTimer') ScriptApp.deleteTrigger(t); });
}

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
  const hour = Number(Utilities.formatDate(d, Session.getScriptTimeZone(), 'H'));
  return hour >= SEND_FROM_HOUR && hour < SEND_TO_HOUR;
}

function toMs_(v) {
  if (v instanceof Date) return v.getTime();
  if (v === '' || v == null) return 0;
  if (typeof v === 'number') return v;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
}

/* ---------- page (HTML) ---------- */

const PAGE_HTML = `<!doctype html>
<html><head><base target="_top"><style>
  body{font-family:Inter,system-ui,"Segoe UI",Roboto,sans-serif;background:#f5f5f3;color:#121211;margin:0;padding:24px 16px}
  .card{max-width:440px;margin:0 auto;background:#fff;border:1px solid #e3e2de;border-radius:12px;padding:24px}
  h1{font-size:19px;margin:0 0 6px} p{color:#52514e;font-size:14px;line-height:1.5}
  input{width:100%;box-sizing:border-box;border:1px solid #e3e2de;border-radius:8px;padding:9px 11px;font:inherit;margin:6px 0 14px}
  button{border:0;border-radius:8px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer;background:#2a78d6;color:#fff}
  button.ghost{background:#f0efec;color:#121211;margin-left:6px} button[disabled]{opacity:.5}
  .ok{color:#1d8a4e;font-weight:600} .err{color:#c62f2e} .small{font-size:12px;color:#7a7974}
</style></head><body><div class="card" id="c"><h1>Outreach Sync</h1><p>Loading…</p></div>
<script>
  var ACTION = <?!= JSON.stringify(action) ?>, ME = <?!= JSON.stringify(me) ?>;
  var c = document.getElementById('c');
  function tell(msg){ try { if (window.top.opener) window.top.opener.postMessage(Object.assign({ source: 'outreach-sync' }, msg), '*'); } catch (e) {} }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(x){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]; }); }
  function fail(e){ c.innerHTML = '<h1>Something went wrong</h1><p class="err">' + esc(e && e.message || e) + '</p>'; tell({ type: 'error', message: String(e && e.message || e) }); }
  function run(fn, arg){ return new Promise(function(ok, no){ google.script.run.withSuccessHandler(ok).withFailureHandler(no)[fn](arg); }); }

  if (ACTION === 'sync') {
    c.innerHTML = '<h1>Checking your Gmail…</h1><p>' + esc(ME) + '</p><p class="small">This window closes by itself.</p>';
    run('syncNow').then(function(r){
      c.innerHTML = '<h1 class="ok">Done</h1><p>' + esc(r.summary) + '</p><p class="small">You can close this window.</p>';
      tell({ type: 'synced', summary: r.summary });
    }, fail);
  } else {
    run('pageStatus').then(function(s){
      if (s.account.connected && s.timer) {
        c.innerHTML = '<h1 class="ok">Connected ✓</h1><p>' + esc(s.me) + ' is checked every minute.' + (s.dryRun ? ' (Test mode: follow-ups are not sent yet.)' : '') + '</p>' +
          '<button id="sync">Sync now</button><button class="ghost" id="dis">Disconnect</button><p class="small" id="msg"></p>';
        tell({ type: 'connected' });
        document.getElementById('sync').onclick = function(){ this.disabled = true; document.getElementById('msg').textContent = 'Checking…';
          run('syncNow').then(function(r){ document.getElementById('msg').textContent = r.summary; tell({ type: 'synced', summary: r.summary }); document.getElementById('sync').disabled = false; }, fail); };
        document.getElementById('dis').onclick = function(){ if (!confirm('Stop checking this Gmail?')) return;
          run('disconnect').then(function(){ c.innerHTML = '<h1>Disconnected</h1><p>' + esc(s.me) + ' is no longer checked. Your rows stay in the sheet.</p>'; tell({ type: 'disconnected' }); }, fail); };
      } else {
        var again = s.account.connected && !s.timer; // connected before, but the every-minute check is missing
        c.innerHTML = (again
            ? '<h1>Turn auto-sync back on</h1><p><strong>' + esc(s.me) + '</strong> is connected, but its every-minute Gmail check is not running. Click below to switch it back on.</p>'
            : '<h1>Connect your Gmail</h1><p>Signed in as <strong>' + esc(s.me) + '</strong>. Your mails labelled <strong>Outreach</strong> will be checked every minute and shown on the dashboard, only to you.</p>') +
          '<label class="small" for="nm">Your name (used to sign follow-up emails)</label><input id="nm" value="' + esc(s.account.name || '') + '" placeholder="e.g. Angel Nair">' +
          '<button id="go">' + (again ? 'Turn auto-sync on' : 'Connect') + '</button><p class="small" id="msg"></p>';
        document.getElementById('go').onclick = function(){
          var nm = document.getElementById('nm').value.trim(); if (!nm) { document.getElementById('msg').textContent = 'Please type your name.'; return; }
          this.disabled = true; document.getElementById('msg').textContent = 'Connecting and checking your Gmail… (first time can take up to a minute)';
          run('connect', nm).then(function(r){
            c.innerHTML = '<h1 class="ok">Connected ✓</h1><p>' + esc(s.me) + ' is now checked every minute.</p><p>' + esc(r.summary) + '</p><p class="small">You can close this window and go back to the dashboard.</p>';
            tell({ type: 'connected', summary: r.summary });
          }, fail);
        };
      }
    }, fail);
  }
</script></body></html>`;
