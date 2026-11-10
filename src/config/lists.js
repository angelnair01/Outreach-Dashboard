/**
 * Allowed values for the dropdown-style fields, plus the badge color for each.
 * Filters, badges and charts all read from here - change a list once and the whole page follows.
 *
 * Tones: green = positive/replied, amber = in progress / due soon, red = negative/overdue,
 *        gray = no action / unknown, indigo = neutral highlight.
 */

export const REACHING_OUT_FOR = [
  'CSR funding',
  'Individual donation',
  'Partnership',
  'Mentorship / volunteers',
  'Other',
];

export const NEXT_STEPS = [
  'Send intro email',
  'Send LinkedIn request',
  'Send LinkedIn message',
  'Follow-up email',
  'Follow-up LinkedIn',
  'Schedule call / meeting',
  'Send proposal',
  'Waiting for reply',
  'Close',
];

export const INTERESTED_IN_FUNDING = ['Not known yet', 'Yes', 'Maybe', 'No'];

export const FUNDING_STATUS = ['Not discussed', 'Discussing', 'Committed', 'Funded', 'Declined'];

/** How a call went. Leave blank if the call happened but nobody wrote down the outcome yet. */
export const CALL_OUTCOMES = ['Positive – moving ahead', 'Needs more information', 'Asked us to wait', 'Not interested'];

export const CALL_OUTCOME_TONES = {
  'Positive – moving ahead': 'green',
  'Needs more information': 'amber',
  'Asked us to wait': 'gray',
  'Not interested': 'red',
};

/**
 * The kinds of follow-up action the dashboard recommends (worked out in src/utils/actions.js).
 * `short` is used in sentences like "4 follow-ups are overdue (2 emails, 1 call to set up)".
 */
export const ACTION_TYPES = {
  email: { label: 'Email', short: ['email', 'emails'] },
  linkedin: { label: 'LinkedIn', short: ['LinkedIn message', 'LinkedIn messages'] },
  call: { label: 'Set up a call', short: ['call to set up', 'calls to set up'] },
  afterCall: { label: 'After a call', short: ['follow-up after a call', 'follow-ups after calls'] },
  proposal: { label: 'Proposal', short: ['proposal', 'proposals'] },
};

export const INTERESTED_TONES = {
  'Not known yet': 'gray',
  Yes: 'green',
  Maybe: 'amber',
  No: 'red',
};

export const FUNDING_STATUS_TONES = {
  'Not discussed': 'gray',
  Discussing: 'indigo',
  Committed: 'green',
  Funded: 'green',
  Declined: 'red',
};

/** Tailwind classes per tone. Text uses -700/-800 shades for strong contrast. */
export const TONE_CLASSES = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  red: 'bg-rose-50 text-rose-800 ring-rose-600/20',
  gray: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  indigo: 'bg-indigo-50 text-indigo-800 ring-indigo-600/20',
};
