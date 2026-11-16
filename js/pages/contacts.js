/* Contacts: status tabs with counts, then search + period + channel. Simple table, 50 per page. */
(function () {
  var OG = window.OG;
  var PAGE = 50;
  var f = { q: '', tab: 'all', period: 'all', channel: 'any', from: '', to: '', sort: 'first', dir: -1, page: 0 };

  var TABS = [
    { key: 'all', label: 'All', test: function () { return true; } },
    { key: 'waiting', label: 'Waiting', test: function (r) { return r.stage === 'waiting' || r.stage === 'followup'; } },
    { key: 'replied', label: 'Replied', test: function (r) { return r.stage === 'replied' || r.stage === 'call' || r.stage === 'whatsapp'; } },
    { key: 'noreply', label: 'No reply', test: function (r) { return r.stage === 'stopped' && !OG.isBounced(r); } },
    { key: 'bounced', label: 'Bounced', test: function (r) { return OG.isBounced(r); } }
  ];
  var PERIODS = [
    { key: 'all', label: 'Any time' }, { key: '30', label: 'Last 30 days' }, { key: '60', label: 'Last 60 days' },
    { key: '90', label: 'Last 90 days' }, { key: 'custom', label: 'Custom range…' }
  ];
  var CHANNELS = [
    { key: 'any', label: 'All channels' }, { key: 'LinkedIn', label: 'Followed up on LinkedIn' },
    { key: 'WhatsApp', label: 'Followed up on WhatsApp' }, { key: 'Email', label: 'Followed up by email (manual)' }
  ];
  var SORTS = [{ key: 'name', label: 'Contact' }, { key: 'subject', label: 'Subject' }, { key: 'status', label: 'Status' }, { key: 'channels', label: 'Channels' }, { key: 'first', label: 'Sent' }];

  /* Plain-language status: what's going on with this contact. */
  function statusOf(r) {
    if (OG.isBounced(r)) return { text: 'Bounced', cls: 'st-bounced', order: 5 };
    if (r.stage === 'replied' || r.stage === 'call' || r.stage === 'whatsapp') return { text: 'Replied', cls: 'st-replied', order: 1 };
    if (r.stage === 'stopped') return { text: 'No reply', cls: 'st-stopped', order: 4 };
    if (r.due) return { text: 'Follow-up ' + ((r.fu || 0) + 1) + ' due', cls: 'st-due', order: 2 };
    if ((r.fu || 0) > 0) return { text: 'Follow-up ' + r.fu + ' of ' + OG.MAX_FU + ' sent', cls: 'st-followup', order: 3 };
    return { text: 'Waiting', cls: 'st-waiting', order: 3 };
  }

  function channelIcons(r) {
    var c = OG.channelCounts(r);
    return '<span class="ch-icons">' + OG.TOUCH_CHANNELS.filter(function (m) { return m.key === 'Email' || c[m.key]; }).map(function (m) {
      var tip = m.key === 'Email' ? 'Email' + (c.Email ? ' + ' + c.Email + ' manual follow-up' + (c.Email > 1 ? 's' : '') : '')
        : m.label + ': ' + c[m.key] + ' follow-up' + (c[m.key] > 1 ? 's' : '');
      return '<span class="ch-ic ' + m.cls + '" title="' + tip + '" aria-label="' + tip + '">' + OG.icon(m.icon) + '</span>';
    }).join('') + '</span>';
  }

  function range() {
    if (f.period === 'custom') {
      return { from: f.from ? new Date(f.from + 'T00:00:00').getTime() : -Infinity, to: f.to ? new Date(f.to + 'T23:59:59').getTime() : Infinity };
    }
    return { from: f.period === 'all' ? -Infinity : Date.now() - Number(f.period) * OG.DAY, to: Infinity };
  }

  // Everything except the tab (so tab counts reflect search + period + channel).
  function base() {
    var q = f.q.toLowerCase(), rg = range();
    return OG.state.rows.filter(function (r) {
      if (q && (r.name + ' ' + r.email + ' ' + r.subject + ' ' + r.status).toLowerCase().indexOf(q) < 0) return false;
      if (r.first && (r.first < rg.from || r.first > rg.to)) return false;
      if (f.channel !== 'any' && !OG.channelCounts(r)[f.channel]) return false;
      return true;
    });
  }

  function filtered() {
    var t = (TABS.find(function (x) { return x.key === f.tab; }) || TABS[0]).test;
    return base().filter(t).sort(function (a, b) {
      var x, y;
      if (f.sort === 'name') { x = OG.displayName(a).toLowerCase(); y = OG.displayName(b).toLowerCase(); }
      else if (f.sort === 'subject') { x = (a.subject || '').toLowerCase(); y = (b.subject || '').toLowerCase(); }
      else if (f.sort === 'status') { x = statusOf(a).order; y = statusOf(b).order; }
      else if (f.sort === 'channels') { x = OG.touchesFor(a.id).length; y = OG.touchesFor(b.id).length; }
      else { x = a.first || 0; y = b.first || 0; }
      if (typeof x === 'string') return x.localeCompare(y) * f.dir;
      return (x - y) * f.dir;
    });
  }

  function filtersActive() { return f.q || f.period !== 'all' || f.channel !== 'any'; }

  function body(el) {
    var b = base();
    el.querySelector('#c-tabs').innerHTML = TABS.map(function (t) {
      return '<button class="utab" role="tab" data-tab="' + t.key + '" aria-selected="' + (t.key === f.tab) + '">' + t.label +
        ' <span class="utab-n">' + b.filter(t.test).length + '</span></button>';
    }).join('');

    var rows = filtered();
    var pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (f.page >= pages) f.page = pages - 1;
    var start = f.page * PAGE, shown = rows.slice(start, start + PAGE);

    el.querySelector('#c-count').textContent = OG.state.rows.length + ' contacts' + (rows.length !== OG.state.rows.length ? ' · showing ' + rows.length : '');
    el.querySelector('#c-clear').hidden = !filtersActive();
    el.querySelector('tbody').innerHTML = shown.length ? shown.map(function (r) {
      var s = statusOf(r);
      return '<tr data-open="' + OG.esc(r.id) + '">' +
        '<td><div class="c-name">' + OG.esc(r.name || r.email || '—') + '</div>' + (r.name ? '<div class="c-mail">' + OG.esc(r.email) + '</div>' : '') + '</td>' +
        '<td class="cell-clip">' + OG.esc(r.subject || '—') + '</td>' +
        '<td><span class="pill ' + s.cls + '">' + s.text + '</span></td>' +
        '<td>' + channelIcons(r) + '</td>' +
        '<td class="nowrap muted">' + OG.fmtDate(r.first) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">No contacts here' + (filtersActive() ? ' with these filters. <a href="#" data-clear>Clear filters</a>' : '.') + '</td></tr>';

    el.querySelector('#c-pager').innerHTML = rows.length > PAGE
      ? '<span class="small muted">' + (start + 1) + '–' + (start + shown.length) + ' of ' + rows.length + '</span>' +
        '<button class="btn" data-pg="-1"' + (f.page === 0 ? ' disabled' : '') + '>‹ Previous</button>' +
        '<button class="btn" data-pg="1"' + (f.page >= pages - 1 ? ' disabled' : '') + '>Next ›</button>'
      : '';
    el.querySelectorAll('th button[data-sort]').forEach(function (btn) {
      var k = btn.getAttribute('data-sort');
      btn.setAttribute('aria-sort', k === f.sort ? (f.dir > 0 ? 'ascending' : 'descending') : 'none');
    });
  }

  function clearFilters(el) { f.q = ''; f.period = 'all'; f.channel = 'any'; f.from = f.to = ''; f.page = 0; OG.pages.contacts.render(el); }

  OG.pages.contacts = {
    title: 'Contacts',
    render: function (el) {
      var opts = function (list, cur) { return list.map(function (o) { return '<option value="' + o.key + '"' + (o.key === cur ? ' selected' : '') + '>' + o.label + '</option>'; }).join(''); };
      el.innerHTML = '<div class="page-head"><div><h1>Contacts</h1><p class="muted" id="c-count"></p></div>' +
          '<button class="btn" id="c-csv">' + OG.icon('download') + 'Download CSV</button></div>' +
        '<section class="card c-card">' +
          '<div class="utabs" id="c-tabs" role="tablist" aria-label="Status"></div>' +
          '<div class="toolbar c-tools">' +
            '<label class="search-box">' + OG.icon('search') + '<input class="input" id="c-q" type="search" placeholder="Search name, email or subject" value="' + OG.esc(f.q) + '" aria-label="Search contacts"></label>' +
            '<select class="select" id="c-period" aria-label="Period">' + opts(PERIODS, f.period) + '</select>' +
            '<select class="select" id="c-channel" aria-label="Channel">' + opts(CHANNELS, f.channel) + '</select>' +
            '<button class="btn ghost" id="c-clear" hidden>Clear filters</button>' +
          '</div>' +
          (f.period === 'custom' ? '<div class="toolbar c-range"><label class="small muted">From <input class="input" id="c-from" type="date" value="' + f.from + '"></label>' +
            '<label class="small muted">To <input class="input" id="c-to" type="date" value="' + f.to + '"></label></div>' : '') +
          '<div class="table-wrap"><table class="c-table"><thead><tr>' +
            SORTS.map(function (s) { return '<th><button data-sort="' + s.key + '">' + s.label + '</button></th>'; }).join('') +
          '</tr></thead><tbody></tbody></table></div><div class="pager" id="c-pager"></div>' +
        '</section>';

      body(el);
      var reset = function () { f.page = 0; body(el); };
      el.querySelector('#c-q').addEventListener('input', function (e) { f.q = e.target.value; reset(); });
      el.querySelector('#c-period').addEventListener('change', function (e) { f.period = e.target.value; f.page = 0; OG.pages.contacts.render(el); if (f.period === 'custom') { var x = el.querySelector('#c-from'); if (x) x.focus(); } });
      el.querySelector('#c-channel').addEventListener('change', function (e) { f.channel = e.target.value; reset(); });
      el.querySelector('#c-clear').addEventListener('click', function () { clearFilters(el); });
      var fr = el.querySelector('#c-from'), to = el.querySelector('#c-to');
      if (fr) fr.addEventListener('change', function (e) { f.from = e.target.value; reset(); });
      if (to) to.addEventListener('change', function (e) { f.to = e.target.value; reset(); });
      el.querySelectorAll('th button[data-sort]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var k = btn.getAttribute('data-sort');
          if (f.sort === k) f.dir = -f.dir; else { f.sort = k; f.dir = (k === 'first' || k === 'channels') ? -1 : 1; }
          reset();
        });
      });
      if (!el._ogContactsBound) { // tabs, paging and "clear" link: attach once per page element
        el._ogContactsBound = true;
        el.addEventListener('click', function (e) {
          var t = e.target.closest('[data-tab]'), pg = e.target.closest('[data-pg]'), cl = e.target.closest('[data-clear]');
          if (t) { f.tab = t.getAttribute('data-tab'); f.page = 0; body(el); }
          if (pg) { f.page += Number(pg.getAttribute('data-pg')); body(el); el.querySelector('table').scrollIntoView({ block: 'nearest' }); }
          if (cl) { e.preventDefault(); clearFilters(el); }
        });
      }
      el.querySelector('#c-csv').addEventListener('click', function () {
        var rows = filtered().map(function (r) {
          var cc = OG.channelCounts(r);
          return [r.name, r.email, r.subject, r.first ? OG.toInputDate(r.first) : '', statusOf(r).text, r.fu || 0, cc.Email, cc.LinkedIn, cc.WhatsApp, r.status, r.last ? OG.toInputDate(r.last) : '', r.snippet];
        });
        OG.downloadCSV('outreach-contacts-' + OG.toInputDate(Date.now()) + '.csv',
          ['Name', 'Email', 'Subject', 'Sent', 'Status', 'Automatic follow-ups sent', 'Manual email follow-ups', 'LinkedIn follow-ups', 'WhatsApp follow-ups', 'Sheet status', 'Last action', 'Reply'], rows);
      });
    },
    /* Keep typing focus when data refreshes in the background. */
    update: function (el) { if (el.querySelector('tbody')) body(el); else this.render(el); }
  };
})();
