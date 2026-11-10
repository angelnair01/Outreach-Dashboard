import { SETTINGS } from '../config/settings.js';
import { FUNDING_STATUS, INTERESTED_IN_FUNDING, REACHING_OUT_FOR } from '../config/lists.js';
import { parseDate, startOfWeek, today as getToday } from './dates.js';
import { groupFollowUps } from './followUps.js';
import { isAwaitingResponse, isReached } from './records.js';

/** Count records per value of `field`, in the order of `allowed` (unknown values go to "Other"/end). */
export function countBy(records, field, allowed) {
  const counts = Object.fromEntries(allowed.map((v) => [v, 0]));
  for (const r of records) {
    const v = r[field];
    if (!v) continue;
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

/** All headline metrics, derived from the raw records. */
export function getMetrics(records, ref = getToday(), settings = SETTINGS) {
  const totalContacts = records.length;
  const emailsSent = records.filter((r) => r.emailSent).length;
  const linkedinOutreach = records.filter((r) => r.linkedinSent).length;
  const followUpsDone = records.reduce((sum, r) => sum + (Number(r.followUpsDone) || 0), 0);
  const totalInteractions = emailsSent + linkedinOutreach + followUpsDone;

  const reached = records.filter(isReached).length;
  const responses = records.filter((r) => r.replied).length;
  const responseRate = reached > 0 ? Math.round((responses / reached) * 100) : 0;
  const awaitingResponse = records.filter(isAwaitingResponse).length;

  const weekStart = startOfWeek(ref, settings.weekStartsOn);
  const inThisWeek = (d) => {
    const date = parseDate(d);
    return date && date >= weekStart;
  };
  const emailsThisWeek = records.filter((r) => r.emailSent && inThisWeek(r.emailDate)).length;
  const linkedinThisWeek = records.filter((r) => r.linkedinSent && inThisWeek(r.linkedinDate)).length;

  const groups = groupFollowUps(records, ref, settings);

  return {
    totalContacts,
    reached,
    emailsSent,
    emailsThisWeek,
    linkedinOutreach,
    linkedinThisWeek,
    followUpsDone,
    totalInteractions,
    responses,
    responseRate,
    awaitingResponse,
    overdue: groups.overdue.length,
    dueToday: groups.today.length,
    dueNext7: groups.next7.length,
    dueLater: groups.later.length,
    byFundingStatus: countBy(records, 'fundingStatus', FUNDING_STATUS),
    byInterest: countBy(records, 'interestedInFunding', INTERESTED_IN_FUNDING),
    byReachingOutFor: countBy(records, 'reachingOutFor', REACHING_OUT_FOR),
  };
}

/** Replied records, most recent reply first. */
export function getRecentReplies(records, limit = SETTINGS.recentRepliesLimit) {
  return records
    .filter((r) => r.replied)
    .sort((a, b) => (parseDate(b.replyDate) ?? 0) - (parseDate(a.replyDate) ?? 0))
    .slice(0, limit);
}

/** Unique, sorted list of owners (for the table filter). */
export function getOwners(records) {
  return [...new Set(records.map((r) => r.owner).filter(Boolean))].sort();
}
