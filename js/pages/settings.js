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

      el.innerHTML = '<div class="page-head"><div><h1>Settings</h1><p class="muted">Your account, sync and look.</p></div></div>' +
        '<div class="grid settings">' +
          '<section class="card"><h2>Connection</h2>' +
            '<p>' + status + '</p>' +
            (OG.isDemo() ? '<p class="muted">You are looking at <strong>sample data</strong>, not your sheet.</p>'
              : '<p class="muted">Signed in as <strong>' + OG.esc(OG.userEmail()) + '</strong></p>') +
            '<p class="muted">Last sync: ' + (S.lastSync ? OG.fmtDateTime(S.lastSync) + ' (' + OG.fmtRel(S.lastSync) + ')' : 'never') + '<br>' +
            OG.state.rows.length + ' rows loaded</p>' +
            '<div class="btn-row"><button class="btn" id="s-refresh">' + OG.icon('refresh') + 'Refresh now</button>' +
            '<button class="btn" id="s-signout">Sign out</button></div>' +
            '<p class="small muted" style="margin-top:10px">Sign out removes your sign-in and the saved copy of the data from this browser. Phone numbers and notes you typed stay.</p>' +
          '</section>' +
          '<section class="card"><h2>Theme</h2><div class="seg">' +
            seg('theme', 'light', theme, 'Light') + seg('theme', 'dark', theme, 'Dark') + seg('theme', 'system', theme, 'System') + '</div>' +
          '</section>' +
          '<section class="card"><h2>Live sync</h2>' +
            '<p><span class="pill st-replied">Live</span> While this page is open it checks your sheet every ' + OG.LIVE_SECONDS + ' seconds, and right away when you come back to the tab.</p>' +
            '<p class="small muted">New mails, replies and follow-ups reach the sheet when your sheet script runs (set its trigger to every 5 minutes for near real time). They then show here within about ' + OG.LIVE_SECONDS + ' seconds.</p>' +
          '</section>' +
          '<section class="card"><h2>Who can open this dashboard</h2>' +
            '<p>Only Google accounts listed in the <strong>Dashboard Access</strong> tab of the master sheet (one Gmail per row in column A), plus the sheet owner.</p>' +
            '<p class="muted">Everyone sees <strong>only their own</strong> outreach: mails from their Gmail (the "Sent by" column of the Follow-up Log) and contacts they added. To give someone access, add their Gmail there; to remove them, delete the row.</p>' +
          '</section>' +
          '<section class="card"><h2>Tracking another Gmail account</h2>' +
            '<p>To track a partner\'s outreach too (for example Sebin): add their Gmail in the <strong>Accounts</strong> tab (Active), and have them switch on the hourly sheet script for their own Gmail.</p>' +
            '<p class="muted">Their mails then appear here automatically. Nothing needs to change on this website.</p>' +
          '</section>' +
        '</div>';

      el.querySelector('#s-refresh').onclick = function () { OG.refresh(); };
      el.querySelector('#s-signout').onclick = function () { if (confirm('Sign out of the dashboard on this browser?')) OG.signOut(); };
      el.querySelectorAll('[data-theme]').forEach(function (b) {
        b.onclick = function () { var t = b.getAttribute('data-theme'); OG.store.set('og.theme', t); OG.applyTheme(t); OG.pages.settings.render(el); };
      });
    }
  };
})();
