/* Start-up, sign-in, page routing (#/overview etc.) and click handling. */
(function () {
  var OG = window.OG, S = OG.state;
  var NAV = [
    { key: 'overview', label: 'Overview', icon: 'overview' },
    { key: 'pipeline', label: 'Pipeline', icon: 'pipeline' },
    { key: 'replies', label: 'Replies', icon: 'replies' },
    { key: 'followups', label: 'Follow-ups', icon: 'followups' },
    { key: 'contacts', label: 'Contacts', icon: 'contacts' },
    { key: 'leads', label: 'Add & log', icon: 'plus' },
    { key: 'settings', label: 'Settings', icon: 'settings' }
  ];
  var $ = function (id) { return document.getElementById(id); };
  var current = null, signingIn = false;

  function route() {
    var k = (location.hash.match(/^#\/(\w+)/) || [])[1];
    return OG.pages[k] ? k : 'overview';
  }

  /* ---------- sign-in screen ---------- */
  function showSignin() {
    $('app').hidden = true; $('signin').hidden = false;
    var msg = OG._signOutMsg; OG._signOutMsg = '';
    $('signin').innerHTML = '<div class="card"><div class="brand" style="padding:0"><span class="brand-mark"></span>' + OG.esc((window.APP_CONFIG || {}).APP_NAME || 'Outreach') + '</div>' +
      '<p class="muted" style="margin-top:12px">Type your private token to open the dashboard. This browser will remember it, so you only do this once.</p>' +
      '<form id="si-form"><div class="field"><label for="si-token">Token</label>' +
      '<input class="input" id="si-token" type="password" autocomplete="current-password" required spellcheck="false"></div>' +
      '<label class="small muted"><input type="checkbox" id="si-show"> Show token</label>' +
      '<div class="error" id="si-err" role="alert">' + OG.esc(msg) + '</div>' +
      '<button class="btn primary" type="submit" id="si-go">Open dashboard</button></form>' +
      '<p class="small muted" style="margin-top:16px">Just looking? <a href="#" id="si-demo">Try it with sample data</a></p></div>';
    $('si-show').onchange = function () { $('si-token').type = this.checked ? 'text' : 'password'; };
    $('si-form').onsubmit = function (e) {
      e.preventDefault();
      var t = $('si-token').value.trim(); if (!t) return;
      $('si-go').disabled = true; $('si-go').textContent = 'Checking…'; $('si-err').textContent = '';
      signingIn = true;
      OG.signIn(t).then(function () { signingIn = false; showApp(); }, function (err) {
        signingIn = false;
        $('si-go').disabled = false; $('si-go').textContent = 'Open dashboard';
        $('si-err').textContent = err.message + (err.code === 'unauthorized' ? ' Check for typos or extra spaces.' : '');
      });
    };
    $('si-demo').onclick = function (e) {
      e.preventDefault(); signingIn = true;
      OG.signIn(OG.DEMO_TOKEN).then(function () { signingIn = false; showApp(); });
    };
    setTimeout(function () { $('si-token').focus(); }, 30);
  }

  /* ---------- main app ---------- */
  function showApp() {
    $('signin').hidden = true; $('app').hidden = false;
    render(true);
  }

  function renderNav() {
    var k = route(), m = OG.metrics(S.rows);
    $('nav').innerHTML = NAV.map(function (n) {
      var nb = OG.CW ? m.newReplies : m.recentReplies;
      var badge = n.key === 'replies' && nb ? '<span class="badge" aria-label="' + nb + (OG.CW ? ' to decide' : ' new this week') + '">' + nb + '</span>' : '';
      return '<li><a href="#/' + n.key + '"' + (n.key === k ? ' aria-current="page"' : '') + '>' + OG.icon(n.icon) + '<span>' + n.label + '</span>' + badge + '</a></li>';
    }).join('');
    var dot = S.error ? 'err' : S.loading ? 'busy' : '';
    $('sync-status').innerHTML = '<span class="dot ' + dot + '"></span>' +
      (S.error ? 'Sync problem: see Settings' : S.loading ? 'Syncing…' : S.lastSync ? 'Updated ' + OG.fmtRel(S.lastSync) : 'Not synced yet') +
      (OG.isDemo() ? '<br>Sample data' : '');
  }

  function render(pageChanged) {
    if (signingIn) return;
    if (!S.token) { if ($('signin').hidden) { OG.closePanel(); showSignin(); } return; }
    if ($('app').hidden) { showApp(); return; }
    renderNav();
    var k = route(), page = OG.pages[k], main = $('main');
    document.title = page.title + ' · Outreach Dashboard';
    if (pageChanged || current !== k) {
      current = k;
      main.innerHTML = '<div id="banner"></div><div id="page"></div>';
      page.render($('page'));
      main.focus({ preventScroll: true }); window.scrollTo(0, 0);
    } else if (page.update) {
      page.update($('page'));
    } else if (!main.contains(document.activeElement) || document.activeElement === main) {
      var y = window.scrollY; page.render($('page')); window.scrollTo(0, y);
    }
    $('banner').innerHTML = OG.isDemo() ? '<div class="demo-banner">You are viewing <strong>made-up sample data</strong>. Sign out in Settings to use your real token.</div>'
      : (S.error ? '<div class="demo-banner">⚠️ ' + OG.esc(S.error) + ' Showing the last data we received.</div>' : '');
    OG.refreshPanel();
  }

  /* ---------- clicks anywhere ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-stop]')) return; // links inside clickable rows
    var m = t.closest('[data-mark]');
    if (m) { e.preventDefault(); OG.mark(m.getAttribute('data-id'), m.getAttribute('data-mark')); return; }
    var o = t.closest('[data-open]');
    if (o) { e.preventDefault(); OG.openPanel(o.getAttribute('data-open')); }
  });
  $('scrim').addEventListener('click', OG.closePanel);
  window.addEventListener('hashchange', function () { OG.closePanel(); render(true); });

  OG.onChange(function () { render(false); });
  setInterval(function () { if (S.token) renderNav(); }, 30000); // keep "Updated x min ago" fresh

  /* ---------- start ---------- */
  OG.applyTheme(OG.store.get('og.theme', 'system'));
  $('brand-name').textContent = (window.APP_CONFIG || {}).APP_NAME || 'Outreach';
  if (S.token) {
    OG.loadCache(); showApp(); OG.refresh(); OG.startPolling();
  } else {
    showSignin();
  }
})();
