/**
 * Small, pure date helpers.
 * Dates in the data are plain "YYYY-MM-DD" strings (like a spreadsheet cell) and are read in the
 * user's LOCAL timezone, so "today" always means today where the user is.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a Date, "YYYY-MM-DD" (local) or ISO string. Returns null for blank/invalid values. */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getTime());
  const m = DATE_ONLY.exec(String(value).trim());
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function startOfDay(value) {
  const d = parseDate(value);
  if (!d) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function today() {
  return startOfDay(new Date());
}

export function addDays(value, days) {
  const d = parseDate(value);
  d.setDate(d.getDate() + days);
  return d;
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

export function startOfWeek(value, weekStartsOn = 1) {
  const d = startOfDay(value);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

/** Date -> "YYYY-MM-DD" in local time (same format as the data). */
export function toDateString(value) {
  const d = parseDate(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "10 Nov" or "10 Nov 2026"; blank -> "-" */
export function formatDate(value, { withYear = false } = {}) {
  const d = parseDate(value);
  if (!d) return '-';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

/** "today", "yesterday", "tomorrow", "3 days ago", "in 2 days" */
export function relativeDays(value, ref = today()) {
  const diff = daysBetween(ref, value);
  if (diff === 0) return 'today';
  if (diff === -1) return 'yesterday';
  if (diff === 1) return 'tomorrow';
  return diff < 0 ? `${-diff} days ago` : `in ${diff} days`;
}

/** "just now", "4 min ago", "2 hours ago" */
export function timeAgo(value, now = new Date()) {
  const d = parseDate(value);
  if (!d) return 'never';
  const minutes = Math.floor((now - d) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
