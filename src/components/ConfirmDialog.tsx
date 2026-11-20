import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  details?: Array<{ label: string; value: string }>;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  details,
  confirmLabel,
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="confirm-dialog-title"
              className="text-base font-semibold text-neutral-950"
            >
              {title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close confirmation dialog"
            className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-neutral-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {details && details.length > 0 && (
          <dl className="mt-4 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-neutral-50">
            {details.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 px-3.5 py-2.5 text-xs">
                <dt className="font-medium text-neutral-500 shrink-0">{row.label}</dt>
                <dd className="text-right text-neutral-950 break-words max-w-[320px]">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-neutral-950 whitespace-nowrap shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-neutral-950 whitespace-nowrap shrink-0"
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
