import { Skeleton } from './Skeleton.jsx';

/** Small horizontal-bar list: what we're reaching out for. */
export default function ReasonBreakdown({ data, loading, error }) {
  if (error) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-slate-900">What we’re reaching out for</h3>
      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
      ) : (
        <ul className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {data.map((d) => (
            <li key={d.reason}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-slate-800">{d.reason}</span>
                <span className="whitespace-nowrap font-semibold text-slate-900">
                  {d.count} <span className="font-normal text-slate-500">({d.percent}%)</span>
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100" aria-hidden="true">
                <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(d.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
