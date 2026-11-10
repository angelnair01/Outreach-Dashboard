import { CloudOff, Inbox, RefreshCw } from 'lucide-react';

/** Friendly message when a section has nothing to show. */
export default function EmptyState({ icon: Icon = Inbox, title, message }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
      <Icon aria-hidden="true" className="h-8 w-8 text-slate-400" />
      <p className="mt-3 text-base font-medium text-slate-800">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-600">{message}</p>}
    </div>
  );
}

/** Friendly message when the data couldn't be loaded. */
export function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-rose-50/60 px-6 py-10 text-center ring-1 ring-rose-100">
      <CloudOff aria-hidden="true" className="h-8 w-8 text-rose-500" />
      <p className="mt-3 text-base font-medium text-slate-800">We couldn’t load this right now</p>
      <p className="mt-1 max-w-sm text-sm text-slate-600">Check your connection and try again.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-slate-200 hover:bg-indigo-50"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Try again
        </button>
      )}
    </div>
  );
}
