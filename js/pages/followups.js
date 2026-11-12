(function () {
  var OG = window.OG;

  function table(items) {
    if (!items.length) return '<div class="empty">Nothing here.</div>';
    return '<div class="table-wrap"><table><thead><tr><th>Contact</th><th>Subject</th><th>Follow-up</th><th>Date</th><th></th></tr></thead><tbody>' +
      items.map(function (x) {
        var r = x.r, n = x.n;
        return '<tr data-open="' + OG.esc(r.id) + '"><td><strong>' + OG.esc(OG.displayName(r)) + '</strong></td>' +
          '<td class="cell-clip">' + OG.esc(r.subject) + '</td>' +
          '<td class="nowrap">' + n.n + ' of ' + OG.MAX_FU + '</td>' +
          '<td class="nowrap">' + (n.due ? '<span class="pill st-due">Due now</span>' : OG.fmtDate(n.when) + ' <span class="muted small">(' + OG.fmtRel(n.when) + ')</span>') + '</td>' +
          '<td><a class="btn" href="' + OG.gmailThread(r.id) + '" target="_blank" rel="noopener" data-stop>' + OG.icon('external') + 'Open in Gmail</a></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  OG.pages.followups = {
    title: 'Follow-ups',
    render: function (el) {
      var list = OG.state.rows.map(function (r) { return { r: r, n: OG.nextFollowUp(r) }; }).filter(function (x) { return x.n; })
        .sort(function (a, b) { return a.n.when - b.n.when; });
      var due = list.filter(function (x) { return x.n.due; }), upcoming = list.filter(function (x) { return !x.n.due; });
      el.innerHTML = '<div class="page-head"><div><h1>Follow-ups</h1><p class="muted">Who gets the next automatic follow-up, and when.</p></div></div>' +
        '<div class="info">✉️ <strong>You don\'t need to do anything here.</strong> Follow-ups are sent automatically by your Google Sheet script ' +
        '(checked every hour, 7 days after the last mail, 2 follow-ups at most). It stops by itself when someone replies.</div>' +
        '<section class="card" style="margin-bottom:16px"><h2>Due now (' + due.length + ')</h2>' + table(due) + '</section>' +
        '<section class="card"><h2>Upcoming (' + upcoming.length + ')</h2>' + table(upcoming) + '</section>';
    }
  };
})();
