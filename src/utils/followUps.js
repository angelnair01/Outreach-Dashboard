import { SETTINGS } from '../config/settings.js';
import { addDays, daysBetween, parseDate, toDateString, today as getToday } from './dates.js';

export const FOLLOW_UP_GROUPS = ['overdue', 'today', 'next7', 'later'];

/**
 * Where a record's follow-up falls relative to today.
 * Returns { group, dueDate, daysFromToday } or null when there's nothing to follow up
 * (no date, or the next step is "Close").
 */
export function getFollowUpInfo(record, ref = getToday(), settings = SETTINGS) {
  if (record.nextStep === 'Close') return null;
  const dueDate = parseDate(record.nextFollowUpDate);
  if (!dueDate) return null;
  const daysFromToday = daysBetween(ref, dueDate);
  let group = 'later';
  if (daysFromToday < 0) group = 'overdue';
  else if (daysFromToday === 0) group = 'today';
  else if (daysFromToday <= settings.upcomingWindowDays) group = 'next7';
  return { group, dueDate, daysFromToday };
}

/** { overdue: [], today: [], next7: [], later: [] } - each item { record, info }, sorted by date. */
export function groupFollowUps(records, ref = getToday(), settings = SETTINGS) {
  const groups = Object.fromEntries(FOLLOW_UP_GROUPS.map((g) => [g, []]));
  for (const record of records) {
    const info = getFollowUpInfo(record, ref, settings);
    if (info) groups[info.group].push({ record, info });
  }
  for (const g of FOLLOW_UP_GROUPS) groups[g].sort((a, b) => a.info.dueDate - b.info.dueDate);
  return groups;
}

/** "3 days overdue", "due today", "in 4 days" */
export function describeDue(info) {
  if (!info) return '-';
  const n = info.daysFromToday;
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} overdue`;
  if (n === 0) return 'due today';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
}

/**
 * "Mark done" / "Call done". Returns a NEW record.
 * - For a call to set up: records the call as done today (outcome to be filled in) and
 *   schedules the after-call follow-up.
 * - For everything else: one more follow-up sent today, next step = waiting, next follow-up a few days out.
 */
export function markFollowUpDone(record, actionType, { countFollowUp = true } = {}, ref = getToday(), settings = SETTINGS) {
  if (actionType === 'call') {
    return {
      ...record,
      callDone: true,
      callDate: toDateString(ref),
      callOutcome: '',
      callNotes: '',
      lastOutreachDate: toDateString(ref),
      nextStep: 'Follow-up email',
      nextFollowUpDate: toDateString(addDays(ref, settings.daysToFollowUpAfterCall)),
    };
  }
  return {
    ...record,
    followUpsDone: (record.followUpsDone || 0) + (countFollowUp ? 1 : 0),
    lastOutreachDate: toDateString(ref),
    nextStep: 'Waiting for reply',
    nextFollowUpDate: toDateString(addDays(ref, settings.daysUntilNextFollowUp)),
  };
}
