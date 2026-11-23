(function () {
  var OG = window.OG;
  var filter = 'all';
  var STEP = 30, limit = STEP;

  OG.pages.replies = {
    title: 'Replies',
    render: function (el) {
      var all = OG.state.rows.filter(function (r) { return OG.isReplied(r) || r.stage === 'call' || r.stage === 'whatsapp'; })
        .sort(function (a, b) { return (b.last || 0) - (a.last || 0); });
      if (!OG.CW) filter = 'all';
      var rows = all.filter(function (r) {
        return filter === 'all' || (filter === 'decide' ? r.stage === 'replied' : (r.stage === 'call' || r.stage === 'whatsapp'));
      });
      var nDecide = all.filter(function (r) { return r.stage === 'replied'; }).length;
      var seg = function (k, label) { return '<button data-f="' + k + '" aria-pressed="' + (filter === k) + '">' + label + '</button>'; };

      el.innerHTML = '<div class="page-head"><div><h1>' + (OG.CW ? 'Replies / Next steps' : 'Replies') + '</h1><p class="muted">' +
          (OG.CW ? 'Everyone who replied. Decide the next step for each one.' : 'Everyone who wrote back, newest first. Reply from Gmail or set up a call.') + '</p></div>' +
        (OG.CW ? '<div class="seg">' + seg('all', 'All (' + all.length + ')') + seg('decide', 'To decide (' + nDecide + ')') + seg('planned', 'Planned (' + (all.length - nDecide) + ')') + '</div>' : '') +
        '</div>' +
        (rows.length ? '<div class="grid replies">' + rows.slice(0, limit).map(function (r) {
          var c = OG.companyOf(r), co = c.name || OG.displayName(r);
          return '<article class="card reply-card"><div class="reply-top"><div style="min-width:0;display:flex;gap:12px;align-items:center">' +
            '<span class="t-av">' + OG.esc(OG.initials(co)) + '</span><div style="min-width:0">' +
            '<h3><a href="#" data-open="' + OG.esc(r.id) + '" style="color:inherit;text-decoration:none">' + OG.esc(co) + '</a></h3>' +
            '<div class="small muted">' + (c.name ? OG.esc(r.name || r.email) + ' · ' : '') + 'replied ' + OG.fmtRel(r.last) + (r.subject ? ' · ' + OG.esc(r.subject) : '') + '</div></div></div>' + OG.pill(r) + '</div>' +
            '<div class="quote">' + (r.snippet ? OG.esc(r.snippet) : '<span class="muted">(No reply text saved)</span>') + '</div>' +
            '<div class="btn-row">' + (OG.CW ? OG.markButtons(r) : '') +
              '<a class="btn" href="' + OG.gmailThread(r.id) + '" target="_blank" rel="noopener">' + OG.icon('external') + 'Open in Gmail</a>' +
              '<a class="btn primary" href="' + OG.gmailCompose(r) + '" target="_blank" rel="noopener">' + OG.icon('mail') + 'Reply</a></div>' +
            '</article>';
        }).join('') + '</div>' +
          (rows.length > limit ? '<div class="more-row"><button class="btn" id="r-more">Show ' + Math.min(STEP, rows.length - limit) + ' more (' + (rows.length - limit) + ' left)</button></div>' : '')
          : '<div class="card empty">No replies yet. They\'ll appear here as soon as someone writes back.</div>');
      var more = el.querySelector('#r-more');
      if (more) more.onclick = function () { var y = window.scrollY; limit += STEP; OG.pages.replies.render(el); window.scrollTo(0, y); };

      el.querySelectorAll('[data-f]').forEach(function (b) {
        b.addEventListener('click', function () { filter = b.getAttribute('data-f'); OG.pages.replies.render(el); });
      });
    }
  };
})();
