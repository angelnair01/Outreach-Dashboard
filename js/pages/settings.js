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
          '<section class="card"><h2>Your Gmail</h2>' +
            (!OG.isDemo() && !OG.state.account ? '<p class="muted">Checking your Gmail connection…</p>' : OG.gmail.connected()
              ? (function () {
                  var st = OG.gmail.status();
                  if (st.state === 'ok') return '<p><span class="pill st-replied">Auto-sync on</span> Your mails labelled <strong>Outreach</strong> are checked every minute (last: ' + OG.fmtRel(st.last) + ').</p>';
                  return '<p><span class="pill st-due">Needs attention</span> ' + (st.state === 'error' ? 'The last automatic check failed: ' + OG.esc(st.error) : 'The every-minute check has not run since ' + (st.last ? OG.fmtRel(st.last) : 'connecting') + '.') +
                    ' Click <strong>Manage</strong> to switch it back on.</p>';
                })() +
                '<div class="btn-row"><button class="btn" data-gmail="sync">' + OG.icon('refresh') + 'Sync now</button>' +
                '<button class="btn ghost" data-gmail="connect">Manage / disconnect</button></div>'
              : '<p><span class="pill st-stopped">Not connected</span> Connect once so your outreach shows up here.</p>' +
                '<button class="btn primary" data-gmail="connect">' + OG.icon('mail') + 'Connect my Gmail</button>') +
            '<p class="small muted" style="margin-top:10px">Connecting gives the Outreach Sync script permission to read your Outreach mails and send your follow-ups. Your data is only shown to you.</p>' +
          '</section>' +
          '<section class="card"><h2>Live sync</h2>' +
            '<p><span class="pill st-replied">Live</span> Your Gmail is checked every minute, and this page refreshes every ' + OG.LIVE_SECONDS + ' seconds. New mails usually show within about a minute.</p>' +
            '<p class="small muted">In a hurry? Click <strong>Sync</strong> (top right of every page) and new mails or replies show within about 10 seconds.</p>' +
          '</section>' +
          '<section class="card"><h2>Who sees what</h2>' +
            '<p>Anyone can sign in with their own Gmail. Each person sees <strong>only their own</strong> outreach: mails from their Gmail and contacts they added here.</p>' +
            '<p class="muted">Everything is stored in one master sheet; only the sheet owner can open it.</p>' +
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
