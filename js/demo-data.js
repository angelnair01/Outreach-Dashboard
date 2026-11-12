/* Made-up sample contacts for "Try with sample data". Not real people. */
(function () {
  var OG = window.OG;
  OG.demoRows = function () {
    var seed = 7;
    var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    var pick = function (a) { return a[Math.floor(rnd() * a.length)]; };
    var first = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Ananya', 'Ishaan', 'Nisha', 'Vikram', 'Tara', 'Arjun', 'Leela',
      'Sameer', 'Priya', 'Dev', 'Kavya', 'Neel', 'Riya', 'Aditya', 'Sana', 'Omar', 'Zoya', 'Karan', 'Pooja'];
    var last = ['Sharma', 'Iyer', 'Menon', 'Kapoor', 'Nair', 'Rao', 'Das', 'Joshi', 'Pillai', 'Bose', 'Khan', 'Mehta'];
    var orgs = ['Northfield College', 'Bright Minds Academy', 'Delta Institute', 'Crescent University', 'Lakeside School',
      'Summit Business School', 'Greenway College', 'Horizon Tech Institute'];
    var subjects = ['Partnership with OpenGrad', 'OpenGrad x ', 'Helping your students with study-abroad plans',
      'Quick idea for your placement cell', 'Free career workshop for your students'];
    var replies = [
      "Thanks for reaching out! This sounds interesting. Could we set up a short call next week?",
      "Hi, happy to explore this. Please share a brochure and your WhatsApp number.",
      "We'd like to know more about pricing. Can you call me on Thursday afternoon?",
      "Not right now, but please check back after our exams in January.",
      "Forwarding this to our placement head, she will get in touch."
    ];
    var now = Date.now(), DAY = OG.DAY, rows = [];
    for (var i = 0; i < 46; i++) {
      var fn = pick(first), ln = pick(last), org = pick(orgs);
      var age = Math.floor(rnd() * 60) + (i < 6 ? 0 : 1); // days since first mail
      var firstMs = now - age * DAY - Math.floor(rnd() * 8) * 3600000;
      var subj = pick(subjects); if (/x $/.test(subj)) subj += org;
      var r = {
        id: 'demo' + (1000 + i) + 'a' + Math.floor(rnd() * 1e6).toString(16),
        name: rnd() < 0.15 ? '' : fn + ' ' + ln,
        email: (fn + '.' + ln).toLowerCase() + '@' + org.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12) + '.example',
        subject: subj, first: firstMs, fu: 0, status: 'Waiting (first mail sent)', last: firstMs, snippet: '', stage: 'waiting', due: false
      };
      var roll = rnd();
      var fuPossible = Math.min(2, Math.floor(age / 7));
      if (roll < 0.06) {
        r.status = 'Bounced'; r.stage = 'stopped';
      } else if (roll < 0.36 && age > 1) {
        r.fu = Math.min(fuPossible, Math.floor(rnd() * 2));
        r.last = firstMs + Math.floor(rnd() * Math.max(1, age - 0.5) * DAY);
        r.status = 'Replied'; r.snippet = pick(replies);
        r.stage = rnd() < 0.3 ? (rnd() < 0.5 ? 'call' : 'whatsapp') : 'replied';
      } else if (fuPossible >= 2 && age >= 21) {
        r.fu = 2; r.last = firstMs + 14 * DAY; r.status = 'Stopped (no reply)'; r.stage = 'stopped';
      } else {
        r.fu = Math.max(0, fuPossible - (rnd() < 0.35 ? 1 : 0)); r.last = firstMs + r.fu * 7 * DAY;
        r.stage = r.fu > 0 ? 'followup' : 'waiting';
        r.status = r.fu > 0 ? 'Waiting (follow-up ' + r.fu + ' sent)' : 'Waiting (first mail sent)';
        if (r.fu < 2 && now - r.last >= 7 * DAY) { r.status = 'Follow-up ' + (r.fu + 1) + ' due (waiting for send window)'; r.due = true; }
      }
      rows.push(r);
    }
    rows.sort(function (a, b) { return b.first - a.first; });
    return rows;
  };
})();

/* Made-up "To contact" and logged-outreach entries for the sample data. */
(function () {
  var OG = window.OG;
  OG.demoLeads = function () {
    var now = Date.now(), D = OG.DAY;
    return [
      { id: 'Ldemo1', name: 'Farah Siddiqui', email: 'farah.s@riverside.example', org: 'Riverside College', subject: 'Partnership with OpenGrad', notes: 'Met at the education fair. Interested in workshops.', added: now - 1 * D, status: 'To contact', channel: '', contactedOn: null },
      { id: 'Ldemo2', name: 'Manoj Kulkarni', email: 'manoj.k@pinecrest.example', org: 'Pinecrest Institute', subject: '', notes: 'Referred by Kavya Rao.', added: now - 3 * D, status: 'To contact', channel: '', contactedOn: null },
      { id: 'Ldemo3', name: 'Elena Thomas', email: '', org: 'Westbrook University', subject: '', notes: 'Sent a connection request with a short note.', added: now - 2 * D, status: 'Contacted', channel: 'LinkedIn', contactedOn: now - 2 * D },
      { id: 'Ldemo4', name: 'Rahul Verma', email: 'rahul.v@oakridge.example', org: 'Oakridge School', subject: '', notes: 'Called the office, asked to email the principal.', added: now - 6 * D, status: 'Contacted', channel: 'Call', contactedOn: now - 6 * D }
    ];
  };
})();
