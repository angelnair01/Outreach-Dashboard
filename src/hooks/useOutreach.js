import { useCallback, useEffect, useRef, useState } from 'react';
import { addContact as apiAdd, getOutreachData, updateContact as apiUpdate } from '../services/dataSource.js';
import { isConnected } from '../services/connection.js';
import { SETTINGS } from '../config/settings.js';
import { markFollowUpDone } from '../utils/followUps.js';
import { diffRecord } from '../utils/contactForm.js';

/** Loads the data, keeps it fresh, and saves adds / edits / "Mark done". */
export function useOutreach() {
  const [records, setRecords] = useState([]);
  const [lastSynced, setLastSynced] = useState(null);
  const [mode, setMode] = useState(isConnected() ? 'live' : 'demo');
  const [loading, setLoading] = useState(true); // first load -> skeletons
  const [refreshing, setRefreshing] = useState(false); // Sync button -> spinner
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // { tone: 'success' | 'error', text }

  const recordsRef = useRef(records);
  recordsRef.current = records;
  const inFlight = useRef(false);

  const load = useCallback(async ({ spinner = false, sync = false } = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (spinner) setRefreshing(true);
    try {
      const data = await getOutreachData({ sync });
      setRecords(Array.isArray(data.records) ? data.records : []);
      setLastSynced(data.lastSynced ?? new Date().toISOString());
      setMode(data.mode);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Something went wrong while loading the data.');
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Quietly re-read the data every few minutes while the page is open and visible.
  useEffect(() => {
    const ms = SETTINGS.autoRefreshMinutes * 60 * 1000;
    if (!ms) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, ms);
    return () => clearInterval(id);
  }, [load]);

  /** Sync button: asks the sheet to check Gmail, then reloads. */
  const refresh = useCallback(() => load({ spinner: true, sync: true }), [load]);

  /** After connecting / disconnecting: start over with skeletons. */
  const reload = useCallback(() => {
    setLoading(true);
    setRecords([]);
    return load();
  }, [load]);

  /** Save changes with an instant on-screen update; undo it if saving fails. */
  const saveChanges = useCallback(async (id, changes, successText) => {
    const before = recordsRef.current.find((r) => r.id === id);
    if (!before || Object.keys(changes).length === 0) return before;
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));
    try {
      const saved = await apiUpdate(id, changes);
      setRecords((prev) => prev.map((r) => (r.id === id ? saved : r)));
      if (successText) setNotice({ tone: 'success', text: successText });
      return saved;
    } catch (err) {
      setRecords((prev) => prev.map((r) => (r.id === id ? before : r)));
      setNotice({ tone: 'error', text: `Couldn’t save: ${err.message}` });
      throw err;
    }
  }, []);

  const markDone = useCallback(
    (id, actionType) => {
      const rec = recordsRef.current.find((r) => r.id === id);
      if (!rec) return;
      // When synced with Gmail, sent emails are counted automatically, so don't count them twice.
      const countFollowUp = !(mode === 'live' && actionType === 'email');
      const updated = markFollowUpDone(rec, actionType, { countFollowUp });
      saveChanges(id, diffRecord(rec, updated)).catch(() => {});
    },
    [mode, saveChanges]
  );

  const addContact = useCallback(async (record) => {
    const saved = await apiAdd(record);
    setRecords((prev) => [...prev, saved]);
    setNotice({ tone: 'success', text: `Added ${saved.company || saved.contactPerson}.` });
    return saved;
  }, []);

  const editContact = useCallback((id, changes) => saveChanges(id, changes, 'Changes saved.'), [saveChanges]);

  const clearNotice = useCallback(() => setNotice(null), []);

  return {
    records,
    lastSynced,
    mode,
    loading,
    refreshing,
    error,
    notice,
    clearNotice,
    refresh,
    reload,
    markDone,
    addContact,
    editContact,
  };
}
