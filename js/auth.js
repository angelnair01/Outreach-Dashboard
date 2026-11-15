/* "Sign in with Google" using Google Identity Services.
   Google gives the browser a short-lived signed ticket (an ID token, valid about 1 hour).
   The website sends it to the Apps Script API, which checks it with Google and checks the
   email against the "Dashboard Access" tab. Nothing secret is stored in this website. */
(function () {
  var OG = window.OG;
  var CLIENT_ID = (window.APP_CONFIG || {}).GOOGLE_CLIENT_ID || '';
  var inited = false, onSignIn = null, pending = null;

  function b64json(part) {
    var s = part.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function waitForGoogle(ms) {
    return new Promise(function (ok, fail) {
      var t0 = Date.now();
      (function poll() {
        if (window.google && google.accounts && google.accounts.id) return ok();
        if (Date.now() - t0 > ms) return fail(new Error('Could not load Google sign-in. Check your internet connection, or turn off blockers for accounts.google.com.'));
        setTimeout(poll, 100);
      })();
    });
  }

  function handle(resp) {
    var cred = resp && resp.credential;
    if (!cred) return;
    if (pending) { var p = pending; pending = null; p.ok(cred); return; }
    if (onSignIn) onSignIn(cred);
  }

  OG.auth = {
    configured: function () { return /apps\.googleusercontent\.com$/.test(CLIENT_ID); },

    /* payload of a Google ID token: { email, name, picture, exp, ... } */
    decode: function (jwt) {
      try { return b64json(String(jwt).split('.')[1]); } catch (e) { return null; }
    },
    secondsLeft: function (jwt) {
      var p = OG.auth.decode(jwt);
      return p && p.exp ? p.exp - Math.floor(Date.now() / 1000) : -1;
    },

    init: function (cb) {
      onSignIn = cb;
      return waitForGoogle(10000).then(function () {
        if (!inited) {
          google.accounts.id.initialize({
            client_id: CLIENT_ID, callback: handle, auto_select: true,
            use_fedcm_for_prompt: true, itp_support: true, cancel_on_tap_outside: false
          });
          inited = true;
        }
      });
    },

    renderButton: function (el) {
      google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', width: 280 });
    },

    /* Get a fresh ticket without clicking (works after the first sign-in on this browser). */
    renew: function () {
      return OG.auth.init(onSignIn).then(function () {
        return new Promise(function (ok, fail) {
          var timer = setTimeout(function () { pending = null; fail(new Error('Please sign in again.')); }, 15000);
          pending = { ok: function (c) { clearTimeout(timer); ok(c); } };
          try {
            google.accounts.id.prompt(function (n) {
              if (n && ((n.isNotDisplayed && n.isNotDisplayed()) || (n.isSkippedMoment && n.isSkippedMoment()))) {
                clearTimeout(timer); pending = null; fail(new Error('Please sign in again.'));
              }
            });
          } catch (e) { clearTimeout(timer); pending = null; fail(e); }
        });
      });
    },

    signOut: function () {
      try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
    }
  };
})();
