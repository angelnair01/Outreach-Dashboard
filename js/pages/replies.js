(function () {
  var OG = window.OG;
  var filter = 'all';

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
          (OG.CW ? 'Everyone who replied. Decide the next step for each one.' : 'Everyone who replied, newest first. Answer them from Gmail.') + '</p></div>' +
        (OG.CW ? '<div class="seg">' + seg('all', 'All (' + all.length + ')') + seg('decide', 'To decide (' + nDecide + ')') + seg('planned', 'Planned (' + (all.length - nDecide) + ')') + '</div>' : '') +
        '</div>' +
        (rows.length ? '<div class="grid replies">' + rows.map(function (r) {
          return '<article class="card reply-card"><div class="reply-top"><div style="min-width:0">' +
            '<h3><a href="#" data-open="' + OG.esc(r.id) + '" style="color:inherit">' + OG.esc(OG.displayName(r)) + '</a></h3>' +
            '<div class="small muted">' + OG.esc(r.subject) + ' · replied ' + OG.fmtRel(r.last) + '</div></div>' + OG.pill(r) + '</div>' +
            '<div class="quote">' + (r.snippet ? OG.esc(r.snippet) : '<span class="muted">(No reply text saved)</span>') + '</div>' +
            '<div class="btn-row">' + (OG.CW ? OG.markButtons(r) : '') +
              '<a class="btn" href="' + OG.gmailThread(r.id) + '" target="_blank" rel="noopener">' + OG.icon('external') + 'Open in Gmail</a>' +
              '<a class="btn primary" href="' + OG.gmailCompose(r) + '" target="_blank" rel="noopener">' + OG.icon('mail') + 'Reply by email</a></div>' +
            '</article>';
        }).join('') + '</div>' : '<div class="card empty">No replies yet.</div>');

      el.querySelectorAll('[data-f]').forEach(function (b) {
        b.addEventListener('click', function () { filter = b.getAttribute('data-f'); OG.pages.replies.render(el); });
      });
    }
  };
})();
