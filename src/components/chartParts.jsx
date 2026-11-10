/** Shared bits for the charts: colors, tooltip, card frame and a screen-reader table. */
import { BarChart3 } from 'lucide-react';
import { Skeleton } from './Skeleton.jsx';
import EmptyState, { ErrorState } from './EmptyState.jsx';

export const CHART_COLORS = {
  bar: '#4f46e5', // indigo-600
  grid: '#e2e8f0', // slate-200
  axis: '#475569', // slate-600
  cursor: '#eef2ff', // indigo-50
};

export function ChartTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-md ring-1 ring-slate-200">
      <p className="font-medium text-slate-900">{label}</p>
      {format(payload[0].payload).map((line) => (
        <p key={line} className="text-slate-700">{line}</p>
      ))}
    </div>
  );
}

export function SrTable({ caption, headers, rows }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} scope="col">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChartCard({ title, description, loading, error, onRetry, isEmpty, children }) {
  let body;
  if (loading) body = <Skeleton className="h-64" />;
  else if (error) body = <ErrorState onRetry={onRetry} />;
  else if (isEmpty) body = <EmptyState icon={BarChart3} title="No data yet" message="This chart fills in once outreach starts." />;
  else body = children;
  return (
    <figure className="min-w-0 rounded-xl p-4 ring-1 ring-slate-200 sm:p-5">
      <figcaption>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{description}</p>
      </figcaption>
      <div className="mt-4">{body}</div>
    </figure>
  );
}
