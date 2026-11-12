/* Contact side panel: opens from any card or row that has data-open="THREAD_ID". */
(function () {
  var OG = window.OG;
  var currentId = null, lastFocus = null;
  var panel = function () { return document.getElementById('panel'); };

  OG.markButtons = function (r) {
    var e = OG.esc(r.id);
    var b = [];
    if (r.stage !== 'call') b.push('<button class="btn" data-mark="call" data-id="' + e + '">' + OG.icon('phone') + 'Plan a call</button>');
    if (r.stage !== 'whatsapp') b.push('<button class="btn" data-mark="whatsapp" data-id="' + e + '">' + OG.icon('chat') + 'Plan WhatsApp</button>');
    if (r.stage === 'call' || r.stage === 'whatsapp') b.push('<button class="btn ghost" data-mark="" data-id="' + e + '">' + OG.icon('undo') + 'Undo</button>');
    return b.join('');
  };

  function render() {
    var r = OG.byId(currentId);
    var body = document.getElementById('panel-body');
    if (!r) { body.innerHTML = '<p class="muted">This contact is no longer in the sheet.</p>'; return; }
    var nf = OG.nextFollowUp(r);
    var loc = OG.local.get(r.id);
    var digits = OG.digits(loc.phone);
    var nextTxt = nf ? (nf.due ? 'Due now' : OG.fmtDate(nf.when) + ' (' + OG.fmtRel(nf.when) + ')') + ' · follow-up ' + nf.n + ' of ' + OG.MAX_FU
      : (r.stage === 'stopped' ? 'None: sequence finished' : 'None: they replied');

    body.innerHTML =
      '<div class="panel-head"><div><h2>' + OG.esc(OG.displayName(r)) + '</h2>' +
        (r.name ? '<div class="muted small">' + OG.esc(r.email) + '</div>' : '') +
        '<div style="margin-top:8px">' + OG.pill(r) + '</div></div>' +
        '<button class="btn ghost" id="panel-close" aria-label="Close">' + OG.icon('close') + '</button></div>' +

      '<dl class="dl">' +
        '<dt>Subject</dt><dd>' + OG.esc(r.subject || '—') + '</dd>' +
        '<dt>First sent</dt><dd>' + OG.fmtDateTime(r.first) + '</dd>' +
        '<dt>Follow-ups sent</dt><dd>' + (r.fu || 0) + ' of ' + OG.MAX_FU + '</dd>' +
        '<dt>Sheet status</dt><dd>' + OG.esc(r.status || '—') + '</dd>' +
        '<dt>Last action</dt><dd>' + OG.fmtDateTime(r.last) + '</dd>' +
        '<dt>Next follow-up</dt><dd>' + nextTxt + '</dd>' +
      '</dl>' +

      (r.snippet ? '<div><div class="section-title">Their reply</div><div class="quote">' + OG.esc(r.snippet) + '</div></div>' : '') +

      '<div><div class="section-title">Email</div><div class="btn-row">' +
        '<a class="btn" href="' + OG.gmailThread(r.id) + '" target="_blank" rel="noopener">' + OG.icon('external') + 'Open thread in Gmail</a>' +
        '<a class="btn primary" href="' + OG.gmailCompose(r) + '" target="_blank" rel="noopener">' + OG.icon('mail') + 'Write an email</a>' +
      '</div><p class="small muted" style="margin-top:6px">"Write an email" opens a draft in Gmail. Nothing is sent until you press Send there.</p></div>' +

      (OG.CW ? '<div><div class="section-title">Call or WhatsApp</div>' +
        '<div class="btn-row" style="margin-bottom:10px">' +
          '<a class="btn" ' + (digits ? 'href="tel:' + OG.esc(loc.phone.replace(/[^\d+]/g, '')) + '"' : 'aria-disabled="true"') + '>' + OG.icon('phone') + 'Call</a>' +
          '<a class="btn" ' + (digits ? 'href="https://wa.me/' + digits + '" target="_blank" rel="noopener"' : 'aria-disabled="true"') + '>' + OG.icon('chat') + 'WhatsApp</a>' +
        '</div>' +
        (digits ? '' : '<p class="small muted">Add a phone number below to turn on Call and WhatsApp.</p>') +
        '<div class="field"><label for="p-phone">Phone number (with country code, e.g. +91 98765 43210)</label>' +
          '<input class="input" id="p-phone" type="tel" autocomplete="off" value="' + OG.esc(loc.phone) + '"></div>' +
        '<div class="field"><label for="p-note">Private note</label>' +
          '<textarea class="input" id="p-note" placeholder="e.g. Prefers calls after 4pm">' + OG.esc(loc.note) + '</textarea></div>' +
        '<div class="local-note">🔒 The number and note are saved <strong>only in this browser</strong>. They are not in your Google Sheet and other people (or your other devices) will not see them.</div>' +
      '</div>' +

      '<div><div class="section-title">Next step</div><div class="btn-row">' + OG.markButtons(r) + '</div></div>' : '');

    document.getElementById('panel-close').onclick = OG.closePanel;
    if (!OG.CW) return;
    var save = function () {
      OG.local.set(r.id, { phone: document.getElementById('p-phone').value.trim(), note: document.getElementById('p-note').value });
    };
    var phone = document.getElementById('p-phone');
    phone.addEventListener('input', save);
    phone.addEventListener('change', function () { save(); render(); document.getElementById('p-phone').focus(); });
    document.getElementById('p-note').addEventListener('input', save);
  }

  OG.openPanel = function (id) {
    currentId = id; lastFocus = document.activeElement;
    render();
    panel().classList.add('open'); panel().setAttribute('aria-hidden', 'false');
    document.getElementById('scrim').hidden = false;
    setTimeout(function () { var c = document.getElementById('panel-close'); if (c) c.focus(); }, 50);
  };
  OG.closePanel = function () {
    currentId = null; OG._formOpen = false;
    panel().classList.remove('open'); panel().setAttribute('aria-hidden', 'true');
    document.getElementById('scrim').hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  OG.refreshPanel = function () {
    if (!currentId) return;
    if (panel().contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; // don't interrupt typing
    render();
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && (currentId || OG._formOpen)) OG.closePanel(); });
})();

/* The same side panel, used for forms (e.g. "Add a contact"). */
(function () {
  var OG = window.OG;
  OG.openFormPanel = function (html, bind) {
    OG.closePanel();
    var body = document.getElementById('panel-body');
    body.innerHTML = html;
    var p = document.getElementById('panel');
    p.classList.add('open'); p.setAttribute('aria-hidden', 'false');
    document.getElementById('scrim').hidden = false;
    OG._formOpen = true;
    if (bind) bind(body);
    setTimeout(function () { var f = body.querySelector('input:not([type=radio]),select,textarea'); if (f) f.focus(); }, 60);
  };
})();
