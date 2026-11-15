(function () {
  var OG = window.OG;
  var PAGE = 50;
  var f = { q: '', group: 'all', period: 'all', from: '', to: '', sort: 'first', dir: -1, page: 0 };
  var COLS = [
    { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'subject', label: 'Subject' },
    { key: 'first', label: 'First sent' }, { key: 'fu', label: 'Follow-ups' }, { key: 'stage', label: 'Stage' }
  ];
  // Quick filters: big lists (hundreds of "no reply") stay out of the way unless you ask for them.
  var GROUPS = [
    { key: 'all', label: 'All', test: function () { return true; } },
    { key: 'active', label: 'Active', test: function (r) { return r.stage === 'waiting' || r.stage === 'followup'; } },
    { key: 'replied', label: 'Replied', test: function (r) { return r.stage === 'replied' || r.stage === 'call' || r.stage === 'whatsapp'; } },
    { key: 'noreply', label: 'No reply', test: function (r) { return r.stage === 'stopped' && !OG.isBounced(r); } },
    { key: 'bounced', label: 'Bounced', test: function (r) { return OG.isBounced(r); } }
  ];
  var PERIODS = [{ key: 'all', label: 'Any time' }, { key: '30', label: 'Last 30 days' }, { key: '90', label: 'Last 90 days' }];

  function inGroup(key) { return (GROUPS.find(function (g) { return g.key === key; }) || GROUPS[0]).test; }

  function filtered(ignoreGroup) {
    var q = f.q.toLowerCase();
    var from = f.from ? new Date(f.from + 'T00:00:00').getTime() : f.period !== 'all' ? Date.now() - Number(f.period) * OG.DAY : -Infinity;
    var to = f.to ? new Date(f.to + 'T23:59:59').getTime() : Infinity;
    var g = inGroup(f.group);
    return OG.state.rows.filter(function (r) {
      if (!ignoreGroup && !g(r)) return false;
      if (q && (r.name + ' ' + r.email + ' ' + r.subject + ' ' + r.status).toLowerCase().indexOf(q) < 0) return false;
      if (r.first && (r.first < from || r.first > to)) return false;
      return true;
    }).sort(function (a, b) {
      var x = a[f.sort], y = b[f.sort];
      if (f.sort === 'name') { x = OG.displayName(a).toLowerCase(); y = OG.displayName(b).toLowerCase(); }
      if (typeof x === 'string') return x.localeCompare(y) * f.dir;
      return ((x || 0) - (y || 0)) * f.dir;
    });
  }

  function chips(list, cur, attr, counts) {
    return '<div class="seg" role="group">' + list.map(function (c) {
      return '<button data-' + attr + '="' + c.key + '" aria-pressed="' + (c.key === cur) + '">' + c.label + (counts ? ' (' + counts[c.key] + ')' : '') + '</button>';
    }).join('') + '</div>';
  }

  function body(el) {
    var rows = filtered();
    var pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (f.page >= pages) f.page = pages - 1;
    var start = f.page * PAGE, shown = rows.slice(start, start + PAGE);

    // counts per quick filter (respecting search + dates)
    var base = filtered(true), counts = {};
    GROUPS.forEach(function (g) { counts[g.key] = base.filter(g.test).length; });
    el.querySelector('#c-groups').innerHTML = chips(GROUPS, f.group, 'group', counts);

    el.querySelector('#c-count').textContent = rows.length + ' of ' + OG.state.rows.length + ' contacts';
    el.querySelector('tbody').innerHTML = shown.length ? shown.map(function (r) {
      return '<tr data-open="' + OG.esc(r.id) + '"><td><strong>' + OG.esc(r.name || '—') + '</strong></td><td>' + OG.esc(r.email) + '</td>' +
        '<td class="cell-clip">' + OG.esc(r.subject) + '</td><td class="nowrap">' + OG.fmtDate(r.first) + '</td>' +
        '<td class="num">' + (r.fu || 0) + '</td><td>' + OG.pill(r) + '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty">No contacts match these filters.</td></tr>';
    el.querySelector('#c-pager').innerHTML = rows.length > PAGE
      ? '<span class="small muted">Showing ' + (start + 1) + '–' + (start + shown.length) + ' of ' + rows.length + '</span>' +
        '<button class="btn" data-pg="-1"' + (f.page === 0 ? ' disabled' : '') + '>‹ Previous</button>' +
        '<button class="btn" data-pg="1"' + (f.page >= pages - 1 ? ' disabled' : '') + '>Next ›</button>'
      : '';
    el.querySelectorAll('th button').forEach(function (b) {
      var k = b.getAttribute('data-sort');
      b.setAttribute('aria-sort', k === f.sort ? (f.dir > 0 ? 'ascending' : 'descending') : 'none');
    });
  }

  OG.pages.contacts = {
    title: 'Contacts',
    render: function (el) {
      el.innerHTML = '<div class="page-head"><div><h1>Contacts</h1><p class="muted" id="c-count"></p></div>' +
        '<button class="btn" id="c-csv">' + OG.icon('download') + 'Download CSV</button></div>' +
        '<section class="card"><div class="toolbar"><div id="c-groups"></div>' + chips(PERIODS, f.period, 'period') + '</div>' +
        '<div class="toolbar">' +
          '<input class="input search" id="c-q" type="search" placeholder="Search name, email, subject…" value="' + OG.esc(f.q) + '" aria-label="Search">' +
          '<label class="small muted">From <input class="input" id="c-from" type="date" value="' + f.from + '"></label>' +
          '<label class="small muted">To <input class="input" id="c-to" type="date" value="' + f.to + '"></label>' +
          '<button class="btn ghost" id="c-clear">Clear</button>' +
        '</div><div class="table-wrap"><table><thead><tr>' +
          COLS.map(function (c) { return '<th><button data-sort="' + c.key + '">' + c.label + '</button></th>'; }).join('') +
        '</tr></thead><tbody></tbody></table></div><div class="pager" id="c-pager"></div></section>';

      body(el);
      var reset = function () { f.page = 0; body(el); };
      el.querySelector('#c-q').addEventListener('input', function (e) { f.q = e.target.value; reset(); });
      el.querySelector('#c-from').addEventListener('change', function (e) { f.from = e.target.value; reset(); });
      el.querySelector('#c-to').addEventListener('change', function (e) { f.to = e.target.value; reset(); });
      el.querySelector('#c-clear').addEventListener('click', function () {
        f.q = f.from = f.to = ''; f.group = 'all'; f.period = 'all'; f.page = 0; OG.pages.contacts.render(el);
      });
      if (!el._ogContactsBound) { // filter / page clicks: attach only once per page element
        el._ogContactsBound = true;
        el.addEventListener('click', function (e) {
          var g = e.target.closest('[data-group]'), p = e.target.closest('[data-period]'), pg = e.target.closest('[data-pg]');
          if (g) { f.group = g.getAttribute('data-group'); f.page = 0; body(el); }
          if (p) { f.period = p.getAttribute('data-period'); f.page = 0; OG.pages.contacts.render(el); }
          if (pg) { f.page += Number(pg.getAttribute('data-pg')); body(el); el.querySelector('table').scrollIntoView({ block: 'nearest' }); }
        });
      }
      el.querySelectorAll('th button').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-sort');
          if (f.sort === k) f.dir = -f.dir; else { f.sort = k; f.dir = (k === 'first' || k === 'fu') ? -1 : 1; }
          reset();
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
