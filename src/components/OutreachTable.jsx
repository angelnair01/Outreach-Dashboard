import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Search, Users, X } from 'lucide-react';
import Section from './Section.jsx';
import { SkeletonRows } from './Skeleton.jsx';
import EmptyState, { ErrorState } from './EmptyState.jsx';
import { CallOutcomeBadge, FundingStatusBadge, NeedsDetailsTag, RepliedBadge } from './StatusBadge.jsx';
import { getRecommendedAction } from '../utils/actions.js';
import { FUNDING_STATUS, REACHING_OUT_FOR } from '../config/lists.js';
import { SETTINGS } from '../config/settings.js';
import { formatDate, parseDate } from '../utils/dates.js';
import { describeDue, getFollowUpInfo } from '../utils/followUps.js';
import { displayValue, needsDetails } from '../utils/records.js';

export const DEFAULT_TABLE_FILTERS = {
  reachingOutFor: 'all',
  fundingStatus: 'all',
  owner: 'all',
  replied: 'all',
  needsDetails: false,
};

const COLUMNS = [
  { key: 'company', label: 'Company / contact', sortable: true },
  { key: 'reachingOutFor', label: 'Reaching out for', sortable: true },
  { key: 'lastOutreachDate', label: 'Last outreach', sortable: true },
  { key: 'nextStep', label: 'Next action', sortable: true },
  { key: 'callDate', label: 'Call', sortable: true },
  { key: 'nextFollowUpDate', label: 'Follow-up date', sortable: true },
  { key: 'replied', label: 'Replied', sortable: true },
  { key: 'fundingStatus', label: 'Funding status', sortable: true },
  { key: 'owner', label: 'Owner', sortable: true },
];

const DATE_KEYS = new Set(['lastOutreachDate', 'nextFollowUpDate', 'callDate']);

/** Compare two records for a column. Blank values always sort to the bottom. */
function compare(a, b, key, dir) {
  let va = a[key];
  let vb = b[key];
  if (DATE_KEYS.has(key)) {
    va = parseDate(va)?.getTime() ?? null;
    vb = parseDate(vb)?.getTime() ?? null;
  } else if (key === 'fundingStatus') {
    va = va ? FUNDING_STATUS.indexOf(va) : null;
    vb = vb ? FUNDING_STATUS.indexOf(vb) : null;
  } else if (key === 'replied') {
    va = va ? 1 : 0;
    vb = vb ? 1 : 0;
  }
  const blankA = va === null || va === undefined || va === '';
  const blankB = vb === null || vb === undefined || vb === '';
  if (blankA || blankB) return blankA === blankB ? 0 : blankA ? 1 : -1;
  const result = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
  return dir === 'asc' ? result : -result;
}

