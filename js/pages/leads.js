/* "Add & log" page: add a new contact to reach out to, or log outreach you already did.
   Saved in the "Leads" tab of the master sheet through the API. */
(function () {
  var OG = window.OG, S = OG.state;
  var CHANNELS = ['Email', 'LinkedIn', 'Call', 'WhatsApp', 'In person', 'Other'];

  function trackedEmails() {
    var set = {};
    S.rows.forEach(function (r) { if (r.email) set[r.email.toLowerCase()] = r; });
    return set;
  }

  /* ---------- the form (opens in the side panel) ---------- */
  OG.openLeadForm = function (kind) {
    kind = kind === 'done' ? 'done' : 'todo';
    var chOpts = CHANNELS.map(function (c) { return '<option>' + c + '</option>'; }).join('');
    var html =
      '<div class="panel-head"><div><h2 id="lf-title"></h2><div class="muted small" id="lf-sub"></div></div>' +
        '<button class="btn ghost" id="lf-close" aria-label="Close">' + OG.icon('close') + '</button></div>' +
      '<form id="lead-form" novalidate>' +
        '<div class="field"><span class="small muted">What are you adding?</span><div class="seg" role="group">' +
          '<button type="button" data-kind="todo">A new contact to reach out to</button>' +
          '<button type="button" data-kind="done">Outreach I already did</button></div></div>' +
        '<div class="field"><label for="lf-name">Name</label><input class="input" id="lf-name" maxlength="120" autocomplete="off"></div>' +
        '<div class="field"><label for="lf-email">Email <span class="muted" id="lf-email-hint"></span></label><input class="input" id="lf-email" type="email" maxlength="200" autocomplete="off"></div>' +
        '<div class="field"><label for="lf-org">Organisation</label><input class="input" id="lf-org" maxlength="160" autocomplete="off"></div>' +
        '<div class="field" data-only="todo"><label for="lf-subject">Email subject (optional, used when you write the email)</label><input class="input" id="lf-subject" maxlength="200" placeholder="e.g. Partnership with OpenGrad"></div>' +
        '<div class="field" data-only="done"><label for="lf-channel">How did you reach out?</label><select class="select" id="lf-channel">' + chOpts + '</select></div>' +
        '<div class="field" data-only="done"><label for="lf-date">When?</label><input class="input" id="lf-date" type="date" value="' + OG.toInputDate(Date.now()) + '" max="' + OG.toInputDate(Date.now()) + '"></div>' +
        '<div class="field"><label for="lf-notes">Notes</label><textarea class="input" id="lf-notes" maxlength="2000" placeholder="Anything useful to remember"></textarea></div>' +
        '<div class="local-note" id="lf-tip"></div>' +
        '<div class="error" id="lf-err" role="alert" style="margin-top:10px"></div>' +
        '<div class="btn-row" style="margin-top:12px"><button class="btn primary" type="submit" id="lf-save">Save</button>' +
        '<button class="btn" type="button" id="lf-cancel">Cancel</button></div>' +
      '</form>';

    OG.openFormPanel(html, function (el) {
      var $ = function (id) { return el.querySelector('#' + id); };
      function setKind(k) {
        kind = k;
        el.querySelectorAll('[data-kind]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-kind') === k)); });
        el.querySelectorAll('[data-only]').forEach(function (f) { f.hidden = f.getAttribute('data-only') !== k; });
        $('lf-title').textContent = k === 'done' ? 'Log outreach you did' : 'Add a new contact';
        $('lf-sub').textContent = k === 'done' ? 'Saved in the "Leads" tab of your sheet as Contacted.' : 'Saved in the "Leads" tab of your sheet as To contact.';
        $('lf-email-hint').textContent = k === 'done' ? '(optional)' : '(needed to write the email)';
        $('lf-tip').innerHTML = k === 'done'
          ? '💡 Emails you send from Gmail with the <strong>Outreach</strong> label are tracked automatically, so you don\'t need to log those here. Use this for LinkedIn, calls, meetings, or emails sent without the label.'
          : '💡 After saving, click <strong>Write email</strong>. Gmail opens a draft; press Send there and add the <strong>Outreach</strong> label. Your sheet script then tracks it and sends the follow-ups.';
      }
      el.querySelectorAll('[data-kind]').forEach(function (b) { b.onclick = function () { setKind(b.getAttribute('data-kind')); }; });
      $('lf-close').onclick = $('lf-cancel').onclick = OG.closePanel;
      setKind(kind);

      $('lead-form').onsubmit = function (e) {
        e.preventDefault();
        var lead = { kind: kind, name: $('lf-name').value.trim(), email: $('lf-email').value.trim(), org: $('lf-org').value.trim(),
          subject: kind === 'todo' ? $('lf-subject').value.trim() : '', notes: $('lf-notes').value.trim(),
          channel: kind === 'done' ? $('lf-channel').value : '', contactedOn: kind === 'done' ? $('lf-date').value : '' };
        var err = '';
        if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) err = 'That email address does not look right.';
        else if (kind === 'todo' && !lead.email) err = 'Please enter their email address.';
        else if (!lead.email && !lead.name) err = 'Please enter at least a name or an email.';
        else if (kind === 'done' && !lead.contactedOn) err = 'Please choose the date.';
        else if (kind === 'todo' && S.leads.some(function (l) { return l.status === 'To contact' && l.email && l.email.toLowerCase() === lead.email.toLowerCase(); }))
          err = lead.email + ' is already in your To contact list.';
        $('lf-err').textContent = err;
        if (err) return;
        if (kind === 'todo' && lead.email && trackedEmails()[lead.email.toLowerCase()] &&
            !confirm(lead.email + ' is already in your Follow-up Log (you emailed them before). Add anyway?')) return;

        $('lf-save').disabled = true; $('lf-save').textContent = 'Saving…';
        OG.api.addLead(S.token, lead).then(function (res) {
          if (res && res.error) throw new Error(res.error);
          if (res && res.lead) S.leads.unshift(res.lead);
          OG.closePanel();
          OG.toast(kind === 'done' ? 'Outreach logged.' : 'Added to your To contact list.');
          if (location.hash !== '#/leads') location.hash = '#/leads'; else OG.emit();
        }).catch(function (x) {
          $('lf-save').disabled = false; $('lf-save').textContent = 'Save';
          $('lf-err').textContent = 'Could not save: ' + (x.message || x);
        });
      };
    });
  };

  /* "Mark as contacted" mini-form */
  function openContactedForm(l) {
    var chOpts = CHANNELS.map(function (c) { return '<option>' + c + '</option>'; }).join('');
    OG.openFormPanel(
      '<div class="panel-head"><div><h2>Mark as contacted</h2><div class="muted small">' + OG.esc(l.name || l.email) + '</div></div>' +
        '<button class="btn ghost" id="mc-close" aria-label="Close">' + OG.icon('close') + '</button></div>' +
      '<form id="mc-form"><div class="field"><label for="mc-channel">How?</label><select class="select" id="mc-channel">' + chOpts + '</select></div>' +
      '<div class="field"><label for="mc-date">When?</label><input class="input" id="mc-date" type="date" value="' + OG.toInputDate(Date.now()) + '" max="' + OG.toInputDate(Date.now()) + '"></div>' +
      '<div class="error" id="mc-err" role="alert"></div>' +
      '<div class="btn-row" style="margin-top:12px"><button class="btn primary" type="submit" id="mc-save">Save</button><button class="btn" type="button" id="mc-cancel">Cancel</button></div></form>',
      function (el) {
        var $ = function (id) { return el.querySelector('#' + id); };
        $('mc-close').onclick = $('mc-cancel').onclick = OG.closePanel;
        $('mc-form').onsubmit = function (e) {
          e.preventDefault();
          var ch = $('mc-channel').value, d = $('mc-date').value || OG.toInputDate(Date.now());
          $('mc-save').disabled = true;
          OG.api.contactedLead(S.token, l.id, ch, d).then(function (res) {
            if (res && res.error) throw new Error(res.error);
            l.status = 'Contacted'; l.channel = ch; l.contactedOn = new Date(d + 'T12:00:00').getTime();
            OG.closePanel(); OG.toast('Marked as contacted.'); OG.emit();
          }).catch(function (x) { $('mc-save').disabled = false; $('mc-err').textContent = 'Could not save: ' + (x.message || x); });
        };
      });
  }

  function removeLead(l) {
    if (!confirm('Remove ' + (l.name || l.email) + ' from this list?\n\nThe row stays in your sheet (marked "Removed"), so nothing is lost.')) return;
    OG.api.removeLead(S.token, l.id).then(function (res) {
      if (res && res.error) throw new Error(res.error);
      S.leads = S.leads.filter(function (x) { return x.id !== l.id; });
      OG.toast('Removed from the list.'); OG.emit();
    }).catch(function (x) { OG.toast('Could not remove: ' + (x.message || x)); });
  }

  /* ---------- the page ---------- */
  OG.pages.leads = {
    title: 'Add & log',
    render: function (el) {
      var tracked = trackedEmails();
      var todo = S.leads.filter(function (l) { return l.status === 'To contact'; });
      var done = S.leads.filter(function (l) { return l.status === 'Contacted'; });

      var todoHtml = todo.length ? '<ul class="list">' + todo.map(function (l) {
        var t = l.email && tracked[l.email.toLowerCase()];
        return '<li class="lead-row"><div class="row-main">' +
            '<div class="row-title">' + OG.esc(l.name || l.email) + (l.org ? ' <span class="muted" style="font-weight:400">· ' + OG.esc(l.org) + '</span>' : '') + '</div>' +
            '<div class="row-sub">' + OG.esc(l.email || 'no email') + ' · added ' + OG.fmtRel(l.added) + '</div>' +
            (l.notes ? '<div class="row-sub">' + OG.esc(l.notes) + '</div>' : '') +
            (t ? '<div style="margin-top:4px"><span class="pill st-replied">Emailed: now tracked</span> <span class="small muted">You can mark this one as contacted.</span></div>' : '') +
          '</div><div class="btn-row">' +
            (l.email ? '<a class="btn primary" target="_blank" rel="noopener" href="https://mail.google.com/mail/?view=cm&to=' + encodeURIComponent(l.email) +
              (l.subject ? '&su=' + encodeURIComponent(l.subject) : '') + '">' + OG.icon('mail') + 'Write email</a>' : '') +
            '<button class="btn" data-lead-done="' + OG.esc(l.id) + '">Mark as contacted</button>' +
            '<button class="btn ghost" data-lead-remove="' + OG.esc(l.id) + '">Remove</button>' +
          '</div></li>';
      }).join('') + '</ul>' : '<div class="empty">Nobody waiting to be contacted. Click "Add a new contact" to add someone.</div>';

      var doneHtml = done.length ? '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Organisation</th><th>How</th><th>When</th><th>Notes</th><th></th></tr></thead><tbody>' +
        done.map(function (l) {
          return '<tr class="static"><td><strong>' + OG.esc(l.name || '—') + '</strong>' + (l.email ? '<div class="small muted">' + OG.esc(l.email) + '</div>' : '') + '</td>' +
            '<td>' + OG.esc(l.org || '—') + '</td><td><span class="pill st-planned-pill">' + OG.esc(l.channel || 'Other') + '</span></td>' +
            '<td class="nowrap">' + OG.fmtDate(l.contactedOn || l.added) + '</td><td class="cell-clip" title="' + OG.esc(l.notes) + '">' + OG.esc(l.notes || '') + '</td>' +
            '<td><button class="btn ghost" data-lead-remove="' + OG.esc(l.id) + '">Remove</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">Nothing logged yet.</div>';

      el.innerHTML = '<div class="page-head"><div><h1>Add & log</h1><p class="muted">Add new contacts or record outreach here, with no need to open the sheet.</p></div>' +
          '<div class="btn-row"><button class="btn primary" id="ld-add">+ Add a new contact</button><button class="btn" id="ld-log">+ Log outreach I did</button></div></div>' +
        '<section class="card" style="margin-bottom:16px"><h2>To contact (' + todo.length + ')</h2>' + todoHtml + '</section>' +
        '<section class="card"><h2>Outreach you logged (' + done.length + ')</h2>' +
          '<p class="small muted">Emails sent from Gmail with the Outreach label don\'t appear here. They\'re tracked automatically on the other pages.</p>' + doneHtml + '</section>';

      el.querySelector('#ld-add').onclick = function () { OG.openLeadForm('todo'); };
      el.querySelector('#ld-log').onclick = function () { OG.openLeadForm('done'); };
      var find = function (id) { return S.leads.find(function (x) { return x.id === id; }); };
      el.querySelectorAll('[data-lead-done]').forEach(function (b) { b.onclick = function () { var l = find(b.getAttribute('data-lead-done')); if (l) openContactedForm(l); }; });
      el.querySelectorAll('[data-lead-remove]').forEach(function (b) { b.onclick = function () { var l = find(b.getAttribute('data-lead-remove')); if (l) removeLead(l); }; });
    }
  };
})();
