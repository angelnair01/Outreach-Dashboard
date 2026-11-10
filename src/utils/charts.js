import { SETTINGS } from '../config/settings.js';
import { FUNDING_STATUS, REACHING_OUT_FOR } from '../config/lists.js';
import { addDays, formatDate, parseDate, startOfWeek, today as getToday } from './dates.js';
import { countBy } from './metrics.js';

/** [{ status, count }] in pipeline order. */
export function getPipelineData(records) {
  const counts = countBy(records, 'fundingStatus', FUNDING_STATUS);
  return FUNDING_STATUS.map((status) => ({ status, count: counts[status] || 0 }));
}

/** [{ reason, count, percent }] for "Reaching out for", largest first. */
export function getReasonBreakdown(records) {
  const counts = countBy(records, 'reachingOutFor', REACHING_OUT_FOR);
  const total = records.length;
  return REACHING_OUT_FOR.map((reason) => ({
    reason,
    count: counts[reason] || 0,
    percent: total > 0 ? Math.round(((counts[reason] || 0) / total) * 100) : 0,
  })).sort((a, b) => b.count - a.count);
}

/**
 * Outreach per week for the last N weeks (oldest first), counting each email date and
 * each LinkedIn date as one interaction. Weeks with no outreach are kept as zero.
 */
export function getWeeklyOutreach(records, ref = getToday(), settings = SETTINGS) {
  const thisWeek = startOfWeek(ref, settings.weekStartsOn);
  const weeks = [];
  for (let i = settings.weeksInChart - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    weeks.push({ key: start.getTime(), label: i === 0 ? 'This week' : formatDate(start), email: 0, linkedin: 0, total: 0 });
  }
  const add = (date, channel) => {
    const d = parseDate(date);
    if (!d) return;
    const week = weeks.find((w) => w.key === startOfWeek(d, settings.weekStartsOn).getTime());
    if (week) {
      week[channel] += 1;
      week.total += 1;
    }
  };
  for (const r of records) {
    if (r.emailSent) add(r.emailDate, 'email');
    if (r.linkedinSent) add(r.linkedinDate, 'linkedin');
  }
  return weeks;
}
