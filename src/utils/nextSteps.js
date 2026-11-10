import { SETTINGS } from '../config/settings.js';
import { pluralize, today as getToday } from './dates.js';
import { groupFollowUps } from './followUps.js';
import { describeActionMix, getRecommendedAction } from './actions.js';
import { missingCallOutcome, missingNextStep } from './records.js';

const isAre = (n) => (n === 1 ? 'is' : 'are');

/**
 * Plain-language to-do items, most urgent first (max 6).
 * priority: "red" | "amber" | "green" | "gray"
 * target: section id to scroll to. tab: follow-up tab to open. actionFilter: follow-up type to show.
 * tableFilter: preset for the outreach table.
 */
export function getNextSteps(records, ref = getToday(), settings = SETTINGS) {
  const steps = [];
  const groups = groupFollowUps(records, ref, settings);
  const soon = [...groups.overdue, ...groups.today, ...groups.next7];
  const ofType = (items, type) => items.filter((i) => getRecommendedAction(i.record).type === type);

  const overdue = groups.overdue.length;
  if (overdue > 0) {
    steps.push({
      id: 'overdue',
      priority: 'red',
      text: `${pluralize(overdue, 'follow-up')} ${isAre(overdue)} overdue (${describeActionMix(groups.overdue)}) — do ${overdue === 1 ? 'it' : 'them'} today`,
      actionLabel: 'See overdue',
      target: 'follow-ups',
      tab: 'overdue',
    });
  }

  const dueToday = groups.today.length;
  if (dueToday > 0) {
    steps.push({
      id: 'today',
      priority: 'amber',
      text: `${pluralize(dueToday, 'follow-up')} ${isAre(dueToday)} due today (${describeActionMix(groups.today)})`,
      actionLabel: 'See today',
      target: 'follow-ups',
      tab: 'today',
    });
  }

  // Calls that already happened: act on what was agreed.
  const afterCall = ofType(soon, 'afterCall').filter((i) => !missingCallOutcome(i.record));
  if (afterCall.length > 0) {
    const one = afterCall[0].record;
    steps.push({
      id: 'after-call',
      priority: 'green',
      text:
        afterCall.length === 1
          ? `You had a call with ${one.company} (${one.callOutcome}) — ${getRecommendedAction(one).label.toLowerCase()}`
          : `${afterCall.length} calls need a follow-up — send what was agreed on each call`,
      actionLabel: 'See after-call follow-ups',
      target: 'follow-ups',
      tab: afterCall.length === 1 ? afterCall[0].info.group : undefined,
      actionFilter: 'afterCall',
    });
  }

  // Interested contacts who still need a call.
  const callsToSet = ofType(soon, 'call');
  if (callsToSet.length > 0) {
    const one = callsToSet[0].record;
    steps.push({
      id: 'set-up-calls',
      priority: 'green',
      text:
        callsToSet.length === 1
          ? `${one.contactPerson || one.company} replied and is interested — set up a call`
          : `${callsToSet.length} interested contacts are waiting for a call — set them up`,
      actionLabel: 'See calls to set up',
      target: 'follow-ups',
      tab: callsToSet.length === 1 ? callsToSet[0].info.group : undefined,
      actionFilter: 'call',
    });
  }

  const next7 = groups.next7.length;
  if (next7 > 0) {
    steps.push({
      id: 'next7',
      priority: 'amber',
      text: `${pluralize(next7, 'follow-up')} ${isAre(next7)} due in the next ${settings.upcomingWindowDays} days (${describeActionMix(groups.next7)})`,
      actionLabel: `See next ${settings.upcomingWindowDays} days`,
      target: 'follow-ups',
      tab: 'next7',
    });
  }

  const noOutcome = records.filter(missingCallOutcome).length;
  const missing = records.filter(missingNextStep).length;
  if (noOutcome + missing > 0) {
    const parts = [];
    if (noOutcome > 0) parts.push(`${pluralize(noOutcome, 'call')} ${noOutcome === 1 ? 'has' : 'have'} no outcome written down`);
    if (missing > 0) parts.push(`${pluralize(missing, 'contact')} ${missing === 1 ? 'has' : 'have'} no next step or follow-up date`);
    steps.push({
      id: 'missing',
      priority: 'gray',
      text: parts.join('; '),
      actionLabel: 'See contacts',
      target: 'all-outreach',
      tableFilter: { needsDetails: true },
    });
  }

  if (steps.length === 0) {
    steps.push({
      id: 'all-clear',
      priority: 'green',
      text: 'You’re all caught up — nothing is pending right now',
      actionLabel: 'See all outreach',
      target: 'all-outreach',
    });
  }

  return steps.slice(0, 6);
}