function SortHeader({ column, sort, onSort }) {
  const active = sort.key === column.key;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="whitespace-nowrap px-4 py-3 text-left"
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900"
      >
        {column.label}
        <Icon aria-hidden="true" className={`h-4 w-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
      </button>
    </th>
  );
}

function FilterSelect({ id, label, value, onChange, options }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function OutreachTable({ records, owners, filters, onFiltersChange, onEdit, loading, error, onRetry }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'nextFollowUpDate', dir: 'asc' });
  const [visible, setVisible] = useState(SETTINGS.tablePageSize);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records
      .filter((r) => filters.reachingOutFor === 'all' || r.reachingOutFor === filters.reachingOutFor)
      .filter((r) => filters.fundingStatus === 'all' || r.fundingStatus === filters.fundingStatus)
      .filter((r) => filters.owner === 'all' || r.owner === filters.owner)
      .filter((r) => filters.replied === 'all' || (filters.replied === 'yes') === Boolean(r.replied))
      .filter((r) => !filters.needsDetails || needsDetails(r))
      .filter(
        (r) =>
          !q ||
          [r.company, r.contactPerson, r.email, r.designation, r.notes].some((v) => v && v.toLowerCase().includes(q))
      )
      .sort((a, b) => compare(a, b, sort.key, sort.dir));
  }, [records, filters, query, sort]);

  const setFilter = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
    setVisible(SETTINGS.tablePageSize);
  };
  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const anyFilter = query || Object.keys(DEFAULT_TABLE_FILTERS).some((k) => filters[k] !== DEFAULT_TABLE_FILTERS[k]);
  const clearAll = () => {
    setQuery('');
    onFiltersChange(DEFAULT_TABLE_FILTERS);
    setVisible(SETTINGS.tablePageSize);
  };

  const shown = rows.slice(0, visible);

  let body;
  if (loading) body = <SkeletonRows rows={6} className="h-12" />;
  else if (error) body = <ErrorState onRetry={onRetry} />;
  else if (rows.length === 0)
    body = (
      <EmptyState
        icon={Users}
        title={records.length === 0 ? 'No contacts yet' : 'No contacts match'}
        message={records.length === 0 ? 'Contacts will appear here once outreach starts.' : 'Try a different search or clear the filters.'}
      />
    );
  else
    body = (
      <>
        <p className="mb-2 text-sm text-slate-500 md:hidden">Swipe sideways to see all columns →</p>
        <div className="-mx-5 overflow-x-auto sm:mx-0 sm:rounded-xl sm:ring-1 sm:ring-slate-200" tabIndex={0} role="region" aria-label="Outreach table, scrollable">
          <table className="w-full min-w-[1260px] text-base">
            <caption className="sr-only">All outreach contacts. Column headers are buttons that sort the table.</caption>
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {COLUMNS.map((c) => (
                  <SortHeader key={c.key} column={c} sort={sort} onSort={onSort} />
                ))}
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r) => {
                const info = getFollowUpInfo(r);
                const dueClass =
                  info?.group === 'overdue' ? 'text-rose-700 font-medium' : info?.group === 'today' || info?.group === 'next7' ? 'text-amber-800' : 'text-slate-700';
                return (
                  <tr key={r.id} className="align-top hover:bg-slate-50">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <span className="block font-semibold text-slate-900">{r.company}</span>
                      <span className="block text-sm text-slate-700">
                        {displayValue(r.contactPerson)}
                        {r.designation && <span className="text-slate-500"> · {r.designation}</span>}
                      </span>
                      {r.email && <span className="block break-all text-sm text-slate-500">{r.email}</span>}
                      {needsDetails(r) && (
                        <span className="mt-1.5 block">
                          <NeedsDetailsTag />
                        </span>
                      )}
                    </th>
                    <td className="px-4 py-3 text-sm text-slate-700">{displayValue(r.reachingOutFor)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatDate(r.lastOutreachDate)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {info ? (
                        <>
                          <span className="block font-medium text-slate-900">{getRecommendedAction(r).label}</span>
                          <span className="block text-xs text-slate-500">Planned: {displayValue(r.nextStep)}</span>
                        </>
                      ) : (
                        displayValue(r.nextStep)
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {r.callDone ? (
                        <>
                          <CallOutcomeBadge outcome={r.callOutcome} />
                          <span className="mt-1 block text-xs text-slate-500">{formatDate(r.callDate)}</span>
                        </>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 text-sm ${dueClass}`}>
                      {formatDate(r.nextFollowUpDate)}
                      {info && <span className="block text-xs">{describeDue(info)}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <RepliedBadge replied={r.replied} />
                    </td>
                    <td className="px-4 py-3">
                      <FundingStatusBadge value={r.fundingStatus} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{displayValue(r.owner)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onEdit(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                        Edit
                        <span className="sr-only"> {r.company || r.contactPerson}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-sm text-slate-600" aria-live="polite">
            Showing {shown.length} of {rows.length} contacts
          </p>
          {shown.length < rows.length && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + SETTINGS.tablePageSize)}
              className="rounded-xl px-4 py-2 text-base font-semibold text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-50"
            >
              Show more
            </button>
          )}
        </div>
      </>
    );

  return (
    <Section id="all-outreach" title="All outreach" description="Every contact. Search, filter, or click a column title to sort.">
      <div className="mb-4 space-y-3">
        <div className="relative">
          <label htmlFor="outreach-search" className="sr-only">
            Search by company, name, email or notes
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="outreach-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(SETTINGS.tablePageSize);
            }}
            placeholder="Search by company, name, email or notes"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            id="filter-reason"
            label="Reaching out for"
            value={filters.reachingOutFor}
            onChange={(v) => setFilter('reachingOutFor', v)}
            options={[['all', 'All'], ...REACHING_OUT_FOR.map((v) => [v, v])]}
          />
          <FilterSelect
            id="filter-funding"
            label="Funding status"
            value={filters.fundingStatus}
            onChange={(v) => setFilter('fundingStatus', v)}
            options={[['all', 'All'], ...FUNDING_STATUS.map((v) => [v, v])]}
          />
          <FilterSelect
            id="filter-owner"
            label="Owner"
            value={filters.owner}
            onChange={(v) => setFilter('owner', v)}
            options={[['all', 'Everyone'], ...owners.map((v) => [v, v])]}
          />
          <FilterSelect
            id="filter-replied"
            label="Replied"
            value={filters.replied}
            onChange={(v) => setFilter('replied', v)}
            options={[
              ['all', 'All'],
              ['yes', 'Replied'],
              ['no', 'No reply yet'],
            ]}
          />
        </div>
        {anyFilter && (
          <div className="flex flex-wrap items-center gap-2">
            {filters.needsDetails && (
              <button
                type="button"
                onClick={() => setFilter('needsDetails', false)}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
              >
                Only rows that need details
                <X aria-hidden="true" className="h-4 w-4" />
                <span className="sr-only">(remove this filter)</span>
              </button>
            )}
            <button type="button" onClick={clearAll} className="text-sm font-semibold text-indigo-700 underline-offset-2 hover:underline">
              Clear all filters
            </button>
          </div>
        )}
      </div>
      {body}
    </Section>
  );
}
