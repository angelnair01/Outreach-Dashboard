import { Skeleton } from './Skeleton.jsx';

const ICON_TONES = {
  indigo: 'bg-indigo-50 text-indigo-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-rose-50 text-rose-600',
  gray: 'bg-slate-100 text-slate-600',
};

/** One headline number with an icon and a one-line explanation. */
export default function StatCard({ icon: Icon, label, value, subtext, tone = 'indigo', loading, error }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ICON_TONES[tone]}`}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <h3 className="text-base font-medium leading-snug text-slate-700">{label}</h3>
      </div>
      {loading ? (
        <div className="mt-4 space-y-2" aria-hidden="true">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-4 w-36" />
        </div>
      ) : error ? (
        <>
          <p className="mt-4 text-4xl font-bold text-slate-300">-</p>
          <p className="mt-1 text-sm text-slate-600">Couldn’t load</p>
        </>
      ) : (
        <>
          <p className="mt-4 text-4xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-sm text-slate-600">{subtext}</p>
        </>
      )}
    </div>
  );
}
