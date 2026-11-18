/* Talks to the Apps Script JSON API only. Never to Gmail or Sheets directly. */
(function () {
  var OG = window.OG;
  var DEMO = '__demo__';
  OG.DEMO_TOKEN = DEMO;

  /* Every request is a POST with a plain-text JSON body { idToken, action, ... }, so nothing
     personal appears in web addresses. No custom headers, which is what lets Google's server
     answer a website on another domain. */
  function post(idToken, body) {
    var url = (window.APP_CONFIG || {}).API_URL || '';
    if (!url || /PASTE/.test(url)) return Promise.reject(new Error('The website has no API address yet (config.js).'));
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    return fetch(url, { method: 'POST', redirect: 'follow', signal: ctrl && ctrl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ idToken: idToken }, body)) })
      .then(function (res) { return res.text(); })
      .then(function (text) {
        var data, err;
        try { data = JSON.parse(text); } catch (e) {
          throw new Error('Google sent back a web page instead of data. In Apps Script, check that "Who has access" is "Anyone".');
        }
        if (data && (data.error === 'signin' || data.error === 'expired')) {
          err = new Error('Please sign in again.'); err.code = 'expired'; throw err;
        }
        if (data && data.error === 'not_allowed') {
          err = new Error((data.email || 'This Google account') + ' is not on the access list. Ask the owner to add it to the "Dashboard Access" tab of the sheet.');
          err.code = 'not_allowed'; throw err;
        }
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

  /* Use a fresh sign-in ticket; if the server still says it expired, renew once and retry. */
  function call(_token, _params, body) {
    return OG.freshToken().then(function (t) {
      return post(t, body).catch(function (e) {
        if (e.code !== 'expired') throw e;
        return OG.freshToken(true).then(function (t2) { return post(t2, body); });
      }).then(function (res) {
        // After a change, re-read soon so every page shows the saved state.
        if (body.action !== 'get') setTimeout(function () { OG.refresh({ quiet: true }); }, 1500);
        return res;
      });
    });
  }

  var later = function (v, ms) { return new Promise(function (ok) { setTimeout(function () { ok(v); }, ms || 250); }); };
  var copy = function (a) { return a.map(function (r) { return Object.assign({}, r); }); };

  OG.api = {
    /* -> { rows, leads, account, ver }  or  { unchanged: true, account, ver } when `since` is still current */
    fetchAll: function (token, since) {
      if (token === DEMO) {
        if (!OG._demo) { OG._demo = OG.demoRows(OG.sampleSize()); OG._demoLeads = OG.demoLeads(); }
        return later({ rows: copy(OG._demo), leads: copy(OG._demoLeads), touches: copy(OG._demoTouches || (OG._demoTouches = OG.demoTouches(OG._demo))), companies: Object.assign({}, OG._demoCompanies || {}), account: { connected: true, name: 'Demo', lastSync: OG._demoSync || Date.now() - 25000 } }, 300);
      }
      return call(token, null, { action: 'get', since: since || '' }).then(function (d) {
        if (d.unchanged) return { unchanged: true, account: d.account || null, ver: d.ver };
        return { rows: Array.isArray(d.rows) ? d.rows : [], leads: Array.isArray(d.leads) ? d.leads : [], touches: Array.isArray(d.touches) ? d.touches : [], companies: d.companies || {}, account: d.account || null, ver: d.ver || '' };
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
    addTouch: function (token, touch) {
      if (token === DEMO) {
        var t = Object.assign({ id: 'T' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }, touch, { at: touch.at || Date.now() });
        (OG._demoTouches = OG._demoTouches || []).unshift(t);
        return later({ ok: true, touch: Object.assign({}, t) });
      }
      return call(token, null, { action: 'addTouch', touch: touch });
    },
    removeTouch: function (token, id) {
      if (token === DEMO) { OG._demoTouches = (OG._demoTouches || []).filter(function (t) { return t.id !== id; }); return later({ ok: true }); }
      return call(token, null, { action: 'removeTouch', id: id });
    },
    setCompany: function (token, email, company) {
      if (token === DEMO) { (OG._demoCompanies = OG._demoCompanies || {})[String(email).toLowerCase()] = company; return later({ ok: true }); }
      return call(token, null, { action: 'setCompany', email: email, company: company });
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
