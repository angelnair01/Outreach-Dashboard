/* Shared helpers. Everything lives on window.OG so plain <script> tags work on any host. */
(function () {
  var OG = (window.OG = window.OG || {});
  var CFG = window.APP_CONFIG || {};
  var DAY = 86400000;
  OG.DAY = DAY;
  OG.FU_DAYS = CFG.FOLLOWUP_DAYS || 7;
  OG.MAX_FU = CFG.MAX_FOLLOWUPS || 2;
  OG.CW = CFG.ENABLE_CALL_WHATSAPP === true; // Call / WhatsApp features on?

  /* --- safe text --- */
  OG.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* --- localStorage that never throws --- */
  OG.store = {
    get: function (k, def) {
      try { var v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* --- dates --- */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  OG.fmtDate = function (ms) {
    if (!ms) return '—';
    var d = new Date(ms), now = new Date();
    var s = d.getDate() + ' ' + MONTHS[d.getMonth()];
    if (d.getFullYear() !== now.getFullYear()) s += ' ' + d.getFullYear();
    return s;
  };
  OG.fmtDateTime = function (ms) {
    if (!ms) return '—';
    var d = new Date(ms);
    return OG.fmtDate(ms) + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };
  OG.fmtRel = function (ms) {
    if (!ms) return '—';
    var diff = Date.now() - ms, future = diff < 0, a = Math.abs(diff);
    var m = Math.round(a / 60000), h = Math.round(a / 3600000), d = Math.round(a / DAY);
    var txt = m < 1 ? 'just now' : m < 60 ? m + ' min' : h < 24 ? h + ' h' : d === 1 ? '1 day' : d + ' days';
    if (txt === 'just now') return txt;
    return future ? 'in ' + txt : txt + ' ago';
  };
  OG.startOfWeek = function (ms) { // Monday 00:00
    var d = new Date(ms); d.setHours(0, 0, 0, 0);
    var day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day);
    return d.getTime();
  };
  OG.toInputDate = function (ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  /* --- stages --- */
  OG.STAGES = {
    waiting:  { label: 'Waiting for reply', short: 'Waiting', cls: 'st-waiting', color: 'var(--st-waiting)' },
    followup: { label: 'Following up', short: 'Following up', cls: 'st-followup', color: 'var(--st-followup)' },
    replied:  { label: 'Replied', short: 'Replied', cls: 'st-replied', color: 'var(--st-replied)' },
    call:     { label: 'Call planned', short: 'Call', cls: 'st-call', color: 'var(--st-planned)' },
    whatsapp: { label: 'WhatsApp planned', short: 'WhatsApp', cls: 'st-whatsapp', color: 'var(--st-planned)' },
    stopped:  { label: 'Stopped / no reply', short: 'Stopped', cls: 'st-stopped', color: 'var(--st-stopped)' }
  };
  OG.pill = function (r) {
    if (OG.isBounced(r)) return '<span class="pill st-bounced">Bounced</span>';
    var s = OG.STAGES[r.stage] || OG.STAGES.waiting;
    return '<span class="pill ' + s.cls + '">' + OG.esc(s.short) + '</span>';
  };
  OG.isReplied = function (r) { return /^replied$/i.test(r.status || ''); };
  OG.isBounced = function (r) { return /bounced/i.test(r.status || ''); };
  /* Same rule as the backend, without the manual mark (used for Undo). */
  OG.baseStage = function (r) {
    if (OG.isReplied(r)) return 'replied';
    if (/stopped|bounced/i.test(r.status || '')) return 'stopped';
    if ((r.fu || 0) > 0) return 'followup';
    return 'waiting';
  };
  OG.displayName = function (r) { return r.name || r.email || '(no name)'; };

  /* Next automatic follow-up: last mail + 7 days, only while still waiting and fewer than 2 sent. */
  OG.nextFollowUp = function (r) {
    if (r.stage !== 'waiting' && r.stage !== 'followup') return null;
    if ((r.fu || 0) >= OG.MAX_FU) return null;
    var base = r.last || r.first;
    if (!base) return null;
    var when = base + OG.FU_DAYS * DAY;
    return { when: when, n: (r.fu || 0) + 1, due: !!r.due || when <= Date.now() };
  };

  /* --- links --- */
  OG.gmailThread = function (id) { return 'https://mail.google.com/mail/u/0/#all/' + encodeURIComponent(id); };
  OG.gmailCompose = function (r) {
    return 'https://mail.google.com/mail/?view=cm&to=' + encodeURIComponent(r.email || '') +
      '&su=' + encodeURIComponent('Re: ' + (r.subject || ''));
  };
  OG.digits = function (s) { return String(s || '').replace(/\D/g, ''); };

  /* --- per-contact private info (this browser only) --- */
  OG.local = {
    get: function (id) { return OG.store.get('og.contact.' + id, { phone: '', note: '' }); },
    set: function (id, v) { OG.store.set('og.contact.' + id, v); }
  };

  /* --- toast --- */
  var toastTimer;
  OG.toast = function (msg) {
    var el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  };

  /* --- icons (inline SVG, stroke = currentColor) --- */
  var P = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    pipeline: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
    replies: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    followups: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    contacts: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    chat: '<path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.7-4.3L4 8M4 4v4h4M4 13a8 8 0 0 0 14.7 4.3L20 16M20 20v-4h-4"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'
  };
  OG.icon = function (name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  };

  /* --- CSV download --- */
  OG.downloadCSV = function (filename, header, rows) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var csv = [header].concat(rows).map(function (r) { return r.map(q).join(','); }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };
})();
