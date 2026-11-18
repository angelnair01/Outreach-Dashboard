/* Pipeline: three columns by what needs doing (Replied / Waiting / Closed), company-first cards,
   filters, and a "By company" view. Automatic follow-ups need no column: they go out by themselves. */
(function () {
  var OG = window.OG;
  var f = { view: 'board', q: '', company: 'all', period: 'all', channel: 'any' };
  var shown = { replied: 20, waiting: 12, closed: 5, companies: 20 };
  var STEP = { replied: 20, waiting: 24, closed: 20, companies: 20 };

  var COLS = [
    { key: 'replied', title: 'Replied: take it forward', hint: 'They wrote back. Set up a call or the next step.', tone: 'replied',
      test: function (r) { return r.stage === 'replied' || r.stage === 'call' || r.stage === 'whatsapp'; },
      sort: function (a, b) { return (b.last || 0) - (a.last || 0); } },
    { key: 'waiting', title: 'Waiting', hint: 'Follow-ups go out automatically.', tone: 'waiting',
      test: function (r) { return r.stage === 'waiting' || r.stage === 'followup'; },
      sort: function (a, b) { return nextAt(a) - nextAt(b); } },
    { key: 'closed', title: 'Closed', hint: 'No reply after 2 follow-ups, or bounced.', tone: 'closed',
      test: function (r) { return r.stage === 'stopped'; },
      sort: function (a, b) { return (b.last || b.first || 0) - (a.last || a.first || 0); } }
  ];
  var PERIODS = [{ key: 'all', label: 'Any time' }, { key: '30', label: 'Last 30 days' }, { key: '60', label: 'Last 60 days' }, { key: '90', label: 'Last 90 days' }];
  var CHANNELS = [{ key: 'any', label: 'All channels' }, { key: 'LinkedIn', label: 'LinkedIn follow-up' }, { key: 'WhatsApp', label: 'WhatsApp follow-up' }, { key: 'Email', label: 'Manual email follow-up' }];

  // When the next automatic step happens: next follow-up, or (after the last one) when it closes.
  function nextAt(r) {
    var n = OG.nextFollowUp(r);
    if (n) return n.when;
    return (r.last || r.first || 0) + OG.FU_DAYS * OG.DAY;
  }
  function inDays(ms) {
    var d = Math.ceil((ms - Date.now()) / OG.DAY);
    return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : 'in ' + d + ' days';
  }
  function waitingLine(r) {
    var n = OG.nextFollowUp(r);
    if (n) return 'Follow-up ' + n.n + ' of ' + OG.MAX_FU + ' ' + (n.due ? 'goes out today' : inDays(n.when));
    return 'Final follow-up sent · closes ' + inDays(nextAt(r));
  }
  function statusOf(r) {
    if (OG.isBounced(r)) return { text: 'Bounced', cls: 'st-bounced' };
    if (COLS[0].test(r)) return { text: 'Replied', cls: 'st-replied' };
    if (r.stage === 'stopped') return { text: 'No reply', cls: 'st-stopped' };
    return { text: 'Waiting', cls: 'st-waiting' };
  }
  // LinkedIn / WhatsApp icons when you followed up there. No counts on screen (they're in the tooltip).
  function channelIcons(r) {
    var c = OG.channelCounts(r);
    return OG.TOUCH_CHANNELS.filter(function (m) { return m.key !== 'Email' && c[m.key]; }).map(function (m) {
      return '<span class="ch-ic ' + m.cls + '" title="Followed up on ' + m.label + ' (' + c[m.key] + ')">' + OG.icon(m.icon) + '</span>';
    }).join('');
  }

  function filtered() {
    var q = f.q.toLowerCase();
    var from = f.period === 'all' ? -Infinity : Date.now() - Number(f.period) * OG.DAY;
    return OG.state.rows.filter(function (r) {
      var co = OG.companyLabel(r);
      if (f.company !== 'all' && co !== f.company) return false;
      if (q && (co + ' ' + r.name + ' ' + r.email + ' ' + r.subject).toLowerCase().indexOf(q) < 0) return false;
      if (r.first && r.first < from) return false;
      if (f.channel !== 'any' && !OG.channelCounts(r)[f.channel]) return false;
      return true;
    });
  }

  function card(r, col) {
    var c = OG.companyOf(r), label = OG.companyLabel(r);
    var who = c.name ? [r.name || r.email, r.subject].filter(Boolean).join(' · ') : (r.subject || '');
    var meta = col.key === 'replied' ? 'Replied ' + OG.fmtRel(r.last)
      : col.key === 'waiting' ? waitingLine(r)
      : (OG.isBounced(r) ? 'Bounced' : 'No reply') + ' · ' + OG.fmtDate(r.last || r.first);
    return '<button class="pcard tone-' + col.tone + '" data-open="' + OG.esc(r.id) + '">' +
      '<span class="pcard-top"><span class="pav">' + OG.esc(OG.initials(label)) + '</span><span class="pco">' + OG.esc(label) + '</span></span>' +
      (who ? '<span class="pwho">' + OG.esc(who) + '</span>' : '') +
      (col.key === 'replied' && r.snippet ? '<span class="psnip">“' + OG.esc(r.snippet.slice(0, 110)) + (r.snippet.length > 110 ? '…' : '') + '”</span>' : '') +
      '<span class="pmeta"><span>' + meta + '</span><span class="pch">' + channelIcons(r) + '</span></span></button>';
  }

  function board(rows) {
    return '<div class="pboard">' + COLS.map(function (col) {
      var items = rows.filter(col.test).sort(col.sort);
      var list = items.slice(0, shown[col.key]);
      return '<section class="pcol tone-' + col.tone + '">' +
        '<header class="pcol-head"><h2>' + col.title + '</h2><span class="pcount">' + items.length + '</span></header>' +
        '<p class="pcol-hint">' + col.hint + '</p>' +
        (list.length ? list.map(function (r) { return card(r, col); }).join('')
          : '<div class="pempty">' + (col.key === 'replied' ? 'No replies to act on right now.' : 'Nothing here.') + '</div>') +
        (items.length > list.length ? '<button class="btn pmore" data-more="' + col.key + '">Show ' + Math.min(STEP[col.key], items.length - list.length) + ' more · ' + (items.length - list.length) + ' left</button>' : '') +
        '</section>';
    }).join('') + '</div>';
  }

  function byCompany(rows) {
    var groups = {};
    rows.forEach(function (r) { var k = OG.companyLabel(r); (groups[k] = groups[k] || []).push(r); });
    var list = Object.keys(groups).map(function (k) {
      var g = groups[k];
      return { name: k, rows: g, replied: g.filter(COLS[0].test).length, waiting: g.filter(COLS[1].test).length, closed: g.filter(COLS[2].test).length,
        latest: Math.max.apply(null, g.map(function (r) { return r.last || r.first || 0; })) };
    }).sort(function (a, b) { return (b.replied > 0) - (a.replied > 0) || b.latest - a.latest; });
    var vis = list.slice(0, shown.companies);
    if (!vis.length) return '<div class="card empty">No contacts match these filters.</div>';
    return vis.map(function (g) {
      var bits = [g.replied ? '<span class="pill st-replied">' + g.replied + ' replied</span>' : '',
        g.waiting ? '<span class="pill st-waiting">' + g.waiting + ' waiting</span>' : '',
        g.closed ? '<span class="pill st-stopped">' + g.closed + ' closed</span>' : ''].join('');
      return '<section class="card cogroup"><header class="cog-head"><span class="pav">' + OG.esc(OG.initials(g.name)) + '</span>' +
        '<div class="cog-title"><h2>' + OG.esc(g.name) + '</h2><span class="small muted">' + g.rows.length + ' contact' + (g.rows.length > 1 ? 's' : '') + '</span></div>' +
        '<div class="cog-pills">' + bits + '</div></header><ul class="list">' +
        g.rows.sort(function (a, b) { return (b.last || b.first || 0) - (a.last || a.first || 0); }).map(function (r) {
          var s = statusOf(r);
          return '<li><button class="row-btn" data-open="' + OG.esc(r.id) + '"><div class="row-main"><div class="row-title">' + OG.esc(r.name || r.email) + '</div>' +
            '<div class="row-sub">' + OG.esc(r.subject || '') + '</div></div><span class="pch">' + channelIcons(r) + '</span>' +
            '<span class="pill ' + s.cls + '">' + s.text + '</span><span class="small muted nowrap">' + OG.fmtDate(r.last || r.first) + '</span></button></li>';
        }).join('') + '</ul></section>';
    }).join('') + (list.length > vis.length ? '<div class="more-row"><button class="btn" data-more="companies">Show ' + Math.min(STEP.companies, list.length - vis.length) + ' more companies</button></div>' : '');
  }

  function body(el) {
    var rows = filtered();
    var rep = rows.filter(COLS[0].test).length, wait = rows.filter(COLS[1].test).length, clo = rows.filter(COLS[2].test).length;
    el.querySelector('#p-summary').innerHTML = '<strong>' + rep + '</strong> to take forward · ' + wait + ' waiting · ' + clo + ' closed' +
      (rows.length !== OG.state.rows.length ? ' <span class="muted">(filtered)</span>' : '');
    el.querySelector('#p-body').innerHTML = f.view === 'board' ? board(rows) : byCompany(rows);
    el.querySelector('#p-clear').hidden = !(f.q || f.company !== 'all' || f.period !== 'all' || f.channel !== 'any');
  }

  OG.pages.pipeline = {
    title: 'Pipeline',
    render: function (el) {
      var all = OG.state.rows, counts = {};
      all.forEach(function (r) { var k = OG.companyLabel(r); counts[k] = (counts[k] || 0) + 1; });
      var companies = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
      if (f.company !== 'all' && !counts[f.company]) f.company = 'all';
      var opts = function (list, cur) { return list.map(function (o) { return '<option value="' + OG.esc(o.key) + '"' + (o.key === cur ? ' selected' : '') + '>' + OG.esc(o.label) + '</option>'; }).join(''); };
      var seg = function (k, label, icon) { return '<button data-view="' + k + '" aria-pressed="' + (f.view === k) + '">' + OG.icon(icon) + label + '</button>'; };

      el.innerHTML = '<div class="page-head"><div><h1>Pipeline</h1><p class="muted" id="p-summary"></p></div>' +
          '<div class="seg pview">' + seg('board', 'Board', 'pipeline') + seg('company', 'By company', 'contacts') + '</div></div>' +
        '<div class="toolbar ptools">' +
          '<label class="search-box">' + OG.icon('search') + '<input class="input" id="p-q" type="search" placeholder="Search company, person or subject" value="' + OG.esc(f.q) + '" aria-label="Search pipeline"></label>' +
          '<select class="select" id="p-company" aria-label="Company">' + opts([{ key: 'all', label: 'All companies' }].concat(companies.map(function (c) { return { key: c, label: c + ' (' + counts[c] + ')' }; })), f.company) + '</select>' +
          '<select class="select" id="p-period" aria-label="Period">' + opts(PERIODS, f.period) + '</select>' +
          '<select class="select" id="p-channel" aria-label="Channel">' + opts(CHANNELS, f.channel) + '</select>' +
          '<button class="btn ghost" id="p-clear" hidden>Clear filters</button>' +
        '</div><div id="p-body"></div>';

      body(el);
      el.querySelector('#p-q').addEventListener('input', function (e) { f.q = e.target.value; body(el); });
      el.querySelector('#p-company').addEventListener('change', function (e) { f.company = e.target.value; body(el); });
      el.querySelector('#p-period').addEventListener('change', function (e) { f.period = e.target.value; body(el); });
      el.querySelector('#p-channel').addEventListener('change', function (e) { f.channel = e.target.value; body(el); });
      el.querySelector('#p-clear').addEventListener('click', function () { f.q = ''; f.company = 'all'; f.period = 'all'; f.channel = 'any'; OG.pages.pipeline.render(el); });
      el.querySelectorAll('[data-view]').forEach(function (b) {
        b.addEventListener('click', function () { f.view = b.getAttribute('data-view'); OG.pages.pipeline.render(el); });
      });
      if (!el._ogPipeBound) { // "show more" buttons: attach once per page element
        el._ogPipeBound = true;
        el.addEventListener('click', function (e) {
          var m = e.target.closest('[data-more]');
          if (!m) return;
          var k = m.getAttribute('data-more'), y = window.scrollY;
          shown[k] += STEP[k]; body(el); window.scrollTo(0, y);
        });
      }
    },
    /* Background refresh: redraw the cards but keep filters and typing focus. */
    update: function (el) { if (el.querySelector('#p-body')) body(el); else this.render(el); }
  };
})();
