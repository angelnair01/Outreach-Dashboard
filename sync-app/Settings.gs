/**
 * Outreach Sync - settings. (In Apps Script this is the file called "Settings".)
 */

// The Outreach API web app address (same as API_URL in the dashboard's config.js).
const API_URL = 'https://script.google.com/macros/s/AKfycbyjXY1hrUGAJaapY44DUE9KWSkH1jsz1LM7snHIENSz-dSgNa6Z6YqiAjjbl2a-e-ASEw/exec';

const DRY_RUN = true;          // true = only logs what WOULD be sent (start here). false = really sends follow-ups.

const WAIT_DAYS = 7;           // days between each mail
const MAX_FOLLOWUPS = 2;       // follow-ups after the first mail
const MAX_PER_DAY = 30;        // safety cap on follow-ups sent per day, per Gmail account
const SEND_FROM_HOUR = 9;      // only send between these hours (time zone in appsscript.json)
const SEND_TO_HOUR = 19;
const MAX_AGE_DAYS_FOR_NEW = 30; // a thread first seen when already older than this is logged but never followed up

// Follow-up emails, sent as a reply in the same Gmail thread (so the subject stays the same).
//   {{name}}    = first name of the person you mailed ("there" if unknown)
//   {{company}} = their company: the one set on the dashboard, else the Organisation from "Add & log",
//                 else a guess from their email address, else "your organisation"
//   {{sender}}  = your name (asked when you connect your Gmail)
// Write each email as plain text; empty lines become paragraphs.
const FOLLOWUP_TEXT = [
  // Follow-up 1 (final, approved)
  'Hi {{name}},\n\n' +
  'I hope you\'re doing well. I wanted to follow up on my email regarding a potential partnership between OpenGrad and {{company}}.\n\n' +
  'I believe there is a strong synergy between {{company}}\'s work and OpenGrad\'s mission, and I would welcome the opportunity to explore how we could create value together.\n\n' +
  'I\'d be glad to set up a brief call at your convenience.\n' +
  'Looking forward to hearing from you.\n\n' +
  'Best regards,\n{{sender}}\nOpenGrad Foundation',

  // Follow-up 2 (final, approved)
  'Hi {{name}},\n\n' +
  'I hope this finds you well. I\'m following up regarding a potential partnership between OpenGrad and {{company}}.\n\n' +
  'I believe there is a strong synergy between your organisation\'s work and OpenGrad\'s mission, and I would welcome the opportunity to explore how we could create value together.\n' +
  'If it sounds of interest, I\'d welcome a short call whenever suits you.\n\n' +
  'Best regards,\n{{sender}}\nOpenGrad Foundation'
];

const OUTREACH_LABEL = 'Outreach';
const REPLIED_LABEL = 'Outreach-Replied';
const DONE_LABEL = 'Outreach-Done';
