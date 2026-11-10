import { RefreshCw } from 'lucide-react';
import { timeAgo } from '../utils/dates.js';

export default function Header({ lastSynced, now, onRefresh, refreshing, loading }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">OpenGrad Outreach</h1>
        <p className="mt-1 text-base text-slate-600">
          {loading ? 'Loading…' : lastSynced ? `Last synced: ${timeAgo(lastSynced, now)}` : 'Not synced yet'}
        </p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading || refreshing}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <RefreshCw aria-hidden="true" className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
        <span aria-live="polite">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
      </button>
    </header>
  );
}
