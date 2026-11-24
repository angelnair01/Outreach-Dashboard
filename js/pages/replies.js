/* Replies: an inbox of everyone who wrote back. Compact rows, search, period, sort, 20 per page. */
(function () {
  var OG = window.OG;
  var PAGE = 20;
  var f = { q: '', period: 'all', sort: 'new', page: 0 };
  var PERIODS = [{ key: 'all', label: 'Any time' }, { key: '7', label: 'Last 7 days' }, { key: '30', label: 'Last 30 days' },
    { key: '60', label: 'Last 60 days' }, { key: '90', label: 'Last 90 days' }];
  var SORTS = [{ key: 'new', label: 'Newest first' }, { key: 'old', label: 'Oldest first' }, { key: 'company', label: 'Company A–Z' }];

  function isReply(r) { return OG.isReplied(r) || r.stage === 'call' || r.stage === 'whatsapp'; }
  function coName(r) { var c = OG.companyOf(r); return c.name || r.name || r.email || ''; }

  function filtered() {
    var q = f.q.toLowerCase();
    var from = f.period === 'all' ? -Infinity : Date.now() - Number(f.period) * OG.DAY;
    return OG.state.rows.filter(function (r) {
      if (!isReply(r)) return false;
      if ((r.last || 0) < from) return false;
      if (q && (coName(r) + ' ' + r.name + ' ' + r.email + ' ' + r.subject + ' ' + r.snippet).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      if (f.sort === 'old') return (a.last || 0) - (b.last || 0);
      if (f.sort === 'company') return coName(a).toLowerCase().localeCompare(coName(b).toLowerCase());
      return (b.last || 0) - (a.last || 0);
    });
  }

  // Page buttons: 1 … 4 5 6 … 12 (always first, last, and two either side of the current page)
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

  function row(r) {
    var c = OG.companyOf(r), co = coName(r), person = c.name ? (r.name || r.email) : (r.name ? r.email : '');
    return '<div class="t-row" data-open="' + OG.esc(r.id) + '">' +
      '<span class="t-av">' + OG.esc(OG.initials(co)) + '</span>' +
      '<div class="t-main"><div class="t-title">' + OG.esc(co) + (person ? ' <span>· ' + OG.esc(person) + '</span>' : '') + '</div>' +
        '<div class="t-quote">' + (r.snippet ? '“' + OG.esc(r.snippet) + '”' : '<span class="muted">(No reply text saved)</span>') + '</div>' +
        '<div class="t-meta">Replied ' + OG.fmtRel(r.last) + ' · ' + OG.fmtDate(r.last) + (r.subject ? ' · ' + OG.esc(r.subject) : '') + '</div></div>' +
      '<div class="t-act">' +
        '<a class="btn" data-stop target="_blank" rel="noopener" href="' + OG.gmailThread(r.id) + '" title="Open the conversation in Gmail">' + OG.icon('external') + '<span>Open</span></a>' +
        '<a class="btn primary" data-stop target="_blank" rel="noopener" href="' + OG.gmailCompose(r) + '">' + OG.icon('reply') + '<span>Reply</span></a>' +
      '</div></div>';
  }

  function body(el) {
    var all = OG.state.rows.filter(isReply).length;
    var rows = filtered();
    var pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (f.page >= pages) f.page = pages - 1;
    var start = f.page * PAGE, shown = rows.slice(start, start + PAGE);
    var active = f.q || f.period !== 'all';

    el.querySelector('#r-count').textContent = all
      ? all + ' ' + (all === 1 ? 'person has' : 'people have') + ' replied' + (active ? ' · ' + rows.length + ' match your filters' : '') + '. Reply from Gmail or set up a call.'
      : 'Everyone who writes back appears here.';
    el.querySelector('#r-clear').hidden = !active;
    el.querySelector('#r-list').innerHTML = shown.length ? shown.map(row).join('')
      : '<div class="t-empty">' + (all ? 'No replies match these filters. <a href="#" data-rclear>Clear filters</a>' : 'No replies yet. They\'ll appear here as soon as someone writes back.') + '</div>';
    el.querySelector('#r-pager').innerHTML = rows.length > PAGE
      ? '<span class="small muted">' + (start + 1) + '–' + (start + shown.length) + ' of ' + rows.length + '</span>' +
        '<span class="pg"><button class="btn" data-pg="-1"' + (f.page === 0 ? ' disabled' : '') + '>‹ Previous</button>' +
        pageButtons(f.page, pages) +
        '<button class="btn" data-pg="1"' + (f.page >= pages - 1 ? ' disabled' : '') + '>Next ›</button></span>'
      : '';
  }

  OG.pages.replies = {
    title: 'Replies',
    render: function (el) {
      var opts = function (list, cur) { return list.map(function (o) { return '<option value="' + o.key + '"' + (o.key === cur ? ' selected' : '') + '>' + o.label + '</option>'; }).join(''); };
      el.innerHTML = '<div class="page-head"><div><h1>Replies</h1><p class="muted" id="r-count"></p></div></div>' +
        '<div class="toolbar r-tools">' +
          '<label class="search-box">' + OG.icon('search') + '<input class="input" id="r-q" type="search" placeholder="Search company, person or reply text" value="' + OG.esc(f.q) + '" aria-label="Search replies"></label>' +
          '<select class="select" id="r-period" aria-label="Period">' + opts(PERIODS, f.period) + '</select>' +
          '<select class="select" id="r-sort" aria-label="Sort">' + opts(SORTS, f.sort) + '</select>' +
          '<button class="btn ghost" id="r-clear" hidden>Clear filters</button>' +
        '</div>' +
        '<section class="panel-card"><div class="pc-body r-list" id="r-list"></div></section>' +
        '<div class="pager r-pager" id="r-pager"></div>';

      body(el);
      var reset = function () { f.page = 0; body(el); };
      el.querySelector('#r-q').addEventListener('input', function (e) { f.q = e.target.value; reset(); });
      el.querySelector('#r-period').addEventListener('change', function (e) { f.period = e.target.value; reset(); });
      el.querySelector('#r-sort').addEventListener('change', function (e) { f.sort = e.target.value; reset(); });
      el.querySelector('#r-clear').addEventListener('click', function () { f.q = ''; f.period = 'all'; f.page = 0; OG.pages.replies.render(el); });
      if (!el._ogRepliesBound) { // paging + "clear" link: attach once per page element
        el._ogRepliesBound = true;
        el.addEventListener('click', function (e) {
          var pg = e.target.closest('[data-pg]'), n = e.target.closest('[data-page]'), cl = e.target.closest('[data-rclear]');
          if (pg) f.page += Number(pg.getAttribute('data-pg'));
          else if (n) f.page = Number(n.getAttribute('data-page'));
          else if (cl) { e.preventDefault(); f.q = ''; f.period = 'all'; f.page = 0; OG.pages.replies.render(el); return; }
          else return;
          body(el);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
    },
    /* Background refresh: redraw the list but keep filters, page and typing focus. */
    update: function (el) { if (el.querySelector('#r-list')) body(el); else this.render(el); }
  };
})();
