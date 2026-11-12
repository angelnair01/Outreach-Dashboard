import { useEffect, useId, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import Modal from './Modal.jsx';
import { clearConnection, getConnection, isConnected, saveConnection } from '../services/connection.js';
import { testConnection } from '../services/dataSource.js';

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30';

/** Paste the Google Sheet's web app URL + access key. Saved in this browser only. */
export default function ConnectDialog({ open, onClose, onChanged }) {
  const uid = useId();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [status, setStatus] = useState({ state: 'idle', text: '' });
  const connected = isConnected();

  useEffect(() => {
    if (!open) return;
    const c = getConnection();
    setUrl(c.url || '');
    setKey(c.key || '');
    setStatus({ state: 'idle', text: '' });
  }, [open]);

  const connect = async (e) => {
    e.preventDefault();
    if (!url.trim() || !key.trim()) {
      setStatus({ state: 'error', text: 'Paste both the web app URL and the access key.' });
      return;
    }
    setStatus({ state: 'busy', text: 'Checking…' });
    try {
      const { count } = await testConnection(url, key);
      if (!saveConnection({ url, key })) throw new Error('This browser blocked saving the connection (private window?).');
      setStatus({ state: 'ok', text: `Connected — found ${count} contact${count === 1 ? '' : 's'}.` });
      onChanged();
      setTimeout(onClose, 900);
    } catch (err) {
      setStatus({ state: 'error', text: err.message });
    }
  };

  const disconnect = () => {
    clearConnection();
    onChanged();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect your Google Sheet"
      description="The sheet's script reads your Gmail and keeps the dashboard up to date. Setup steps: google-apps-script/SETUP.md in the project."
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {connected ? (
            <button type="button" onClick={disconnect} className="text-sm font-semibold text-rose-700 hover:underline">
              Disconnect (show demo data)
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            form={`${uid}-form`}
            disabled={status.state === 'busy'}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
          >
            {status.state === 'busy' && <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />}
            Test &amp; connect
          </button>
        </div>
      }
    >
      <form id={`${uid}-form`} onSubmit={connect} noValidate className="space-y-4">
        <div>
          <label htmlFor={`${uid}-url`} className="mb-1 block text-sm font-medium text-slate-700">
            Web app URL
          </label>
          <input
            id={`${uid}-url`}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-key`} className="mb-1 block text-sm font-medium text-slate-700">
            Access key
          </label>
          <input
            id={`${uid}-key`}
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="From the sheet: Outreach dashboard → Show access key"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">Saved only in this browser. Never put it in the code or on GitHub.</p>
        </div>
        <p
          role={status.state === 'error' ? 'alert' : 'status'}
          className={`min-h-[1.25rem] text-sm ${
            status.state === 'error' ? 'text-rose-700' : status.state === 'ok' ? 'text-emerald-700' : 'text-slate-600'
          }`}
        >
          {status.state === 'ok' && <CheckCircle2 aria-hidden="true" className="mr-1 inline h-4 w-4" />}
          {status.text}
        </p>
      </form>
    </Modal>
  );
}
