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

// {{name}} = person you mailed (first name), {{sender}} = your name (asked when you connect)
const FOLLOWUP_TEXT = [
  'Hi {{name}},\n\nJust following up on my earlier email in case it got buried. Would love to hear your thoughts.\n\nThanks,\n{{sender}}',
  'Hi {{name}},\n\nLast nudge from my side. If this is not relevant, no problem at all, just let me know.\n\nThanks,\n{{sender}}'
];

const OUTREACH_LABEL = 'Outreach';
const REPLIED_LABEL = 'Outreach-Replied';
const DONE_LABEL = 'Outreach-Done';
