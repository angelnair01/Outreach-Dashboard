(function () {
  var OG = window.OG;
  var COLS = [
    { key: 'waiting', title: 'Waiting for reply', color: 'var(--st-waiting)', match: function (r) { return r.stage === 'waiting'; } },
    { key: 'followup', title: 'Following up', color: 'var(--st-followup)', match: function (r) { return r.stage === 'followup'; } },
    { key: 'replied', title: 'Replied', color: 'var(--st-replied)', match: function (r) { return r.stage === 'replied'; } },
    { key: 'planned', title: 'Call / WhatsApp', color: 'var(--st-planned)', match: function (r) { return r.stage === 'call' || r.stage === 'whatsapp'; } },
    { key: 'stopped', title: 'Stopped / no reply', color: 'var(--st-stopped)', match: function (r) { return r.stage === 'stopped'; } }
  ];
  var LIMIT = 8;
  var expanded = {};

  function card(r) {
    var extra = r.stage === 'call' ? 'Call planned' : r.stage === 'whatsapp' ? 'WhatsApp planned' : r.status;
    return '<button class="kcard" data-open="' + OG.esc(r.id) + '"><div class="t">' + OG.esc(OG.displayName(r)) + '</div>' +
      '<div class="s">' + OG.esc(r.subject || '—') + '</div><div class="m">' + OG.esc(extra) + ' · ' + OG.fmtRel(r.last || r.first) + '</div></button>';
  }

  OG.pages.pipeline = {
    title: 'Pipeline',
    render: function (el) {
      var rows = OG.state.rows;
      var cols = COLS.filter(function (c) { return OG.CW || c.key !== 'planned'; });
      el.innerHTML = '<div class="page-head"><div><h1>Pipeline</h1><p class="muted">Where every contact stands. Click a card for details and next steps.</p></div></div>' +
        '<div class="board" style="--n:' + cols.length + '">' + cols.map(function (c) {
          var items = rows.filter(c.match);
          var shown = expanded[c.key] ? items : items.slice(0, LIMIT);
          var more = items.length - shown.length;
          return '<section class="col" style="--c:' + c.color + '"><div class="col-head"><span>' + c.title + '</span><span class="col-count">' + items.length + '</span></div>' +
            (shown.length ? shown.map(card).join('') : '<div class="empty">None</div>') +
            (more > 0 ? '<div class="more"><a href="#" data-expand="' + c.key + '">+' + more + ' more</a></div>' : '') +
            (expanded[c.key] && items.length > LIMIT ? '<div class="more"><a href="#" data-collapse="' + c.key + '">Show less</a></div>' : '') +
            '</section>';
        }).join('') + '</div>';

      el.querySelectorAll('[data-expand],[data-collapse]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var k = a.getAttribute('data-expand');
          if (k) expanded[k] = true; else expanded[a.getAttribute('data-collapse')] = false;
          OG.pages.pipeline.render(el);
        });
      });
    }
  };
})();
