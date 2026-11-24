/* Start-up, sign-in, page routing (#/overview etc.) and click handling. */
(function () {
  var OG = window.OG, S = OG.state;
  var NAV = [
    { key: 'today', label: 'Today', icon: 'overview' },
    { key: 'pipeline', label: 'Pipeline', icon: 'pipeline' },
    { key: 'replies', label: 'Replies', icon: 'replies' },
    { key: 'contacts', label: 'Contacts', icon: 'contacts' },
    { key: 'leads', label: 'Add outreach', short: 'Add', icon: 'plus' },
    { key: 'settings', label: 'Settings', icon: 'settings' }
  ];
  var $ = function (id) { return document.getElementById(id); };
  var current = null, signingIn = false;

  function route() {
    var k = (location.hash.match(/^#\/(\w+)/) || [])[1];
    if (k === 'overview') k = 'today'; // old links
    return OG.pages[k] ? k : 'today';
  }

  /* ---------- sign-in screen ---------- */
  function showSignin() {
    $('app').hidden = true; $('signin').hidden = false;
    var msg = OG._signOutMsg; OG._signOutMsg = '';
    // Sample data is only offered when the address ends in ?demo (for showing the dashboard to others).
    var demo = /[?&]demo\b/.test(location.search);
    $('signin').innerHTML = '<div class="signin-card">' +
      '<div class="signin-logo">' + OG.icon('send') + '</div>' +
      '<h1>' + OG.esc((window.APP_CONFIG || {}).APP_NAME || 'Outreach') + '</h1>' +
      '<p class="muted">Track your outreach emails, replies and follow-ups in one place. Sign in with the Gmail you send outreach from.</p>' +
      '<div id="si-google" class="si-google"></div>' +
      '<div class="small muted" id="si-status" aria-live="polite"></div>' +
      '<div class="error" id="si-err" role="alert">' + OG.esc(msg) + '</div>' +
      '<p class="signin-foot small muted">' + (demo ? '<a href="#" data-sample="46">View sample data</a> · <a href="#" data-sample="300">300</a> · <a href="#" data-sample="700">700 mails</a> · ' : '') +
      'Only you can see your own outreach. <a href="privacy.html">Privacy</a></p></div>';

    $('signin').querySelectorAll('[data-sample]').forEach(function (a) {
      a.onclick = function (e) {
        e.preventDefault(); signingIn = true;
        OG.store.set('og.sample', Number(a.getAttribute('data-sample'))); OG._demo = null;
        try { google.accounts.id.cancel(); } catch (x) {} // stop Google's automatic sign-in from taking over sample mode
        OG.signIn(OG.DEMO_TOKEN).then(function () { signingIn = false; showApp(); });
      };
    });

    if (!OG.auth.configured()) {
      $('si-err').textContent = 'Google sign-in is not set up yet (GOOGLE_CLIENT_ID in config.js).';
      return;
    }
    OG.auth.init(function (credential) {
      if (signingIn || OG.isDemo()) return; // ignore a late automatic sign-in while viewing sample data
      signingIn = true;
      $('si-err').textContent = ''; $('si-status').textContent = 'Checking access…';
      OG.signIn(credential).then(function () { signingIn = false; showApp(); }, function (err) {
        signingIn = false; $('si-status').textContent = '';
        $('si-err').textContent = err.message;
        OG.auth.signOut();
      });
    }).then(function () {
      OG.auth.renderButton($('si-google'));
      if (!msg && !demo) { try { google.accounts.id.prompt(); } catch (e) {} } // returning users: signs in by itself (not on ?demo)
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
      return '<li><a href="#/' + n.key + '"' + (n.short ? ' class="has-short"' : '') + (n.key === k ? ' aria-current="page"' : '') + '>' + OG.icon(n.icon) + '<span class="nl">' + n.label + '</span>' + (n.short ? '<span class="ns">' + n.short + '</span>' : '') + badge + '</a></li>';
    }).join('');
    // Top bar: today's date on the left, Gmail sync status + Sync on the right.
    var d = new Date();
    $('topbar').innerHTML = '<span class="tb-date">' + d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '</span>' +
      '<span class="tb-right">' + OG.gmail.topHtml() + '</span>';
    // Sidebar footer: who is signed in, and Sign out.
    var p = OG.isDemo() ? { name: 'Sample data', email: 'demo' } : (OG.auth.decode(S.token) || {});
    var name = p.name || p.email || '';
    $('side-user').innerHTML = (p.picture ? '<img class="su-pic" src="' + OG.esc(p.picture) + '" alt="" referrerpolicy="no-referrer">'
        : '<span class="su-pic su-ini">' + OG.esc(OG.initials(name || '?')) + '</span>') +
      '<span class="su-text"><span class="su-name">' + OG.esc(name) + '</span><span class="su-mail">' + OG.esc(p.email && p.email !== 'demo' ? p.email : '') + '</span></span>' +
      '<button class="btn ghost su-out" data-signout title="Sign out" aria-label="Sign out">' + OG.icon('logout') + '</button>';
    renderBanner();
  }

  function render(pageChanged) {
    if (signingIn) return;
    if (!S.token) { if ($('signin').hidden) { OG.closePanel(); showSignin(); } return; }
    if ($('app').hidden) { showApp(); return; }
    renderNav();
    var k = route(), page = OG.pages[k], main = $('main');
    document.title = page.title + ' · OpenGrad Outreach';
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
    renderBanner();
    OG.refreshPanel();
  }

  // Top strip on every page: Gmail status + Sync button (and sample-data / error notes).
  function renderBanner() {
    var b = $('banner'); if (!b) return;
    b.innerHTML = (OG.isDemo() ? '<div class="notice notice-muted"><div>You\'re viewing <strong>sample data</strong>, not real emails.</div></div>'
      : (S.error ? '<div class="notice notice-warn"><div>' + OG.esc(S.error) + ' Showing the last data we received.</div></div>' : '')) + OG.gmail.bannerHtml();
  }

  /* ---------- clicks anywhere ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-stop]')) return; // links inside clickable rows
    if (t.closest('[data-signout]')) { if (confirm('Sign out of the dashboard on this browser?')) OG.signOut(); return; }
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
