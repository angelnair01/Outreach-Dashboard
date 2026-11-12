/* Talks to the Apps Script JSON API only. Never to Gmail or Sheets directly. */
(function () {
  var OG = window.OG;
  var DEMO = '__demo__';
  OG.DEMO_TOKEN = DEMO;

  /* GET for reading; POST (with a plain-text JSON body) for anything that changes data,
     so names and emails never appear in web addresses. Neither sends custom headers,
     which is what lets Google's server answer a website on another domain. */
  function call(token, params, body) {
    var url = (window.APP_CONFIG || {}).API_URL || '';
    if (!url || /PASTE/.test(url)) return Promise.reject(new Error('The website has no API address yet (config.js).'));
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    var req;
    if (body) {
      req = fetch(url, { method: 'POST', redirect: 'follow', signal: ctrl && ctrl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token: token }, body)) });
    } else {
      var q = new URLSearchParams(Object.assign({ token: token, _: Date.now() }, params || {}));
      req = fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + q.toString(), { method: 'GET', redirect: 'follow', signal: ctrl && ctrl.signal });
    }
    return req
      .then(function (res) { return res.text(); })
      .then(function (text) {
        var data;
        try { data = JSON.parse(text); } catch (e) {
          throw new Error('Google sent back a web page instead of data. In Apps Script, check that "Who has access" is "Anyone".');
        }
        if (data && data.error === 'unauthorized') { var err = new Error('That token is not correct.'); err.code = 'unauthorized'; throw err; }
        if (data && data.error) throw new Error('The script reported a problem: ' + data.error);
        return data;
      })
      .catch(function (e) {
        if (e && e.name === 'AbortError') throw new Error('Google took too long to answer. Will try again.');
        if (e instanceof TypeError) throw new Error('Could not reach Google. Check your internet connection, or that the Web app is deployed with access "Anyone".');
        throw e;
      })
      .finally(function () { clearTimeout(timer); });
  }

  var later = function (v, ms) { return new Promise(function (ok) { setTimeout(function () { ok(v); }, ms || 250); }); };
  var copy = function (a) { return a.map(function (r) { return Object.assign({}, r); }); };

  OG.api = {
    /* -> { rows: [...Follow-up Log], leads: [...Leads tab] } */
    fetchAll: function (token) {
      if (token === DEMO) {
        if (!OG._demo) { OG._demo = OG.demoRows(); OG._demoLeads = OG.demoLeads(); }
        return later({ rows: copy(OG._demo), leads: copy(OG._demoLeads) }, 300);
      }
      return call(token).then(function (d) {
        return { rows: Array.isArray(d.rows) ? d.rows : [], leads: Array.isArray(d.leads) ? d.leads : [] };
      });
    },
    addLead: function (token, lead) {
      if (token === DEMO) {
        var done = lead.kind === 'done';
        var l = { id: 'L' + Date.now().toString(36), name: lead.name || '', email: (lead.email || '').toLowerCase(), org: lead.org || '',
          subject: lead.subject || '', notes: lead.notes || '', added: Date.now(), status: done ? 'Contacted' : 'To contact',
          channel: done ? lead.channel : '', contactedOn: done ? new Date(lead.contactedOn + 'T12:00:00').getTime() : null };
        OG._demoLeads.unshift(l);
        return later({ ok: true, lead: Object.assign({}, l) });
      }
      return call(token, null, { action: 'addLead', lead: lead });
    },
    contactedLead: function (token, id, channel, contactedOn) {
      if (token === DEMO) {
        var l = OG._demoLeads.find(function (x) { return x.id === id; });
        if (l) { l.status = 'Contacted'; l.channel = channel; l.contactedOn = new Date(contactedOn + 'T12:00:00').getTime(); }
        return later({ ok: true });
      }
      return call(token, null, { action: 'contactedLead', id: id, channel: channel, contactedOn: contactedOn });
    },
    removeLead: function (token, id) {
      if (token === DEMO) {
        OG._demoLeads = OG._demoLeads.filter(function (x) { return x.id !== id; });
        return later({ ok: true });
      }
      return call(token, null, { action: 'removeLead', id: id });
    },
    mark: function (token, id, stage) {
      if (token === DEMO) {
        var r = (OG._demo || []).find(function (x) { return x.id === id; });
        if (r) r.stage = (stage === 'call' || stage === 'whatsapp') ? stage : OG.baseStage(r);
        return new Promise(function (ok) { setTimeout(function () { ok({ ok: true }); }, 250); });
      }
      return call(token, null, { action: 'mark', id: id, stage: stage || 'clear' });
    }
  };
})();
