/* Today: the start page. What needs you (replies), what goes out automatically today,
   four key numbers, a weekly chart and recent activity. */
(function () {
  var OG = window.OG;
  OG.pages = OG.pages || {};

  function firstName() {
    if (OG.isDemo()) return '';
    var p = OG.auth.decode(OG.state.token) || {};
    return p.given_name || String(p.name || '').split(' ')[0] || '';
  }
  function greeting() { return 'Hello'; }
  function isReplied(r) { return r.stage === 'replied' || r.stage === 'call' || r.stage === 'whatsapp'; }
  function endOfToday() { var d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }

  function replyRow(r) {
    var c = OG.companyOf(r), co = c.name || r.name || r.email;
    var person = c.name ? (r.name || r.email) : '';
    return '<div class="t-row" data-open="' + OG.esc(r.id) + '">' +
      '<span class="t-av">' + OG.esc(OG.initials(co)) + '</span>' +
      '<div class="t-main"><div class="t-title">' + OG.esc(co) + (person ? ' <span>· ' + OG.esc(person) + '</span>' : '') + '</div>' +
        (r.snippet ? '<div class="t-quote">“' + OG.esc(r.snippet) + '”</div>' : '') +
        '<div class="t-meta">Replied ' + OG.fmtRel(r.last) + (r.subject ? ' · ' + OG.esc(r.subject) : '') + '</div></div>' +
      '<div class="t-act"><a class="btn primary" data-stop target="_blank" rel="noopener" href="' + OG.gmailCompose(r) + '">' + OG.icon('reply') + '<span>Reply</span></a></div>' +
    '</div>';
  }

  function miniRow(r, tag) {
    var c = OG.companyOf(r), co = c.name || r.name || r.email;
    return '<div class="mini-row" data-open="' + OG.esc(r.id) + '"><span class="t-av waiting" style="width:28px;height:28px;border-radius:8px;font-size:11px">' +
      OG.esc(OG.initials(co)) + '</span><span class="t-main">' + OG.esc(co) + '</span><span class="mini-tag">' + tag + '</span></div>';
  }

  OG.pages.today = {
    title: 'Today',
    render: function (el) {
      var rows = OG.state.rows, m = OG.metrics(rows);
      var replies = rows.filter(function (r) { return r.stage === 'replied'; }).sort(function (a, b) { return (b.last || 0) - (a.last || 0); });
      var eod = endOfToday();
      var today = rows.map(function (r) { return { r: r, n: OG.nextFollowUp(r) }; })
        .filter(function (x) { return x.n && x.n.when <= eod; })
        .sort(function (a, b) { return a.n.when - b.n.when; });
      var inProgress = rows.filter(function (r) { return r.stage === 'waiting' || r.stage === 'followup'; }).length;

      // Recent activity: mail updates and your manual follow-ups, newest first.
      var byId = {}; rows.forEach(function (r) { byId[r.id] = r; });
      var events = rows.map(function (r) {
        var what = isReplied(r) ? 'replied' : OG.isBounced(r) ? 'email bounced' : r.stage === 'stopped' ? 'closed, no reply'
          : (r.fu ? 'follow-up ' + r.fu + ' sent' : 'email sent');
        return { at: r.last || r.first || 0, r: r, what: what };
      }).concat((OG.state.touches || []).filter(function (t) { return byId[t.cid]; }).map(function (t) {
        return { at: t.at, r: byId[t.cid], what: 'you followed up on ' + t.channel };
      })).sort(function (a, b) { return b.at - a.at; }).slice(0, 6);

      var name = firstName();
      var summary = replies.length || today.length
        ? [replies.length ? replies.length + ' repl' + (replies.length === 1 ? 'y' : 'ies') + ' to take forward' : '',
           today.length ? today.length + ' follow-up' + (today.length === 1 ? '' : 's') + ' going out automatically today' : ''].filter(Boolean).join(' · ')
        : 'Nothing needs you right now. Follow-ups are running automatically.';

      el.innerHTML =
        '<div class="today-head"><div><h1>' + greeting() + (name ? ', ' + OG.esc(name) : '') + '</h1><p>' + summary + '</p></div>' +
          '<a class="btn" href="#/leads">' + OG.icon('plus') + 'Add outreach</a></div>' +

        '<div class="kpis">' +
          '<a class="kpi" href="#/contacts"><div class="kpi-l">Emails sent</div><div class="kpi-v">' + m.tracked + '</div><div class="kpi-s">tracked outreach</div></a>' +
          '<a class="kpi" href="#/replies"><div class="kpi-l">Replies</div><div class="kpi-v">' + m.replies + '</div><div class="kpi-s">' + m.recentReplies + ' this week</div></a>' +
          '<div class="kpi"><div class="kpi-l">Reply rate</div><div class="kpi-v">' + m.rate + '%</div><div class="kpi-s">replies ÷ emails sent</div></div>' +
          '<a class="kpi" href="#/pipeline"><div class="kpi-l">In progress</div><div class="kpi-v">' + inProgress + '</div><div class="kpi-s">waiting for a reply</div></a>' +
        '</div>' +

        '<div class="t-grid"><div class="t-col">' +
          '<section class="panel-card"><div class="pc-head"><h2>Needs you: replies to take forward</h2>' + (replies.length > 5 ? '<a href="#/replies">See all ' + replies.length + '</a>' : '') + '</div>' +
            '<div class="pc-sub">They wrote back. Reply, or set up a call.</div><div class="pc-body">' +
            (replies.length ? replies.slice(0, 5).map(replyRow).join('')
              : '<div class="t-empty">' + OG.icon('replies') + 'You\'re all caught up. No replies are waiting for you.</div>') +
          '</div></section>' +
          '<section class="panel-card"><div class="pc-head"><h2>Recent activity</h2><a href="#/contacts">All contacts</a></div><div class="pc-body">' +
            (events.length ? events.map(function (e) {
              var c = OG.companyOf(e.r), co = c.name || e.r.name || e.r.email;
              return '<div class="mini-row" data-open="' + OG.esc(e.r.id) + '"><span class="t-main"><strong>' + OG.esc(co) + '</strong> <span class="muted">· ' + OG.esc(e.what) + '</span></span>' +
                '<span class="small muted nowrap">' + OG.fmtRel(e.at) + '</span></div>';
            }).join('') : '<div class="t-empty">No activity yet.</div>') +
          '</div></section>' +
        '</div><div class="t-col">' +
          '<section class="panel-card"><div class="pc-head"><h2>Going out today</h2><span class="mini-tag">automatic</span></div>' +
            '<div class="pc-sub">Follow-ups sent for you between 9:00 and 19:00.</div><div class="pc-body">' +
            (today.length ? today.slice(0, 6).map(function (x) { return miniRow(x.r, 'Follow-up ' + x.n.n + ' of ' + OG.MAX_FU); }).join('') +
              (today.length > 6 ? '<div class="small muted" style="padding-top:8px">+' + (today.length - 6) + ' more</div>' : '')
              : '<div class="t-empty">No follow-ups scheduled for today.</div>') +
          '</div></section>' +
          '<section class="panel-card"><div class="pc-head"><h2>Emails and replies per week</h2></div><div class="pc-body">' + OG.weeklyChart(OG.weekly(rows, 8)) + '</div></section>' +
        '</div></div>';
    }
  };
})();
