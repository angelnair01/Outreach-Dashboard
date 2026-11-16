/* Gmail connection + the Sync button.
   Both open the "Outreach Sync" web app in a small window. It runs as the signed-in person
   (with the Gmail permission they gave once), checks their Gmail and writes to the master sheet.
   The dashboard then reloads. Browsers only allow such a window after a click, so these are buttons. */
(function () {
  var OG = window.OG, S = OG.state;
  var URL_ = (window.APP_CONFIG || {}).SYNC_URL || '';
  var busy = null;

  function configured() { return /^https:\/\/script\.google\.com\/.+\/exec$/.test(URL_); }

  function openWin(action, w, h) {
    var left = Math.max(0, (screen.width - w) / 2), top = Math.max(0, (screen.height - h) / 3);
    return window.open(URL_ + '?a=' + action, 'og-' + action, 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top);
  }

  /* Wait until the API says this person's Gmail was checked after `since` (works even if the
     small window cannot message us back). */
  function waitFor(test, win, timeoutMs) {
    return new Promise(function (ok, fail) {
      var t0 = Date.now(), done = false;
      function finish(err) {
        if (done) return; done = true;
        clearInterval(poll); window.removeEventListener('message', onMsg);
        try { if (win && !win.closed) win.close(); } catch (e) {}
        err ? fail(err) : ok();
      }
      function check() {
        OG.refresh({ quiet: true }).then(function () { if (test()) finish(); });
        if (Date.now() - t0 > timeoutMs) finish(new Error('timeout'));
      }
      function onMsg(e) {
        var d = e.data || {};
        if (d.source !== 'outreach-sync') return;
        if (d.type === 'error') return finish(new Error(d.message || 'Sync failed'));
        if (d.type === 'synced' || d.type === 'connected') check();
      }
      window.addEventListener('message', onMsg);
      var poll = setInterval(check, 2000);
    });
  }

  OG.gmail = {
    connected: function () { return OG.isDemo() || !!(S.account && S.account.connected); },
    lastChecked: function () { return S.account && S.account.lastSync || 0; },
    busy: function () { return !!busy; },

    sync: function () {
      if (busy) return busy;
      if (OG.isDemo()) {
        busy = new Promise(function (ok) { setTimeout(ok, 1200); }).then(function () {
          OG._demoSync = Date.now(); busy = null; OG.refresh({ quiet: true }); OG.toast('Gmail checked (sample data).');
        });
        OG.emit({ navOnly: true });
        return busy;
      }
      if (!configured()) { OG.toast('The Sync button is not set up yet (SYNC_URL in config.js).'); return Promise.resolve(); }
      if (!OG.gmail.connected()) { OG.gmail.connect(); return Promise.resolve(); }
      var since = Date.now() - 1000;
      var win = openWin('sync', 420, 300);
      if (!win) { OG.toast('Your browser blocked the Sync window. Allow pop-ups for this site, then click Sync again.'); return Promise.resolve(); }
      busy = waitFor(function () { return OG.gmail.lastChecked() >= since; }, win, 60000).then(function () {
        OG.toast('Synced with your Gmail.');
      }, function (e) {
        OG.toast(e.message === 'timeout' ? 'Gmail check is taking long. It will show up within a minute anyway.' : 'Sync problem: ' + e.message);
      }).then(function () { busy = null; OG.emit({ navOnly: true }); });
      OG.emit({ navOnly: true });
      return busy;
    },

    connect: function () {
      if (!configured()) { OG.toast('Gmail connection is not set up yet (SYNC_URL in config.js).'); return; }
      var win = openWin('connect', 480, 640);
      if (!win) { OG.toast('Your browser blocked the window. Allow pop-ups for this site, then try again.'); return; }
      busy = waitFor(function () { return OG.gmail.connected() && OG.gmail.lastChecked() > 0; }, win, 300000).then(function () {
        OG.toast('Your Gmail is connected. Your outreach now updates by itself.');
      }, function () {}).then(function () { busy = null; OG.emit({}); });
      OG.emit({ navOnly: true });
    },

    /* Strip shown at the top of every page */
    barHtml: function () {
      if (!OG.isDemo() && S.account && !S.account.connected) {
        return '<div class="gmail-bar warn"><div><strong>Connect your Gmail</strong> to see your outreach here. ' +
          'One time only: click, then Allow. Your mails stay private to you.</div>' +
          '<button class="btn primary" data-gmail="connect">' + OG.icon('mail') + 'Connect my Gmail</button></div>';
      }
      var st = OG.gmail.status();
      var syncBtn = '<button class="btn" data-gmail="sync"' + (busy ? ' disabled' : '') + ' title="Check my Gmail now">' + OG.icon('refresh') + (busy ? 'Syncing…' : 'Sync') + '</button>';
      var fixBtn = '<button class="btn primary" data-gmail="connect">Fix</button>';
      if (busy) return '<div class="gmail-bar"><span class="sync-state"><span class="live-dot busy"></span><span>Checking your Gmail…</span></span>' + syncBtn + '</div>';
      if (st.state === 'loading') return '<div class="gmail-bar"><span class="sync-state"><span class="live-dot busy"></span><span>Connecting…</span></span>' + syncBtn + '</div>';
      if (st.state === 'error') {
        return '<div class="gmail-bar alert"><span class="sync-state"><span class="live-dot err"></span><span>Auto-sync problem: ' + OG.esc(st.error) + '</span>' +
          '</span>' + fixBtn + syncBtn + '</div>';
      }
      if (st.state === 'stale') {
        return '<div class="gmail-bar alert"><span class="sync-state"><span class="live-dot warn"></span><span>Auto-sync isn\'t running. Last Gmail check <span data-ago="' + st.last + '">' + agoText(st.last) + '</span>.</span>' +
          '</span>' + fixBtn + syncBtn + '</div>';
      }
      return '<div class="gmail-bar"><span class="sync-state" title="Your Gmail is checked automatically every minute"><span class="live-dot"></span><span>Auto-sync on' +
        (st.last ? ' · checked <span data-ago="' + st.last + '">' + agoText(st.last) + '</span>' : '') + '</span></span>' + syncBtn + '</div>';
    },

    /* ok = checked within the last 5 minutes (the timer runs every minute) */
    status: function () {
      if (OG.isDemo()) return { state: 'ok', last: OG.gmail.lastChecked() };
      if (!S.account) return { state: 'loading', last: 0 }; // nothing from Google yet: never warn before we know
      var a = S.account, last = a.lastSync || 0, err = a.lastError;
      if (err && err.at >= last) return { state: 'error', last: last, error: err.msg || 'unknown error' };
      if (!last || Date.now() - last > STALE_MS) return { state: 'stale', last: last };
      return { state: 'ok', last: last };
    }
  };

  var STALE_MS = 5 * 60000; // Google's every-minute timer can run a few minutes late; only warn after 5
  function agoText(ms) {
    if (!ms) return 'never';
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 10) return 'just now';
    if (s < 60) return s + ' s ago';
    return OG.fmtRel(ms);
  }
  // Keep the "checked 25 s ago" text ticking, and flip to the warning as soon as it goes stale.
  var lastState = '';
  setInterval(function () {
    document.querySelectorAll('[data-ago]').forEach(function (el) { el.textContent = agoText(Number(el.getAttribute('data-ago'))); });
    if (!S.token || OG.isDemo()) return;
    var now = OG.gmail.status().state;
    if (lastState && now !== lastState) OG.emit({ navOnly: true });
    lastState = now;
  }, 5000);

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-gmail]');
    if (!b) return;
    e.preventDefault();
    if (b.getAttribute('data-gmail') === 'connect') OG.gmail.connect(); else OG.gmail.sync();
  });
})();
