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
      '<p class="muted" style="margin-top:12px">Sign in with your Gmail to see your own outreach, replies and follow-ups.</p>' +
      '<div id="si-google" style="margin:18px 0 6px;min-height:44px"></div>' +
      '<div class="small muted" id="si-status" aria-live="polite"></div>' +
      '<div class="error" id="si-err" role="alert">' + OG.esc(msg) + '</div>' +
      '<p class="small muted" style="margin-top:16px">Just looking? <a href="#" id="si-demo">Try it with sample data</a> · <a href="privacy.html">Privacy</a></p></div>';

    $('si-demo').onclick = function (e) {
      e.preventDefault(); signingIn = true;
      OG.signIn(OG.DEMO_TOKEN).then(function () { signingIn = false; showApp(); });
    };

    if (!OG.auth.configured()) {
      $('si-err').textContent = 'Google sign-in is not set up yet (GOOGLE_CLIENT_ID in config.js).';
      return;
    }
    OG.auth.init(function (credential) {
      if (signingIn) return;
      signingIn = true;
      $('si-err').textContent = ''; $('si-status').textContent = 'Checking access…';
      OG.signIn(credential).then(function () { signingIn = false; showApp(); }, function (err) {
        signingIn = false; $('si-status').textContent = '';
        $('si-err').textContent = err.message;
        OG.auth.signOut();
      });
    }).then(function () {
      OG.auth.renderButton($('si-google'));
      if (!msg) { try { google.accounts.id.prompt(); } catch (e) {} } // returning users: signs in by itself
    }, function (e) { $('si-err').textContent = e.message; });
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
      (S.error ? 'Sync problem: see Settings' : S.loading ? 'Syncing…' : S.lastSync ? 'Live · updated ' + OG.fmtRel(S.lastSync) : 'Not synced yet') +
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

  OG.onChange(function (info) {
    if (info && info.navOnly) { if (S.token && !$('app').hidden) renderNav(); return; }
    render(false);
  });
  setInterval(function () { if (S.token && !$('app').hidden) renderNav(); }, 15000); // keep "updated x ago" fresh

  /* ---------- start ---------- */
  OG.applyTheme(OG.store.get('og.theme', 'system'));
  $('brand-name').textContent = (window.APP_CONFIG || {}).APP_NAME || 'Outreach';
  // Old-style tokens from before Google sign-in are dropped.
  if (S.token && !OG.isDemo() && !OG.auth.decode(S.token)) OG.signOut(true);
  if (S.token) {
    OG.loadCache(); showApp(); OG.refresh(); OG.startPolling();
  } else {
    showSignin();
  }
})();
