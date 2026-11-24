/* Pipeline: three columns by what needs doing (Replied / Waiting / Closed), company-first cards
   and filters. Automatic follow-ups need no column: they go out by themselves. */
(function () {
  var OG = window.OG;
  var f = { q: '', company: 'all', period: 'all', channel: 'any' };
  var PER_COL = 10;                                  // cards per column page
  var page = { replied: 0, waiting: 0, closed: 0 };  // each column pages on its own

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
  // LinkedIn / WhatsApp icons when you followed up there. No counts on screen (they're in the tooltip).
  function channelIcons(r) {
    var c = OG.channelCounts(r);
    return OG.TOUCH_CHANNELS.filter(function (m) { return m.key !== 'Email' && c[m.key]; }).map(function (m) {
      return '<span class="ch-ic ' + m.cls + '" title="Followed up on ' + m.label + ' (' + c[m.key] + ')">' + OG.icon(m.icon) + '</span>';
    }).join('');
  }

  var NO_CO = 'No company yet';
  function coKey(r) { return OG.companyOf(r).name || NO_CO; }

  function filtered() {
    var q = f.q.toLowerCase();
    var from = f.period === 'all' ? -Infinity : Date.now() - Number(f.period) * OG.DAY;
    return OG.state.rows.filter(function (r) {
      var co = coKey(r);
      if (f.company !== 'all' && co !== f.company) return false;
      if (q && (OG.companyLabel(r) + ' ' + r.name + ' ' + r.email + ' ' + r.subject).toLowerCase().indexOf(q) < 0) return false;
      if (r.first && r.first < from) return false;
      if (f.channel !== 'any' && !OG.channelCounts(r)[f.channel]) return false;
      return true;
    });
  }

  function card(r, col) {
    var c = OG.companyOf(r);
    // Headline is always the company. Unknown (e.g. a Gmail address): "+ Add company", person underneath.
    var who = [r.name || r.email, r.subject].filter(Boolean).join(' · ');
    var head = c.name
      ? '<span class="pav">' + OG.esc(OG.initials(c.name)) + '</span><span class="pco">' + OG.esc(c.name) + '</span>'
      : '<span class="pav pav-none">' + OG.icon('plus') + '</span><span class="pco pco-none" data-addco="' + OG.esc(r.id) + '" title="Add the company for this contact">Add company</span>';
    var meta = col.key === 'replied' ? 'Replied ' + OG.fmtRel(r.last)
      : col.key === 'waiting' ? waitingLine(r)
      : (OG.isBounced(r) ? 'Bounced' : 'No reply') + ' · ' + OG.fmtDate(r.last || r.first);
    return '<button class="pcard tone-' + col.tone + '" data-open="' + OG.esc(r.id) + '">' +
      '<span class="pcard-top">' + head + '</span>' +
      (who ? '<span class="pwho">' + OG.esc(who) + '</span>' : '') +
      (col.key === 'replied' && r.snippet ? '<span class="psnip">“' + OG.esc(r.snippet.slice(0, 110)) + (r.snippet.length > 110 ? '…' : '') + '”</span>' : '') +
      '<span class="pmeta"><span>' + meta + '</span><span class="pch">' + channelIcons(r) + '</span></span></button>';
  }

  function board(rows) {
    return '<div class="pboard">' + COLS.map(function (col) {
      var items = rows.filter(col.test).sort(col.sort);
      var pages = Math.max(1, Math.ceil(items.length / PER_COL));
      if (page[col.key] >= pages) page[col.key] = pages - 1;
      var start = page[col.key] * PER_COL, list = items.slice(start, start + PER_COL);
      return '<section class="pcol tone-' + col.tone + '">' +
        '<header class="pcol-head"><h2>' + col.title + '</h2><span class="pcount">' + items.length + '</span></header>' +
        '<p class="pcol-hint">' + col.hint + '</p>' +
        (list.length ? list.map(function (r) { return card(r, col); }).join('')
          : '<div class="pempty">' + (col.key === 'replied' ? 'No replies to act on right now.' : 'Nothing here.') + '</div>') +
        (items.length > PER_COL ? '<div class="pcol-pager"><span class="small muted">' + (start + 1) + '–' + (start + list.length) + ' of ' + items.length + '</span>' +
          '<span class="pcol-nav"><button class="pg-arrow" data-cpg="' + col.key + '" data-dir="-1"' + (page[col.key] === 0 ? ' disabled' : '') + ' aria-label="Previous page">‹</button>' +
          '<span class="small">Page ' + (page[col.key] + 1) + ' of ' + pages + '</span>' +
          '<button class="pg-arrow" data-cpg="' + col.key + '" data-dir="1"' + (page[col.key] >= pages - 1 ? ' disabled' : '') + ' aria-label="Next page">›</button></span></div>' : '') +
        '</section>';
    }).join('') + '</div>';
  }

  function firstPages() { page.replied = page.waiting = page.closed = 0; }

  function body(el) {
    var rows = filtered();
    var rep = rows.filter(COLS[0].test).length, wait = rows.filter(COLS[1].test).length, clo = rows.filter(COLS[2].test).length;
    el.querySelector('#p-summary').innerHTML = '<strong>' + rep + '</strong> to take forward · ' + wait + ' waiting · ' + clo + ' closed' +
      (rows.length !== OG.state.rows.length ? ' <span class="muted">(filtered)</span>' : '');
    el.querySelector('#p-body').innerHTML = board(rows);
    el.querySelector('#p-clear').hidden = !(f.q || f.company !== 'all' || f.period !== 'all' || f.channel !== 'any');
  }

  OG.pages.pipeline = {
    title: 'Pipeline',
    render: function (el) {
      var all = OG.state.rows, counts = {};
      all.forEach(function (r) { var k = coKey(r); counts[k] = (counts[k] || 0) + 1; });
      var companies = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
      if (f.company !== 'all' && !counts[f.company]) f.company = 'all';
      var opts = function (list, cur) { return list.map(function (o) { return '<option value="' + OG.esc(o.key) + '"' + (o.key === cur ? ' selected' : '') + '>' + OG.esc(o.label) + '</option>'; }).join(''); };

      el.innerHTML = '<div class="page-head"><div><h1>Pipeline</h1><p class="muted" id="p-summary"></p></div>' +
          '</div>' +
        '<div class="toolbar ptools">' +
          '<label class="search-box">' + OG.icon('search') + '<input class="input" id="p-q" type="search" placeholder="Search company, person or subject" value="' + OG.esc(f.q) + '" aria-label="Search pipeline"></label>' +
          '<select class="select" id="p-company" aria-label="Company">' + opts([{ key: 'all', label: 'All companies' }].concat(companies.map(function (c) { return { key: c, label: c + ' (' + counts[c] + ')' }; })), f.company) + '</select>' +
          '<select class="select" id="p-period" aria-label="Period">' + opts(PERIODS, f.period) + '</select>' +
          '<select class="select" id="p-channel" aria-label="Channel">' + opts(CHANNELS, f.channel) + '</select>' +
          '<button class="btn ghost" id="p-clear" hidden>Clear filters</button>' +
        '</div><div id="p-body"></div>';

      body(el);
      el.querySelector('#p-q').addEventListener('input', function (e) { f.q = e.target.value; firstPages(); body(el); });
      el.querySelector('#p-company').addEventListener('change', function (e) { f.company = e.target.value; firstPages(); body(el); });
      el.querySelector('#p-period').addEventListener('change', function (e) { f.period = e.target.value; firstPages(); body(el); });
      el.querySelector('#p-channel').addEventListener('change', function (e) { f.channel = e.target.value; firstPages(); body(el); });
      el.querySelector('#p-clear').addEventListener('click', function () { f.q = ''; f.company = 'all'; f.period = 'all'; f.channel = 'any'; firstPages(); OG.pages.pipeline.render(el); });
      if (!el._ogPipeBound) { // column page arrows: attach once per page element
        el._ogPipeBound = true;
        el.addEventListener('click', function (e) {
          var add = e.target.closest('[data-addco]');
          if (add) { e.stopPropagation(); OG.openPanel(add.getAttribute('data-addco'), { editCompany: true }); return; }
          var b = e.target.closest('[data-cpg]');
          if (!b || b.disabled) return;
          var k = b.getAttribute('data-cpg'), y = window.scrollY;
          page[k] = Math.max(0, page[k] + Number(b.getAttribute('data-dir')));
          body(el); window.scrollTo(0, y);
        });
      }
    },
    /* Background refresh: redraw the cards but keep filters and typing focus. */
    update: function (el) { if (el.querySelector('#p-body')) body(el); else this.render(el); }
  };
})();
