/* App state, auto-refresh, and the numbers shown on the Overview. */
(function () {
  var OG = window.OG;
  var listeners = [];
  var timer = null;

  var S = (OG.state = {
    token: OG.store.get('og.token', ''),
    rows: [],
    leads: [],
    lastSync: 0,
    loading: false,
    error: '',
    interval: OG.store.get('og.interval', 2) // minutes; 0 = manual only
  });

  OG.isDemo = function () { return S.token === OG.DEMO_TOKEN; };
  OG.onChange = function (fn) { listeners.push(fn); };
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }
  OG.emit = emit;

  /* With Call / WhatsApp switched off, any old "call"/"whatsapp" mark just counts as Replied. */
  function normalize(rows) {
    if (!OG.CW) rows.forEach(function (r) { if (r.stage === 'call' || r.stage === 'whatsapp') r.stage = OG.baseStage(r); });
    return rows;
  }

  OG.byId = function (id) { return S.rows.find(function (r) { return r.id === id; }); };

  /* Load cached rows so the page shows something instantly while it refreshes. */
  OG.loadCache = function () {
    if (!S.token || OG.isDemo()) return;
    var c = OG.store.get('og.cache', null);
    if (c && Array.isArray(c.rows)) { S.rows = normalize(c.rows); S.leads = c.leads || []; S.lastSync = c.at || 0; }
  };

  OG.refresh = function (opts) {
    if (!S.token) return Promise.resolve();
    if (S.loading) return S.loading;
    S.error = '';
    emit();
    S.loading = OG.api.fetchAll(S.token).then(function (d) {
      var rows = d.rows; S.leads = d.leads;
      S.rows = normalize(rows); S.lastSync = Date.now(); S.error = '';
      if (!OG.isDemo()) OG.store.set('og.cache', { rows: rows, leads: d.leads, at: S.lastSync });
    }, function (e) {
      S.error = e.message || String(e);
      if (e.code === 'unauthorized') OG.signOut(true, S.error);
      if (opts && opts.throwErrors) throw e;
    }).finally(function () { S.loading = false; emit(); });
    emit();
    return S.loading;
  };

  OG.setInterval = function (min) {
    S.interval = min; OG.store.set('og.interval', min); OG.startPolling();
  };
  OG.startPolling = function () {
    clearInterval(timer);
    if (S.interval > 0) timer = setInterval(function () { if (!document.hidden) OG.refresh(); }, S.interval * 60000);
  };
  document.addEventListener('visibilitychange', function () {
    // Coming back to the tab after a while: refresh right away.
    if (!document.hidden && S.token && Date.now() - S.lastSync > 60000) OG.refresh();
  });

  OG.signIn = function (token) {
    S.token = token;
    return OG.refresh({ throwErrors: true }).then(function () {
      OG.store.set('og.token', token); OG.startPolling();
    }, function (e) { S.token = ''; throw e; });
  };
  OG.signOut = function (silent, msg) {
    S.token = ''; S.rows = []; S.leads = []; S.lastSync = 0;
    OG.store.del('og.token'); OG.store.del('og.cache');
    clearInterval(timer);
    OG._signOutMsg = msg || '';
    emit();
  };

  /* Manual stage mark (Plan a call / WhatsApp / Undo). Updates the screen at once, rolls back on error. */
  OG.mark = function (id, stage) {
    var r = OG.byId(id); if (!r) return Promise.resolve();
    var before = r.stage;
    r.stage = stage ? stage : OG.baseStage(r);
    emit();
    return OG.api.mark(S.token, id, stage || '').then(function () {
      var who = OG.displayName(r);
      OG.toast(stage === 'call' ? 'Call planned with ' + who + '. Moved to Call / WhatsApp.'
        : stage === 'whatsapp' ? 'WhatsApp planned with ' + who + '. Moved to Call / WhatsApp.'
        : 'Undone. ' + who + ' is back in ' + OG.STAGES[r.stage].label + '.');
    }, function (e) {
      r.stage = before; emit();
      OG.toast('Could not save: ' + (e.message || e));
    });
  };

  /* --- numbers for the Overview --- */
  OG.metrics = function (rows) {
    var now = Date.now(), weekAgo = now - 7 * OG.DAY;
    var m = { tracked: rows.length, waiting: 0, replies: 0, planned: 0, due: 0, fuWeek: 0, bounced: 0, newReplies: 0, recentReplies: 0 };
    rows.forEach(function (r) {
      if (r.stage === 'waiting' || r.stage === 'followup') m.waiting++;
      if (OG.isReplied(r)) m.replies++;
      if (r.stage === 'replied') m.newReplies++;
      if (OG.isReplied(r) && r.last >= weekAgo) m.recentReplies++;
      if (r.stage === 'call' || r.stage === 'whatsapp') m.planned++;
      if (r.due) m.due++;
      if (OG.isBounced(r)) m.bounced++;
      if ((r.fu || 0) > 0 && r.last >= weekAgo && /follow-up \d sent/i.test(r.status || '')) m.fuWeek++;
    });
    m.rate = m.tracked ? Math.round((m.replies / m.tracked) * 100) : 0;
    return m;
  };

  /* Mails sent and replies per week, last n weeks (Monday to Sunday). */
  OG.weekly = function (rows, n) {
    var start = OG.startOfWeek(Date.now()) - (n - 1) * 7 * OG.DAY, weeks = [];
    for (var i = 0; i < n; i++) weeks.push({ start: start + i * 7 * OG.DAY, sent: 0, replies: 0 });
    var idx = function (ms) { if (!ms || ms < start) return -1; var k = Math.floor((OG.startOfWeek(ms) - start) / (7 * OG.DAY) + 0.01); return k < n ? k : -1; };
    rows.forEach(function (r) {
      var a = idx(r.first); if (a >= 0) weeks[a].sent++;
      if (OG.isReplied(r)) { var b = idx(r.last); if (b >= 0) weeks[b].replies++; }
    });
    return weeks;
  };
})();
