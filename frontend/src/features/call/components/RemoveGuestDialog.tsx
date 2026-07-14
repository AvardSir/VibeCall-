import { useEffect } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { Text } from '../../../shared/ui/Text';

export type RemoveGuestDialogProps = { name: string; onConfirm: () => void; onCancel: () => void };

export function RemoveGuestDialog({ name, onConfirm, onCancel }: RemoveGuestDialogProps): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  const { t } = useTranslation('roomStates');
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex flex-col gap-4 rounded-xl bg-surface-elevated p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <Text tag="h2" size="lg" weight="semibold" className="text-slate-100">
          {t('removeDialogTitle', { name })}
        </Text>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            {t('removeCancel')}
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition hover:bg-danger/90"
          >
            {t('removeConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
