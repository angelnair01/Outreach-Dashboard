(function () {
  var OG = window.OG;
  OG.pages = OG.pages || {};

  OG.rowItem = function (r, sub, right) {
    return '<li><button class="row-btn" data-open="' + OG.esc(r.id) + '"><div class="row-main">' +
      '<div class="row-title">' + OG.esc(OG.displayName(r)) + '</div><div class="row-sub">' + sub + '</div></div>' +
      (right || '') + '</button></li>';
  };

  function stat(label, value, hint, href) {
    var tag = href ? 'a' : 'div';
    return '<' + tag + ' class="card stat"' + (href ? ' href="' + href + '"' : '') + '><span class="label">' + label +
      '</span><span class="value">' + value + '</span>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</' + tag + '>';
  }

  function group(title, items, link, empty) {
    return '<div class="attn-group"><div class="attn-head"><span>' + title + ' (' + items.length + ')</span>' +
      (link && items.length ? '<a href="' + link + '" class="small">See all</a>' : '') + '</div>' +
      (items.length ? '<ul class="list">' + items.slice(0, 4).join('') + '</ul>' : '<div class="empty">' + empty + '</div>') + '</div>';
  }

  OG.pages.overview = {
    title: 'Overview',
    render: function (el) {
      var rows = OG.state.rows, m = OG.metrics(rows);
      var since = Date.now() - 14 * OG.DAY;
      var newReplies = rows.filter(function (r) { return OG.CW ? r.stage === 'replied' : (OG.isReplied(r) && r.last >= since); })
        .sort(function (a, b) { return (b.last || 0) - (a.last || 0); })
        .map(function (r) { return OG.rowItem(r, OG.esc(r.snippet || r.subject), '<span class="small muted nowrap">' + OG.fmtRel(r.last) + '</span>'); });
      var due = rows.filter(function (r) { return r.due; })
        .map(function (r) { var n = OG.nextFollowUp(r); return OG.rowItem(r, OG.esc(r.subject), '<span class="pill st-due">Follow-up ' + (n ? n.n : (r.fu || 0) + 1) + '</span>'); });
      var bounced = rows.filter(OG.isBounced)
        .map(function (r) { return OG.rowItem(r, OG.esc(r.email) + ' · check the address', '<span class="pill st-bounced">Bounced</span>'); });
      // Recent activity: mail updates and your manual follow-ups (Email / LinkedIn / WhatsApp), newest first.
      var byId = {}; rows.forEach(function (r) { byId[r.id] = r; });
      var events = rows.map(function (r) { return { at: r.last || r.first || 0, r: r, sub: OG.esc(r.status) }; })
        .concat((OG.state.touches || []).filter(function (t) { return byId[t.cid]; }).map(function (t) {
          var m = OG.channelMeta(t.channel);
          return { at: t.at, r: byId[t.cid], sub: '<span class="ch-tag ' + m.cls + '">' + OG.icon(m.icon) + m.short + '</span> You followed up' + (t.note ? ': ' + OG.esc(t.note) : '') };
        }));
      var recent = events.sort(function (a, b) { return b.at - a.at; }).slice(0, 8)
        .map(function (e) { return OG.rowItem(e.r, e.sub, '<span class="small muted nowrap">' + OG.fmtRel(e.at) + '</span>'); });
      var weekAgo = Date.now() - 7 * OG.DAY, tw = { Email: 0, LinkedIn: 0, WhatsApp: 0 }, twTotal = 0;
      (OG.state.touches || []).forEach(function (t) { if (t.at >= weekAgo && tw[t.channel] !== undefined) { tw[t.channel]++; twTotal++; } });

      el.innerHTML =
        '<div class="page-head"><div><h1>Overview</h1><p class="muted">Everything at a glance. Click any contact to see the next step.</p></div>' +
          '<div class="btn-row"><button class="btn primary" data-add-lead="todo">+ Add a new contact</button><button class="btn" data-add-lead="done">+ Log outreach</button></div></div>' +
        '<div class="grid stats">' +
          stat('Mails tracked', m.tracked, 'in the Follow-up Log', '#/contacts') +
          stat('Waiting for reply', m.waiting, 'incl. follow-ups', '#/pipeline') +
          stat('Replies', m.replies, OG.CW ? m.newReplies + ' to decide on' : m.recentReplies + ' in the last 7 days', '#/replies') +
          stat('Reply rate', m.rate + '%', 'replies ÷ mails tracked') +
          (OG.CW ? stat('Calls / WhatsApp planned', m.planned, '', '#/pipeline') : '') +
          stat('Follow-ups due', m.due, 'sent automatically', '#/followups') +
          stat('Follow-ups sent this week', m.fuWeek, 'automatic emails, last 7 days') +
          stat('Manual follow-ups', twTotal, 'last 7 days · LinkedIn ' + tw.LinkedIn + ' · WhatsApp ' + tw.WhatsApp + ' · Email ' + tw.Email, '#/contacts') +
          stat('To contact', OG.state.leads.filter(function (l) { return l.status === 'To contact'; }).length, 'added by you', '#/leads') +
        '</div>' +
        '<div class="grid two-col">' +
          '<section class="card"><h2>Needs your attention</h2>' +
            (OG.CW ? group('New replies to decide on', newReplies, '#/replies', 'No new replies waiting for a decision.')
                   : group('Replies in the last 14 days', newReplies, '#/replies', 'No new replies in the last 14 days.')) +
            group('Follow-ups due', due, '#/followups', 'Nothing due right now.') +
            group('Bounced', bounced, '#/contacts', 'No bounced mails.') +
          '</section>' +
          '<section class="card"><h2>Mails sent and replies per week</h2>' + OG.weeklyChart(OG.weekly(rows, 8)) + '</section>' +
        '</div>' +
        '<section class="card"><h2>Recent activity</h2>' +
          (recent.length ? '<ul class="list">' + recent.join('') + '</ul>' : '<div class="empty">No activity yet.</div>') +
        '</section>';
      el.querySelectorAll('[data-add-lead]').forEach(function (b) { b.onclick = function () { OG.openLeadForm(b.getAttribute('data-add-lead')); }; });
    }
  };
})();
