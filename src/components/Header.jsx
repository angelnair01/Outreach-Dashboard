import { Plug, Plus, RefreshCw } from 'lucide-react';
import { timeAgo } from '../utils/dates.js';

export default function Header({ lastSynced, now, mode, onRefresh, onAdd, onConnect, refreshing, loading }) {
  const live = mode === 'live';
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">OpenGrad Outreach</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-slate-600">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset ${
              live ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20' : 'bg-slate-100 text-slate-700 ring-slate-500/20'
            }`}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {live ? 'Live: Google Sheet + Gmail' : 'Demo data'}
          </span>
          <span>{loading ? 'Loading…' : lastSynced ? `Last synced: ${timeAgo(lastSynced, now)}` : 'Not synced yet'}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-70"
        >
          <Plus aria-hidden="true" className="h-5 w-5" />
          Add contact
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-base font-semibold text-slate-800 shadow-sm ring-1 ring-slate-300 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <RefreshCw aria-hidden="true" className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          <span aria-live="polite">{refreshing ? 'Syncing…' : live ? 'Sync Gmail' : 'Refresh'}</span>
        </button>
        <button
          type="button"
          onClick={onConnect}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-base font-semibold text-slate-800 shadow-sm ring-1 ring-slate-300 transition hover:bg-slate-50"
        >
          <Plug aria-hidden="true" className="h-5 w-5" />
          {live ? 'Connection' : 'Connect'}
        </button>
      </div>
    </header>
  );
}
