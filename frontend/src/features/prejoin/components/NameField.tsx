import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { NameErrorKey } from '../hooks/useNameValidation';

export type NameFieldProps = {
  value: string;
  onChange: (value: string) => void;
  errorKey: NameErrorKey | null;
  showError: boolean;
};

export function NameField({ value, onChange, errorKey, showError }: NameFieldProps): JSX.Element {
  const { t } = useTranslation('prejoin');
  // Strip the namespace prefix so the key resolves within the 'prejoin' namespace.
  const bareKey = errorKey ? errorKey.replace('prejoin.', '') : null;

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-300">{t('nameLabel')}</span>
      <input
        value={value}
        maxLength={30}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-700 bg-surface-muted px-3 py-2 text-slate-100 outline-none focus:border-accent"
      />
      <span className="text-xs text-slate-500">{t('nameHelp')}</span>
      {showError && bareKey ? (
        <span className="text-xs text-red-400">{t(bareKey)}</span>
      ) : null}
    </label>
  );
}
