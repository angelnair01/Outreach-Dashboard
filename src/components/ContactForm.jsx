import { useEffect, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from './Modal.jsx';
import {
  CALL_OUTCOMES,
  FUNDING_STATUS,
  INTERESTED_IN_FUNDING,
  NEXT_STEPS,
  REACHING_OUT_FOR,
} from '../config/lists.js';
import { toDateString, today } from '../utils/dates.js';
import { diffRecord, newContact, prepareContact, toFormValues, validateContact } from '../utils/contactForm.js';

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50';

function Field({ label, error, hint, children, id, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <fieldset className="rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-base font-semibold text-slate-900">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** Add a new contact, or edit one (including logging a call and its outcome). */
export default function ContactForm({ open, record, owners, onClose, onSave }) {
  const uid = useId();
  const isEdit = Boolean(record);
  const [values, setValues] = useState(() => (record ? toFormValues(record) : newContact()));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Reset the form whenever it opens.
  useEffect(() => {
    if (!open) return;
    setValues(record ? toFormValues(record) : newContact());
    setErrors({});
    setSaveError('');
    setSaving(false);
  }, [open, record]);

  const id = (name) => `${uid}-${name}`;
  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  /** Ticking a box fills its date with today if empty. */
  const toggle = (name, dateName) => (e) => {
    const checked = e.target.checked;
    setValues((v) => ({ ...v, [name]: checked, ...(checked && !v[dateName] ? { [dateName]: toDateString(today()) } : {}) }));
  };

  const text = (name, props = {}) => ({
    id: id(name),
    value: values[name] ?? '',
    onChange: (e) => set(name, e.target.value),
    className: inputClass,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${id(name)}-error` : undefined,
    ...props,
  });

  const select = (name, options, blankLabel) => (
    <select {...text(name)}>
      {blankLabel !== undefined && <option value="">{blankLabel}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );

  const check = (name, dateName, label) => (
    <label className="flex items-center gap-2.5 text-base text-slate-800 sm:col-span-2">
      <input
        type="checkbox"
        checked={Boolean(values[name])}
        onChange={toggle(name, dateName)}
        className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      {label}
    </label>
  );

  const submit = async (e) => {
    e.preventDefault();
    const found = validateContact(values);
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(id(Object.keys(found)[0]))?.focus();
      return;
    }
    const cleaned = prepareContact(values);
    setSaving(true);
    setSaveError('');
    try {
      if (isEdit) {
        const changes = diffRecord(record, cleaned);
        if (Object.keys(changes).length) await onSave(changes);
      } else {
        await onSave(cleaned);
      }
      onClose();
    } catch (err) {
      setSaveError(err?.message || 'Couldn’t save. Please try again.');
      setSaving(false);
    }
  };

  const title = isEdit ? `Edit ${record.company || record.contactPerson}` : 'Add a contact';

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      wide
      title={title}
      description={isEdit ? 'Update details, log a call, or change the next step.' : 'Only a company or a name is required. You can fill in the rest later.'}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          {saveError && (
            <p role="alert" className="text-sm text-rose-700 sm:mr-auto">
              {saveError}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-4 py-2.5 text-base font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={id('form')}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
          >
            {saving && <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />}
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add contact'}
          </button>
        </div>
      }
    >
      <form id={id('form')} onSubmit={submit} noValidate className="space-y-5">
        <Group title="Who">
          <Field id={id('company')} label="Company / organisation" error={errors.company}>
            <input {...text('company', { autoComplete: 'organization', placeholder: 'e.g. Kaveri Power Ltd' })} />
          </Field>
          <Field id={id('contactPerson')} label="Contact person">
            <input {...text('contactPerson', { autoComplete: 'name' })} />
          </Field>
          <Field id={id('designation')} label="Designation">
            <input {...text('designation', { placeholder: 'e.g. Head of CSR' })} />
          </Field>
          <Field id={id('email')} label="Email" error={errors.email} hint="Used to match Gmail messages automatically.">
            <input {...text('email', { type: 'email', autoComplete: 'email', inputMode: 'email' })} />
          </Field>
          <Field id={id('linkedinProfile')} label="LinkedIn profile">
            <input {...text('linkedinProfile', { placeholder: 'linkedin.com/in/…' })} />
          </Field>
          <Field id={id('reachingOutFor')} label="Reaching out for">
            {select('reachingOutFor', REACHING_OUT_FOR)}
          </Field>
          <Field id={id('owner')} label="Owner (who on our team)">
            <input {...text('owner', { list: id('owners') })} />
            <datalist id={id('owners')}>
              {owners.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </Field>
        </Group>

        <Group title="Outreach so far">
          {check('emailSent', 'emailDate', 'Email sent')}
          {values.emailSent && (
            <Field id={id('emailDate')} label="First email date" error={errors.emailDate}>
              <input {...text('emailDate', { type: 'date' })} />
            </Field>
          )}
          {check('linkedinSent', 'linkedinDate', 'LinkedIn message / request sent')}
          {values.linkedinSent && (
            <Field id={id('linkedinDate')} label="LinkedIn date" error={errors.linkedinDate}>
              <input {...text('linkedinDate', { type: 'date' })} />
            </Field>
          )}
          <Field id={id('followUpsDone')} label="Follow-ups done" error={errors.followUpsDone}>
            <input {...text('followUpsDone', { type: 'number', min: 0, step: 1, inputMode: 'numeric' })} />
          </Field>
        </Group>

        <Group title="What’s next">
          <Field id={id('nextStep')} label="Next step">
            {select('nextStep', NEXT_STEPS, 'Not decided yet')}
          </Field>
          <Field id={id('nextFollowUpDate')} label="Next follow-up date">
            <input {...text('nextFollowUpDate', { type: 'date' })} />
          </Field>
        </Group>

        <Group title="Their response">
          {check('replied', 'replyDate', 'They replied')}
          {values.replied && (
            <Field id={id('replyDate')} label="Reply date" error={errors.replyDate}>
              <input {...text('replyDate', { type: 'date' })} />
            </Field>
          )}
          <Field id={id('interestedInFunding')} label="Interested in funding?">
            {select('interestedInFunding', INTERESTED_IN_FUNDING)}
          </Field>
          <Field id={id('fundingStatus')} label="Funding status">
            {select('fundingStatus', FUNDING_STATUS)}
          </Field>
        </Group>

        <Group title="Call">
          {check('callDone', 'callDate', 'We had a call')}
          {values.callDone && (
            <>
              <Field id={id('callDate')} label="Call date" error={errors.callDate}>
                <input {...text('callDate', { type: 'date' })} />
              </Field>
              <Field id={id('callOutcome')} label="How did it go?">
                {select('callOutcome', CALL_OUTCOMES, 'Not written down yet')}
              </Field>
              <Field id={id('callNotes')} label="Call notes" className="sm:col-span-2">
                <textarea {...text('callNotes', { rows: 3, placeholder: 'What did they say? What did we agree?' })} />
              </Field>
            </>
          )}
        </Group>

        <Field id={id('notes')} label="Other notes">
          <textarea {...text('notes', { rows: 3 })} />
        </Field>
      </form>
    </Modal>
  );
}
