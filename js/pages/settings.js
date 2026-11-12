(function () {
  var OG = window.OG;

  OG.applyTheme = function (t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  };

  OG.pages.settings = {
    title: 'Settings',
    render: function (el) {
      var S = OG.state, theme = OG.store.get('og.theme', 'system');
      var seg = function (attr, val, cur, label) { return '<button data-' + attr + '="' + val + '" aria-pressed="' + (String(val) === String(cur)) + '">' + label + '</button>'; };
      var status = S.error ? '<span class="pill st-bounced">Problem</span> <span class="error">' + OG.esc(S.error) + '</span>'
        : S.loading ? '<span class="pill st-waiting">Syncing…</span>'
        : '<span class="pill st-replied">Connected</span>';

      el.innerHTML = '<div class="page-head"><div><h1>Settings</h1><p class="muted">Connection, look and refresh.</p></div></div>' +
        '<div class="grid settings">' +
          '<section class="card"><h2>Connection</h2>' +
            '<p>' + status + '</p>' +
            (OG.isDemo() ? '<p class="muted">You are looking at <strong>sample data</strong>, not your sheet.</p>' : '') +
            '<p class="muted">Last sync: ' + (S.lastSync ? OG.fmtDateTime(S.lastSync) + ' (' + OG.fmtRel(S.lastSync) + ')' : 'never') + '<br>' +
            OG.state.rows.length + ' rows loaded</p>' +
            '<div class="btn-row"><button class="btn" id="s-refresh">' + OG.icon('refresh') + 'Refresh now</button>' +
            '<button class="btn" id="s-signout">Sign out</button></div>' +
            '<p class="small muted" style="margin-top:10px">Sign out removes your token and the saved copy of the data from this browser. Phone numbers and notes you typed stay.</p>' +
          '</section>' +
          '<section class="card"><h2>Theme</h2><div class="seg">' +
            seg('theme', 'light', theme, 'Light') + seg('theme', 'dark', theme, 'Dark') + seg('theme', 'system', theme, 'System') + '</div>' +
            '<h2 style="margin-top:20px">Refresh every</h2><div class="seg">' +
            seg('int', 1, S.interval, '1 min') + seg('int', 2, S.interval, '2 min') + seg('int', 5, S.interval, '5 min') + seg('int', 15, S.interval, '15 min') + seg('int', 0, S.interval, 'Off') + '</div>' +
            '<p class="small muted" style="margin-top:10px">The website re-reads your sheet this often while it is open. Your sheet script itself runs once an hour, so new follow-ups and replies appear within about an hour.</p>' +
          '</section>' +
          '<section class="card"><h2>Adding another Gmail account</h2>' +
            '<p>To track a partner\'s outreach too (for example Sebin), open your master Google Sheet, go to the <strong>Accounts</strong> tab and add a row with their Gmail address, name, and <em>Active</em>.</p>' +
            '<p class="muted">Their mails then appear here automatically. Nothing needs to change on this website.</p>' +
          '</section>' +
        '</div>';

      el.querySelector('#s-refresh').onclick = function () { OG.refresh(); };
      el.querySelector('#s-signout').onclick = function () { if (confirm('Sign out of the dashboard on this browser?')) OG.signOut(); };
      el.querySelectorAll('[data-theme]').forEach(function (b) {
        b.onclick = function () { var t = b.getAttribute('data-theme'); OG.store.set('og.theme', t); OG.applyTheme(t); OG.pages.settings.render(el); };
      });
      el.querySelectorAll('[data-int]').forEach(function (b) {
        b.onclick = function () { OG.setInterval(+b.getAttribute('data-int')); OG.pages.settings.render(el); };
      });
    }
  };
})();
