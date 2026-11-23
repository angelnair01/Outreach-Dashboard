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

  /* ---- Company: guessed from the email, or set by you (saved in the sheet's Companies tab) ---- */
  function companyCell_(r) {
    var c = OG.companyOf(r);
    return (c.name ? '<strong>' + OG.esc(c.name) + '</strong>' + (c.guessed ? ' <span class="muted small">(from email address)</span>' : c.found ? ' <span class="muted small">(found in the emails)</span>' : '') : '<span class="muted">Not set</span>') +
      ' <button class="btn ghost small" id="pn-company-edit">' + (c.name ? 'Edit' : 'Add') + '</button>';
  }

  function bindCompany_(r) {
    var editBtn = document.getElementById('pn-company-edit');
    if (!editBtn) return;
    editBtn.onclick = function () {
      var cell = document.getElementById('pn-company');
      cell.innerHTML = '<div class="company-edit"><input class="input" id="pn-company-in" maxlength="120" placeholder="e.g. Lakeside School" value="' + OG.esc(OG.companyOf(r).name) + '">' +
        '<button class="btn primary small" id="pn-company-save">Save</button><button class="btn ghost small" id="pn-company-cancel">Cancel</button></div>' +
        '<div class="small muted">Used for every contact with this email address.</div>';
      var input = document.getElementById('pn-company-in');
      input.focus(); input.select();
      var save = function () {
        var name = input.value.trim();
        var btn = document.getElementById('pn-company-save'); btn.disabled = true; btn.textContent = 'Saving…';
        OG.api.setCompany(OG.state.token, r.email, name).then(function (res) {
          if (res && res.error) throw new Error(res.error);
          var map = Object.assign({}, OG.state.companies || {});
          if (name) map[String(r.email).toLowerCase()] = name; else delete map[String(r.email).toLowerCase()];
          OG.state.companies = map;
          OG.toast(name ? 'Company saved: ' + name : 'Company cleared.');
          OG.emit(); render();
        }).catch(function (e) { btn.disabled = false; btn.textContent = 'Save'; OG.toast('Could not save: ' + (e.message || e)); });
      };
      document.getElementById('pn-company-save').onclick = save;
      document.getElementById('pn-company-cancel').onclick = function () { render(); };
      input.onkeydown = function (e) { if (e.key === 'Enter') save(); if (e.key === 'Escape') { e.stopPropagation(); render(); } };
    };
  }

  /* ---- Manual follow-ups: "I followed up by Email / LinkedIn / WhatsApp" ---- */
  var pendingChannel = null; // channel whose small form is open

  function touchSection_(r) {
    var list = OG.touchesFor(r.id);
    var buttons = OG.TOUCH_CHANNELS.map(function (m) {
      return '<button class="btn ch-btn ' + m.cls + '" data-touch="' + m.key + '" aria-pressed="' + (pendingChannel === m.key) + '">' +
        OG.icon(m.icon) + (m.key === 'Email' ? 'Followed up by Email' : 'Followed up on ' + m.label) + '</button>';
    }).join('');
    var form = pendingChannel
      ? '<div class="touch-form"><div class="field"><label for="t-note">Note (optional) for ' + OG.esc(pendingChannel) + '</label>' +
          '<input class="input" id="t-note" maxlength="500" placeholder="' + (pendingChannel === 'LinkedIn' ? 'e.g. sent a connection request' : pendingChannel === 'WhatsApp' ? 'e.g. sent a quick reminder' : 'e.g. emailed from another address') + '"></div>' +
          '<div class="field"><label for="t-date">When</label><input class="input" id="t-date" type="date" value="' + OG.toInputDate(Date.now()) + '" max="' + OG.toInputDate(Date.now()) + '"></div>' +
          '<div class="btn-row"><button class="btn primary" id="t-save">Save</button><button class="btn" id="t-cancel">Cancel</button></div>' +
          '<div class="error" id="t-err" role="alert"></div></div>'
      : '';
    var history = list.length
      ? '<ul class="touch-list">' + list.map(function (t) {
          var m = OG.channelMeta(t.channel);
          return '<li><span class="ch-tag ' + m.cls + '">' + OG.icon(m.icon) + m.short + '</span>' +
            '<span class="touch-main"><span>' + OG.fmtDate(t.at) + ' <span class="muted small">(' + OG.fmtRel(t.at) + ')</span></span>' +
            (t.note ? '<span class="small muted">' + OG.esc(t.note) + '</span>' : '') + '</span>' +
            '<button class="btn ghost small" data-untouch="' + OG.esc(t.id) + '" title="Undo">' + OG.icon('undo') + '</button></li>';
        }).join('') + '</ul>'
      : '<p class="small muted">No manual follow-ups yet.</p>';
    return '<div><div class="section-title">Follow-ups you sent yourself</div>' +
      '<div class="btn-row ch-buttons">' + buttons + '</div>' + form + history +
      '<p class="small muted" style="margin-top:6px">Click after you followed up outside the automatic emails, so it shows here and in your counts. ' +
      'Automatic email follow-ups are not affected.</p></div>';
  }

  function bindTouches_(r) {
    var body = document.getElementById('panel-body');
    body.querySelectorAll('[data-touch]').forEach(function (b) {
      b.onclick = function () {
        var ch = b.getAttribute('data-touch');
        pendingChannel = pendingChannel === ch ? null : ch;
        render();
        var n = document.getElementById('t-note'); if (n) n.focus();
      };
    });
    var cancel = document.getElementById('t-cancel');
    if (cancel) cancel.onclick = function () { pendingChannel = null; render(); };
    var save = document.getElementById('t-save');
    if (save) save.onclick = function () {
      var d = document.getElementById('t-date').value;
      var at = d && d !== OG.toInputDate(Date.now()) ? new Date(d + 'T12:00:00').getTime() : Date.now();
      var touch = { cid: r.id, email: r.email, name: r.name, channel: pendingChannel, note: document.getElementById('t-note').value.trim(), at: at };
      save.disabled = true; save.textContent = 'Saving…';
      OG.api.addTouch(OG.state.token, touch).then(function (res) {
        if (res && res.error) throw new Error(res.error);
        OG.state.touches = [res.touch || touch].concat(OG.state.touches || []);
        OG.toast('Saved: followed up with ' + OG.displayName(r) + ' on ' + touch.channel + '.');
        pendingChannel = null; OG.emit(); render();
      }).catch(function (e) {
        save.disabled = false; save.textContent = 'Save';
        document.getElementById('t-err').textContent = 'Could not save: ' + (e.message || e);
      });
    };
    body.querySelectorAll('[data-untouch]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-untouch');
        b.disabled = true;
        OG.api.removeTouch(OG.state.token, id).then(function (res) {
          if (res && res.error) throw new Error(res.error);
          OG.state.touches = (OG.state.touches || []).filter(function (t) { return t.id !== id; });
          OG.toast('Removed.'); OG.emit(); render();
        }).catch(function (e) { b.disabled = false; OG.toast('Could not remove: ' + (e.message || e)); });
      };
    });
  }

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
        '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + OG.pill(r) + OG.channelTags(r) + '</div></div>' +
        '<button class="btn ghost" id="panel-close" aria-label="Close">' + OG.icon('close') + '</button></div>' +

      '<dl class="dl">' +
        '<dt>Company</dt><dd id="pn-company">' + companyCell_(r) + '</dd>' +
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

      touchSection_(r) +

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
    bindTouches_(r);
    bindCompany_(r);
    if (!OG.CW) return;
    var save = function () {
      OG.local.set(r.id, { phone: document.getElementById('p-phone').value.trim(), note: document.getElementById('p-note').value });
    };
    var phone = document.getElementById('p-phone');
    phone.addEventListener('input', save);
    phone.addEventListener('change', function () { save(); render(); document.getElementById('p-phone').focus(); });
    document.getElementById('p-note').addEventListener('input', save);
  }

  OG.openPanel = function (id, opts) {
    currentId = id; lastFocus = document.activeElement; pendingChannel = null;
    render();
    panel().classList.add('open'); panel().setAttribute('aria-hidden', 'false');
    document.getElementById('scrim').hidden = false;
    setTimeout(function () {
      // Opened from "+ Add company" on a card: go straight to the company box
      var edit = opts && opts.editCompany && document.getElementById('pn-company-edit');
      if (edit) { edit.click(); return; }
      var c = document.getElementById('panel-close'); if (c) c.focus();
    }, 50);
  };
  OG.closePanel = function () {
    currentId = null; OG._formOpen = false;
    panel().classList.remove('open'); panel().setAttribute('aria-hidden', 'true');
    document.getElementById('scrim').hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  OG.refreshPanel = function () {
    if (!currentId || pendingChannel) return; // don't wipe a half-filled follow-up form
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
