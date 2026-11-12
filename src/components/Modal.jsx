import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible pop-up window built on the native <dialog>: traps focus, closes on Esc,
 * and returns focus to the button that opened it.
 */
export default function Modal({ open, onClose, title, description, children, footer, wide = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the dimmed backdrop
      }}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40`}
    >
      {open && (
        <div className="flex max-h-[90vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 id="modal-title" className="text-xl font-semibold">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <X aria-hidden="true" className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && <div className="border-t border-slate-200 px-5 py-4 sm:px-6">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
