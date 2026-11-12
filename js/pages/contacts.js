(function () {
  var OG = window.OG;
  var f = { q: '', stage: '', from: '', to: '', sort: 'first', dir: -1 };
  var COLS = [
    { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'subject', label: 'Subject' },
    { key: 'first', label: 'First sent' }, { key: 'fu', label: 'Follow-ups' }, { key: 'stage', label: 'Stage' }
  ];

  function filtered() {
    var q = f.q.toLowerCase();
    var from = f.from ? new Date(f.from + 'T00:00:00').getTime() : -Infinity;
    var to = f.to ? new Date(f.to + 'T23:59:59').getTime() : Infinity;
    return OG.state.rows.filter(function (r) {
      if (q && (r.name + ' ' + r.email + ' ' + r.subject + ' ' + r.status).toLowerCase().indexOf(q) < 0) return false;
      if (f.stage === 'bounced') { if (!OG.isBounced(r)) return false; }
      else if (f.stage === 'planned') { if (r.stage !== 'call' && r.stage !== 'whatsapp') return false; }
      else if (f.stage && r.stage !== f.stage) return false;
      if (r.first && (r.first < from || r.first > to)) return false;
      return true;
    }).sort(function (a, b) {
      var x = a[f.sort], y = b[f.sort];
      if (f.sort === 'name') { x = OG.displayName(a).toLowerCase(); y = OG.displayName(b).toLowerCase(); }
      if (typeof x === 'string') return x.localeCompare(y) * f.dir;
      return ((x || 0) - (y || 0)) * f.dir;
    });
  }

  function body(el) {
    var rows = filtered();
    el.querySelector('#c-count').textContent = rows.length + ' of ' + OG.state.rows.length + ' contacts';
    el.querySelector('tbody').innerHTML = rows.length ? rows.map(function (r) {
      return '<tr data-open="' + OG.esc(r.id) + '"><td><strong>' + OG.esc(r.name || '—') + '</strong></td><td>' + OG.esc(r.email) + '</td>' +
        '<td class="cell-clip">' + OG.esc(r.subject) + '</td><td class="nowrap">' + OG.fmtDate(r.first) + '</td>' +
        '<td class="num">' + (r.fu || 0) + '</td><td>' + OG.pill(r) + '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty">No contacts match these filters.</td></tr>';
    el.querySelectorAll('th button').forEach(function (b) {
      var k = b.getAttribute('data-sort');
      b.setAttribute('aria-sort', k === f.sort ? (f.dir > 0 ? 'ascending' : 'descending') : 'none');
    });
  }

  OG.pages.contacts = {
    title: 'Contacts',
    render: function (el) {
      var opt = function (v, l) { return '<option value="' + v + '"' + (f.stage === v ? ' selected' : '') + '>' + l + '</option>'; };
      el.innerHTML = '<div class="page-head"><div><h1>Contacts</h1><p class="muted" id="c-count"></p></div>' +
        '<button class="btn" id="c-csv">' + OG.icon('download') + 'Download CSV</button></div>' +
        '<section class="card"><div class="toolbar">' +
          '<input class="input search" id="c-q" type="search" placeholder="Search name, email, subject…" value="' + OG.esc(f.q) + '" aria-label="Search">' +
          '<select class="select" id="c-stage" aria-label="Stage">' + opt('', 'All stages') + opt('waiting', 'Waiting for reply') + opt('followup', 'Following up') +
            opt('replied', 'Replied') + (OG.CW ? opt('planned', 'Call / WhatsApp') : '') + opt('stopped', 'Stopped / no reply') + opt('bounced', 'Bounced only') + '</select>' +
          '<label class="small muted">From <input class="input" id="c-from" type="date" value="' + f.from + '"></label>' +
          '<label class="small muted">To <input class="input" id="c-to" type="date" value="' + f.to + '"></label>' +
          '<button class="btn ghost" id="c-clear">Clear</button>' +
        '</div><div class="table-wrap"><table><thead><tr>' +
          COLS.map(function (c) { return '<th><button data-sort="' + c.key + '">' + c.label + '</button></th>'; }).join('') +
        '</tr></thead><tbody></tbody></table></div></section>';

      body(el);
      el.querySelector('#c-q').addEventListener('input', function (e) { f.q = e.target.value; body(el); });
      el.querySelector('#c-stage').addEventListener('change', function (e) { f.stage = e.target.value; body(el); });
      el.querySelector('#c-from').addEventListener('change', function (e) { f.from = e.target.value; body(el); });
      el.querySelector('#c-to').addEventListener('change', function (e) { f.to = e.target.value; body(el); });
      el.querySelector('#c-clear').addEventListener('click', function () { f.q = f.stage = f.from = f.to = ''; OG.pages.contacts.render(el); });
      el.querySelectorAll('th button').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-sort');
          if (f.sort === k) f.dir = -f.dir; else { f.sort = k; f.dir = (k === 'first' || k === 'fu') ? -1 : 1; }
          body(el);
        });
      });
      el.querySelector('#c-csv').addEventListener('click', function () {
        var rows = filtered().map(function (r) {
          return [r.name, r.email, r.subject, r.first ? OG.toInputDate(r.first) : '', r.fu || 0, (OG.STAGES[r.stage] || {}).label || r.stage, r.status, r.last ? OG.toInputDate(r.last) : '', r.snippet];
        });
        OG.downloadCSV('outreach-contacts-' + OG.toInputDate(Date.now()) + '.csv',
          ['Name', 'Email', 'Subject', 'First sent', 'Follow-ups sent', 'Stage', 'Sheet status', 'Last action', 'Reply'], rows);
      });
    },
    /* Keep typing focus when data refreshes in the background. */
    update: function (el) { if (el.querySelector('tbody')) body(el); else this.render(el); }
  };
})();
