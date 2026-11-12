/* Grouped bar chart in plain SVG: mails sent vs replies per week. Hover shows exact numbers. */
(function () {
  var OG = window.OG;

  OG.weeklyChart = function (weeks) {
    var W = 480, H = 230, padL = 30, padR = 8, padT = 10, padB = 28;
    var max = Math.max(4, Math.max.apply(null, weeks.map(function (w) { return Math.max(w.sent, w.replies); })));
    var step = max <= 8 ? 2 : max <= 20 ? 5 : max <= 50 ? 10 : Math.ceil(max / 5 / 10) * 10;
    var top = Math.ceil(max / step) * step;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var groupW = plotW / weeks.length, barW = Math.min(18, (groupW - 14) / 2), gap = 2;
    var y = function (v) { return padT + plotH - (v / top) * plotH; };
    var out = [];

    out.push('<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Mails sent and replies per week, last ' + weeks.length + ' weeks">');
    for (var t = 0; t <= top; t += step) {
      out.push('<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="var(--grid)" stroke-width="1"/>');
      out.push('<text x="' + (padL - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end" font-size="11" fill="var(--text-3)">' + t + '</text>');
    }
    weeks.forEach(function (w, i) {
      var cx = padL + groupW * i + groupW / 2;
      var bar = function (v, x, color) {
        if (!v) return '';
        var h = Math.max(2, y(0) - y(v)), r = Math.min(4, barW / 2, h);
        var x0 = x, x1 = x + barW, yt = y(0) - h, yb = y(0);
        // rounded top corners only, square at the baseline
        return '<path d="M' + x0 + ',' + yb + 'V' + (yt + r) + 'Q' + x0 + ',' + yt + ' ' + (x0 + r) + ',' + yt + 'H' + (x1 - r) +
          'Q' + x1 + ',' + yt + ' ' + x1 + ',' + (yt + r) + 'V' + yb + 'Z" fill="' + color + '"/>';
      };
      out.push(bar(w.sent, cx - barW - gap / 2, 'var(--series-1)'));
      out.push(bar(w.replies, cx + gap / 2, 'var(--series-2)'));
      var d = new Date(w.start);
      out.push('<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="var(--text-3)">' + d.getDate() + ' ' + OG.fmtDate(w.start).split(' ')[1] + '</text>');
      // big invisible hover target per week
      out.push('<rect class="hit" data-i="' + i + '" x="' + (padL + groupW * i) + '" y="' + padT + '" width="' + groupW + '" height="' + plotH + '" fill="transparent"/>');
    });
    out.push('<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="var(--text-3)" stroke-width="1"/>');
    out.push('</svg>');

    var legend = '<div class="legend"><span><i style="background:var(--series-1)"></i>Mails sent</span><span><i style="background:var(--series-2)"></i>Replies</span></div>';
    return legend + '<div class="chart-wrap" data-weeks=\'' + OG.esc(JSON.stringify(weeks)) + '\'>' + out.join('') + '</div>';
  };

  /* One delegated hover handler for any chart on the page. */
  document.addEventListener('mousemove', function (e) {
    var tip = document.getElementById('tooltip');
    var hit = e.target.closest && e.target.closest('.chart-wrap .hit');
    if (!hit) { tip.hidden = true; return; }
    var weeks = JSON.parse(hit.closest('.chart-wrap').getAttribute('data-weeks'));
    var w = weeks[+hit.getAttribute('data-i')];
    tip.innerHTML = '<strong>Week of ' + OG.fmtDate(w.start) + '</strong><br>Mails sent: ' + w.sent + '<br>Replies: ' + w.replies;
    tip.hidden = false;
    var x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = x + 'px'; tip.style.top = (e.clientY - tip.offsetHeight - 10) + 'px';
  });
})();
