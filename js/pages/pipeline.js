/* Pipeline: three summary tiles (Replied / Waiting / Closed) that double as the switch,
   then one clean list for the chosen group, 25 per page. Company-first rows, filters on top.
   Automatic follow-ups need no group of their own: they go out by themselves. */
(function () {
  var OG = window.OG;
  var PAGE = 25;
  var f = { q: '', company: 'all', period: 'all', channel: 'any', group: 'replied' };
  var page = { replied: 0, waiting: 0, closed: 0 };   // each group remembers its own page

  var GROUPS = [
    { key: 'replied', title: 'Replied: take it forward', hint: 'They wrote back. Reply or set up a call.', tone: 'replied',
      test: function (r) { return r.stage === 'replied' || r.stage === 'call' || r.stage === 'whatsapp'; },
      sort: function (a, b) { return (b.last || 0) - (a.last || 0); }, empty: 'No replies to act on right now.' },
    { key: 'waiting', title: 'Waiting', hint: 'Follow-ups go out automatically.', tone: 'waiting',
      test: function (r) { return r.stage === 'waiting' || r.stage === 'followup'; },
      sort: function (a, b) { return nextAt(a) - nextAt(b); }, empty: 'Nobody is waiting for a reply.' },
    { key: 'closed', title: 'Closed', hint: 'No reply after 2 follow-ups, or bounced.', tone: 'closed',
      test: function (r) { return r.stage === 'stopped'; },
      sort: function (a, b) { return (b.last || b.first || 0) - (a.last || a.first || 0); }, empty: 'Nothing closed yet.' }
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
  // LinkedIn / WhatsApp icons when you followed up there (the count is in the tooltip).
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
      if (f.company !== 'all' && coKey(r) !== f.company) return false;
      if (q && (OG.companyLabel(r) + ' ' + r.name + ' ' + r.email + ' ' + r.subject + ' ' + (r.snippet || '')).toLowerCase().indexOf(q) < 0) return false;
      if (r.first && r.first < from) return false;
      if (f.channel !== 'any' && !OG.channelCounts(r)[f.channel]) return false;
      return true;
    });
  }

  function row(r, g) {
    var c = OG.companyOf(r);
    var person = r.name || r.email;
    var head = c.name
      ? '<span class="t-av tone-' + g.tone + '">' + OG.esc(OG.initials(c.name)) + '</span>'
      : '<span class="t-av pav-none">' + OG.icon('plus') + '</span>';
    var title = c.name
      ? OG.esc(c.name) + ' <span>· ' + OG.esc(person) + '</span>'
      : '<span class="pco-none" data-addco="' + OG.esc(r.id) + '" title="Add the company for this contact">Add company</span> <span>· ' + OG.esc(person) + '</span>';
    var line, when, act = '';
    if (g.key === 'replied') {
      line = r.snippet ? '“' + OG.esc(r.snippet) + '”' : '<span class="muted">(No reply text saved)</span>';
      when = 'Replied ' + OG.fmtRel(r.last) + (r.subject ? ' · ' + OG.esc(r.subject) : '');
      act = '<a class="btn primary" data-stop target="_blank" rel="noopener" href="' + OG.gmailCompose(r) + '">' + OG.icon('reply') + '<span>Reply</span></a>';
    } else if (g.key === 'waiting') {
      line = OG.esc(r.subject || '');
      when = waitingLine(r) + ' · first sent ' + OG.fmtDate(r.first);
    } else {
      line = OG.esc(r.subject || '');
      when = (OG.isBounced(r) ? 'Bounced' : 'No reply after ' + (r.fu || 0) + ' follow-up' + ((r.fu || 0) === 1 ? '' : 's')) + ' · ' + OG.fmtDate(r.last || r.first);
    }
    return '<div class="t-row" data-open="' + OG.esc(r.id) + '">' + head +
      '<div class="t-main"><div class="t-title">' + title + '</div>' +
        (line ? '<div class="t-quote">' + line + '</div>' : '') +
        '<div class="t-meta">' + when + '</div></div>' +
      '<div class="t-act"><span class="pch">' + channelIcons(r) + '</span>' + act + '</div></div>';
  }

  // Page buttons: 1 … 4 5 6 … 12 (first, last, and two either side of the current page)
  function pageButtons(cur, total) {
    var out = [], last = -1;
    for (var i = 0; i < total; i++) {
      if (i === 0 || i === total - 1 || Math.abs(i - cur) <= 2) {
        if (last >= 0 && i - last > 1) out.push('<span class="pg-gap">…</span>');
        out.push('<button class="pg-n" data-page="' + i + '"' + (i === cur ? ' aria-current="page"' : '') + '>' + (i + 1) + '</button>');
        last = i;
      }
    }
    return out.join('');
  }

  function firstPages() { page.replied = page.waiting = page.closed = 0; }
  function active() { return f.q || f.company !== 'all' || f.period !== 'all' || f.channel !== 'any'; }

  function body(el) {
    var rows = filtered();
    var counts = {};
    GROUPS.forEach(function (g) { counts[g.key] = rows.filter(g.test).length; });

    el.querySelector('#p-tiles').innerHTML = GROUPS.map(function (g) {
      return '<button class="ptile tone-' + g.tone + '" data-group="' + g.key + '" aria-pressed="' + (f.group === g.key) + '">' +
        '<span class="ptile-l">' + g.title + '</span><span class="ptile-v">' + counts[g.key] + '</span><span class="ptile-h">' + g.hint + '</span></button>';
    }).join('');

    var g = GROUPS.filter(function (x) { return x.key === f.group; })[0] || GROUPS[0];
    var items = rows.filter(g.test).sort(g.sort);
    var pages = Math.max(1, Math.ceil(items.length / PAGE));
    if (page[g.key] >= pages) page[g.key] = pages - 1;
    var start = page[g.key] * PAGE, list = items.slice(start, start + PAGE);

    el.querySelector('#p-summary').innerHTML = counts.replied + ' to take forward · ' + counts.waiting + ' waiting · ' + counts.closed + ' closed' +
      (active() ? ' <span class="muted">(filtered)</span>' : '');
    el.querySelector('#p-clear').hidden = !active();
    el.querySelector('#p-list').innerHTML = list.length ? list.map(function (r) { return row(r, g); }).join('')
      : '<div class="t-empty">' + (active() ? 'Nothing here with these filters. <a href="#" data-pclear>Clear filters</a>' : g.empty) + '</div>';
    el.querySelector('#p-pager').innerHTML = items.length > PAGE
      ? '<span class="small muted">' + (start + 1) + '–' + (start + list.length) + ' of ' + items.length + '</span>' +
        '<span class="pg"><button class="btn" data-pg="-1"' + (page[g.key] === 0 ? ' disabled' : '') + '>‹ Previous</button>' +
        pageButtons(page[g.key], pages) +
        '<button class="btn" data-pg="1"' + (page[g.key] >= pages - 1 ? ' disabled' : '') + '>Next ›</button></span>'
      : '';
  }

  function clearFilters(el) { f.q = ''; f.company = 'all'; f.period = 'all'; f.channel = 'any'; firstPages(); OG.pages.pipeline.render(el); }

  OG.pages.pipeline = {
    title: 'Pipeline',
    render: function (el) {
      var all = OG.state.rows, counts = {};
      all.forEach(function (r) { var k = coKey(r); counts[k] = (counts[k] || 0) + 1; });
      var companies = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
      if (f.company !== 'all' && !counts[f.company]) f.company = 'all';
      var opts = function (list, cur) { return list.map(function (o) { return '<option value="' + OG.esc(o.key) + '"' + (o.key === cur ? ' selected' : '') + '>' + OG.esc(o.label) + '</option>'; }).join(''); };

      el.innerHTML = '<div class="page-head"><div><h1>Pipeline</h1><p class="muted" id="p-summary"></p></div></div>' +
        '<div class="ptiles" id="p-tiles" role="group" aria-label="Choose a group"></div>' +
        '<div class="toolbar ptools">' +
          '<label class="search-box">' + OG.icon('search') + '<input class="input" id="p-q" type="search" placeholder="Search company, person, subject or reply" value="' + OG.esc(f.q) + '" aria-label="Search pipeline"></label>' +
          '<select class="select" id="p-company" aria-label="Company">' + opts([{ key: 'all', label: 'All companies' }].concat(companies.map(function (c) { return { key: c, label: c + ' (' + counts[c] + ')' }; })), f.company) + '</select>' +
          '<select class="select" id="p-period" aria-label="Period">' + opts(PERIODS, f.period) + '</select>' +
          '<select class="select" id="p-channel" aria-label="Channel">' + opts(CHANNELS, f.channel) + '</select>' +
          '<button class="btn ghost" id="p-clear" hidden>Clear filters</button>' +
        '</div>' +
        '<section class="panel-card"><div class="pc-body p-list" id="p-list"></div></section>' +
        '<div class="pager r-pager" id="p-pager"></div>';

      body(el);
      var reset = function () { firstPages(); body(el); };
      el.querySelector('#p-q').addEventListener('input', function (e) { f.q = e.target.value; reset(); });
      el.querySelector('#p-company').addEventListener('change', function (e) { f.company = e.target.value; reset(); });
      el.querySelector('#p-period').addEventListener('change', function (e) { f.period = e.target.value; reset(); });
      el.querySelector('#p-channel').addEventListener('change', function (e) { f.channel = e.target.value; reset(); });
      el.querySelector('#p-clear').addEventListener('click', function () { clearFilters(el); });
      if (!el._ogPipeBound) { // tiles, paging, "Add company", clear link: attach once per page element
        el._ogPipeBound = true;
        el.addEventListener('click', function (e) {
          var add = e.target.closest('[data-addco]');
          if (add) { e.stopPropagation(); OG.openPanel(add.getAttribute('data-addco'), { editCompany: true }); return; }
          var t = e.target.closest('[data-group]');
          if (t) { f.group = t.getAttribute('data-group'); body(el); return; }
          var cl = e.target.closest('[data-pclear]');
          if (cl) { e.preventDefault(); clearFilters(el); return; }
          var pg = e.target.closest('[data-pg]'), n = e.target.closest('[data-page]');
          if (pg && !pg.disabled) page[f.group] = Math.max(0, page[f.group] + Number(pg.getAttribute('data-pg')));
          else if (n) page[f.group] = Number(n.getAttribute('data-page'));
          else return;
          body(el);
          var top = el.querySelector('#p-tiles').getBoundingClientRect().top + window.scrollY - 70;
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        });
      }
    },
    /* Background refresh: redraw but keep filters, chosen group, page and typing focus. */
    update: function (el) { if (el.querySelector('#p-list')) body(el); else this.render(el); }
  };
})();
