/** Pure helpers for the Add / Edit contact form. */
import { toDateString, today as getToday, parseDate } from './dates.js';

export const CONTACT_FIELDS = [
  'company', 'contactPerson', 'designation', 'email', 'linkedinProfile', 'reachingOutFor',
  'emailSent', 'emailDate', 'linkedinSent', 'linkedinDate', 'followUpsDone', 'lastOutreachDate',
  'nextStep', 'nextFollowUpDate', 'replied', 'replyDate',
  'callDone', 'callDate', 'callOutcome', 'callNotes',
  'interestedInFunding', 'fundingStatus', 'owner', 'notes',
];

const BOOL_FIELDS = ['emailSent', 'linkedinSent', 'replied', 'callDone'];

/** Starting values for a brand-new contact. */
export function newContact(ref = getToday()) {
  return {
    company: '', contactPerson: '', designation: '', email: '', linkedinProfile: '',
    reachingOutFor: 'CSR funding',
    emailSent: false, emailDate: '', linkedinSent: false, linkedinDate: '',
    followUpsDone: 0, lastOutreachDate: '',
    nextStep: 'Send intro email', nextFollowUpDate: toDateString(ref),
    replied: false, replyDate: '',
    callDone: false, callDate: '', callOutcome: '', callNotes: '',
    interestedInFunding: 'Not known yet', fundingStatus: 'Not discussed',
    owner: '', notes: '',
  };
}

/** Copy of a record with every form field present. */
export function toFormValues(record) {
  const base = newContact();
  const out = {};
  for (const f of CONTACT_FIELDS) out[f] = record?.[f] ?? base[f];
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** { field: "message" } – empty object means the form is OK. */
export function validateContact(v) {
  const errors = {};
  if (!v.company.trim() && !v.contactPerson.trim()) errors.company = 'Add a company or a contact name.';
  if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) errors.email = 'This doesn’t look like an email address.';
  if (v.emailSent && !v.emailDate) errors.emailDate = 'When was the email sent?';
  if (v.linkedinSent && !v.linkedinDate) errors.linkedinDate = 'When was the LinkedIn message sent?';
  if (v.replied && !v.replyDate) errors.replyDate = 'When did they reply?';
  if (v.callDone && !v.callDate) errors.callDate = 'When was the call?';
  if (Number(v.followUpsDone) < 0) errors.followUpsDone = 'Can’t be negative.';
  return errors;
}

/** Tidy the form into a record: trims text, clears dates for unticked boxes, works out last outreach date. */
export function prepareContact(v) {
  const out = {};
  for (const f of CONTACT_FIELDS) {
    const val = v[f];
    if (BOOL_FIELDS.includes(f)) out[f] = Boolean(val);
    else if (f === 'followUpsDone') out[f] = Math.max(0, Math.round(Number(val) || 0));
    else out[f] = typeof val === 'string' ? val.trim() : val ?? '';
  }
  if (!out.emailSent) out.emailDate = '';
  if (!out.linkedinSent) out.linkedinDate = '';
  if (!out.replied) out.replyDate = '';
  if (!out.callDone) {
    out.callDate = '';
    out.callOutcome = '';
  }
  const dates = [out.lastOutreachDate, out.emailDate, out.linkedinDate, out.callDate].map(parseDate).filter(Boolean);
  out.lastOutreachDate = dates.length ? toDateString(new Date(Math.max(...dates))) : '';
  return out;
}

/** Only the fields that changed between two records (ignores id). */
export function diffRecord(before, after) {
  const changes = {};
  for (const f of CONTACT_FIELDS) {
    const a = before?.[f] ?? '';
    const b = after?.[f] ?? '';
    if (a !== b) changes[f] = after[f];
  }
  return changes;
}
