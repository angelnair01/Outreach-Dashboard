import { ACTION_TYPES } from '../config/lists.js';
import { formatDate, relativeDays } from './dates.js';

/**
 * What exactly should we do for this contact next?
 * Combines the planned "next step", whether they replied, and whether a call already happened
 * (and how it went), into one plain-language instruction.
 *
 * Returns { type, label, detail, call }
 *   type:   "email" | "linkedin" | "call" | "afterCall" | "proposal"
 *   label:  short instruction, e.g. "Send a follow-up email"
 *   detail: one line of context, e.g. "No reply yet · 1 follow-up sent so far"
 *   call:   { date, outcome, notes } when a call has happened, otherwise null
 */
export function getRecommendedAction(record) {
  const step = record.nextStep || '';
  const call = record.callDone
    ? { date: record.callDate, outcome: record.callOutcome || '', notes: record.callNotes || '' }
    : null;

  // 1) A call already happened: the next action depends on how it went.
  if (call && step !== 'Schedule call / meeting') {
    const when = call.date ? `Call ${relativeDays(call.date)} (${formatDate(call.date)})` : 'Call done';
    const detail = call.outcome ? `${when}: ${call.outcome}` : `${when}: outcome not written down yet`;
    let label;
    if (!call.outcome) label = 'Write down how the call went';
    else if (call.outcome === 'Positive – moving ahead')
      label = step === 'Send proposal' ? 'Send the proposal discussed on the call' : 'Send the next steps agreed on the call';
    else if (call.outcome === 'Needs more information') label = 'Email the information they asked for';
    else if (call.outcome === 'Asked us to wait') label = 'Check in again, as agreed on the call';
    else label = 'Send a polite thank-you and close';
    return { type: 'afterCall', label, detail, call };
  }

  const replied = record.replied;
  const repliedText = replied && record.replyDate ? `Replied ${relativeDays(record.replyDate)}` : 'Replied';
  const followUps = Number(record.followUpsDone) || 0;
  const noReplyText = `No reply yet · ${followUps} follow-up${followUps === 1 ? '' : 's'} sent so far`;

  // 2) Planned next step from the sheet.
  if (step === 'Schedule call / meeting') {
    const interest = record.interestedInFunding && record.interestedInFunding !== 'Not known yet' ? ` · Interested: ${record.interestedInFunding}` : '';
    return { type: 'call', label: 'Set up a call', detail: replied ? `${repliedText}${interest}` : 'Ask for a short call', call };
  }
  if (step === 'Send proposal') {
    return { type: 'proposal', label: 'Send the proposal', detail: replied ? repliedText : 'Proposal requested', call };
  }
  if (step === 'Send LinkedIn request') return { type: 'linkedin', label: 'Send a LinkedIn connection request', detail: 'Not connected yet', call };
  if (step === 'Send LinkedIn message') return { type: 'linkedin', label: 'Send a LinkedIn message', detail: 'Connected on LinkedIn', call };
  if (step === 'Follow-up LinkedIn') return { type: 'linkedin', label: 'Follow up on LinkedIn', detail: replied ? repliedText : noReplyText, call };
  if (step === 'Send intro email') return { type: 'email', label: 'Send the intro email', detail: 'First contact', call };

  // 3) Follow-up email / waiting / blank: decide from what has happened so far.
  if (replied) {
    const interested = record.interestedInFunding === 'Yes' || record.interestedInFunding === 'Maybe';
    if (interested) return { type: 'call', label: 'Set up a call', detail: `${repliedText} · Interested: ${record.interestedInFunding}`, call };
    return { type: 'email', label: 'Reply to their email', detail: repliedText, call };
  }
  if (record.emailSent || record.linkedinSent) {
    return { type: 'email', label: 'Send a follow-up email', detail: noReplyText, call };
  }
  return { type: 'email', label: 'Send the intro email', detail: 'First contact', call };
}

/** "2 emails, 1 call to set up" for a list of { record } items (or records). */
export function describeActionMix(items) {
  const counts = {};
  for (const item of items) {
    const type = getRecommendedAction(item.record ?? item).type;
    counts[type] = (counts[type] || 0) + 1;
  }
  return Object.keys(ACTION_TYPES)
    .filter((t) => counts[t])
    .map((t) => `${counts[t]} ${ACTION_TYPES[t].short[counts[t] === 1 ? 0 : 1]}`)
    .join(', ');
}
