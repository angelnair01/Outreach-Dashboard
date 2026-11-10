import { useCallback, useEffect, useState } from 'react';
import { getOutreachData } from '../services/dataSource.js';
import { markFollowUpDone } from '../utils/followUps.js';

/** Loads the data and exposes refresh + a local-only "Mark done". */
export function useOutreach() {
  const [records, setRecords] = useState([]);
  const [lastSynced, setLastSynced] = useState(null);
  const [loading, setLoading] = useState(true); // first load -> skeletons
  const [refreshing, setRefreshing] = useState(false); // later reloads -> spinner
  const [error, setError] = useState(null);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const data = await getOutreachData();
      setRecords(Array.isArray(data?.records) ? data.records : []);
      setLastSynced(data?.lastSynced ?? new Date().toISOString());
    } catch (err) {
      setError(err?.message || 'Something went wrong while loading the data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  // Local only for now: the change is lost on refresh.
  const markDone = useCallback((id, actionType) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? markFollowUpDone(r, actionType) : r)));
  }, []);

  return { records, lastSynced, loading, refreshing, error, refresh, markDone };
}
