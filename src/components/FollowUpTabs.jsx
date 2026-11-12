import { useRef, useState } from 'react';
import { CalendarCheck, Check, Pencil, PhoneCall } from 'lucide-react';
import Section from './Section.jsx';
import { SkeletonRows } from './Skeleton.jsx';
import EmptyState, { ErrorState } from './EmptyState.jsx';
import { ACTION_ICONS, ActionTag, CallOutcomeBadge } from './StatusBadge.jsx';
import { ACTION_TYPES } from '../config/lists.js';
import { SETTINGS } from '../config/settings.js';
import { formatDate } from '../utils/dates.js';
import { describeDue } from '../utils/followUps.js';
import { getRecommendedAction } from '../utils/actions.js';
import { displayValue } from '../utils/records.js';

export const TABS = [
  {
    key: 'overdue',
    label: 'Overdue',
    countClass: 'bg-rose-100 text-rose-800',
    dueClass: 'text-rose-700',
    empty: ['No overdue follow-ups', 'Nice work — nothing has slipped.'],
  },
  {
    key: 'today',
    label: 'Today',
    countClass: 'bg-amber-100 text-amber-800',
    dueClass: 'text-amber-800',
    empty: ['Nothing due today', 'Enjoy the breathing room.'],
  },
  {
    key: 'next7',
    label: `Next ${SETTINGS.upcomingWindowDays} days`,
    countClass: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
    dueClass: 'text-amber-800',
    empty: ['Nothing due this coming week', 'New follow-ups will show up here.'],
  },
  {
    key: 'later',
    label: 'Later',
    countClass: 'bg-slate-100 text-slate-700',
    dueClass: 'text-slate-700',
    empty: ['Nothing scheduled further out', 'Follow-ups planned beyond next week appear here.'],
  },
];

/** Button text depends on the kind of action. */
function doneLabel(type) {
  if (type === 'call') return 'Call done';
  if (type === 'email') return 'Mark sent';
  return 'Mark done';
}

function FollowUpRow({ item, tab, onMarkDone, onEdit }) {
  const { record, info, action } = item;
  const needsOutcome = action.type === 'afterCall' && !action.call?.outcome;
  return (
    <li className="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div>
          <p className="text-base font-semibold text-slate-900">{record.company}</p>
          <p className="text-sm text-slate-700">
            {displayValue(record.contactPerson)}
            {record.email && <span className="break-all text-slate-500"> · {record.email}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionTag action={action} />
          {action.call && <CallOutcomeBadge outcome={action.call.outcome} />}
        </div>
        <p className="text-sm text-slate-600">{action.detail}</p>
        {action.call?.notes && <p className="text-sm italic text-slate-600">“{action.call.notes}”</p>}
        <p className="text-sm text-slate-500">Owner: {displayValue(record.owner)}</p>
      </div>
      <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-end">
        <p className={`text-sm ${tab.dueClass}`}>
          <span className="font-semibold">{formatDate(info.dueDate)}</span> · {describeDue(info)}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(record)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <Pencil aria-hidden="true" className="h-4 w-4" />
            Edit
            <span className="sr-only"> {record.company}</span>
          </button>
          {needsOutcome ? (
            <button
              type="button"
              onClick={() => onEdit(record)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <PhoneCall aria-hidden="true" className="h-4 w-4" />
              Add call outcome
              <span className="sr-only"> for {record.company}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onMarkDone(record, action)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-50"
            >
              <Check aria-hidden="true" className="h-4 w-4" />
              {doneLabel(action.type)}
              <span className="sr-only"> for {record.company}</span>
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function FollowUpTabs({
  groups,
  activeTab,
  onTabChange,
  actionFilter,
  onActionFilterChange,
  onMarkDone,
  onEdit,
  loading,
  error,
  onRetry,
}) {
  const tabRefs = useRef({});
  const [announcement, setAnnouncement] = useState('');
  const active = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  // Attach the recommended action to every item once.
  const withActions = Object.fromEntries(
    TABS.map((t) => [t.key, (groups[t.key] ?? []).map((i) => ({ ...i, action: getRecommendedAction(i.record) }))])
  );
  const matches = (i) => actionFilter === 'all' || i.action.type === actionFilter;
  const items = withActions[active.key].filter(matches);
  const tabItemsAll = withActions[active.key];

  // Kind-of-action chips, with counts for the current tab.
  const chips = [
    ['all', 'All', tabItemsAll.length],
    ...Object.entries(ACTION_TYPES).map(([type, meta]) => [type, meta.label, tabItemsAll.filter((i) => i.action.type === type).length]),
  ].filter(([type, , count]) => type === 'all' || count > 0 || type === actionFilter);

  const onKeyDown = (e) => {
    const i = TABS.findIndex((t) => t.key === active.key);
    const moves = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = TABS[(moves[e.key] + TABS.length) % TABS.length];
    onTabChange(next.key);
    tabRefs.current[next.key]?.focus();
  };

  const handleMarkDone = (record, action) => {
    onMarkDone(record.id, action.type);
    setAnnouncement(
      action.type === 'call'
        ? `Call with ${record.company} marked as done. Use “Add call outcome” to write down how it went.`
        : `Marked done for ${record.company}. Next follow-up in ${SETTINGS.daysUntilNextFollowUp} days.`
    );
  };

  let body;
  if (loading) body = <SkeletonRows rows={4} className="h-24" />;
  else if (error) body = <ErrorState onRetry={onRetry} />;
  else if (items.length === 0) {
    const filtered = actionFilter !== 'all' && tabItemsAll.length > 0;
    body = (
      <EmptyState
        icon={CalendarCheck}
        title={filtered ? `No “${ACTION_TYPES[actionFilter].label}” follow-ups here` : active.empty[0]}
        message={filtered ? 'Pick “All” or another tab to see more.' : active.empty[1]}
      />
    );
  } else
    body = (
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <FollowUpRow key={item.record.id} item={item} tab={active} onMarkDone={handleMarkDone} onEdit={onEdit} />
        ))}
      </ul>
    );

  return (
    <Section id="follow-ups" title="Follow-ups" description="Who to contact again, when, and how: email, LinkedIn, a call, or acting on a call we already had.">
      <div
        role="tablist"
        aria-label="Follow-ups by date"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-4"
      >
        {TABS.map((tab) => {
          const selected = tab.key === active.key;
          return (
            <button
              key={tab.key}
              ref={(el) => (tabRefs.current[tab.key] = el)}
              id={`tab-${tab.key}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="follow-ups-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-base font-medium transition ${
                selected ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
              {!loading && !error && (
                <span className={`rounded-full px-2 py-0.5 text-sm font-semibold ${tab.countClass}`}>
                  {withActions[tab.key].filter(matches).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!loading && !error && (
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-slate-700">Type of follow-up</legend>
          <div className="flex flex-wrap gap-2">
            {chips.map(([type, label, count]) => {
              const selected = actionFilter === type;
              const Icon = ACTION_ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onActionFilterChange(type)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
                    selected ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {Icon && <Icon aria-hidden="true" className="h-4 w-4" />}
                  {label}
                  <span className={selected ? 'text-indigo-100' : 'text-slate-500'}>{count}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div id="follow-ups-panel" role="tabpanel" aria-labelledby={`tab-${active.key}`} className="mt-4">
        {body}
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </Section>
  );
}
