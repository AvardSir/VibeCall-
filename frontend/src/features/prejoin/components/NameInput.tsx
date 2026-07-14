import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { NameErrorKey } from '../nameValidation';

export type NameInputProps = {
  value: string;
  onChange: (value: string) => void;
  errorKey: NameErrorKey | null;
  showError: boolean;
};

export function NameInput({ value, onChange, errorKey, showError }: NameInputProps): JSX.Element {
  const { t } = useTranslation('prejoin');
  const showInlineError = showError && errorKey !== null;

  return (
    <label className="flex w-[332px] flex-col items-start gap-2">
      {/* Label kept for accessibility only — Figma shows just the placeholder. */}
      <span className="sr-only">{t('nameLabel')}</span>
      <input
        value={value}
        maxLength={30}
        placeholder={t('namePlaceholder')}
        onChange={(e) => onChange(e.target.value)}
        className={`w-[332px] rounded-[11px] bg-slate-200 px-3 py-3.5 text-base font-light text-slate-900 outline-none placeholder:text-slate-400 dark:bg-surface-muted dark:text-white dark:placeholder:text-white/25 ${
          showInlineError ? 'border border-danger' : 'border border-transparent focus:border-accent'
        }`}
      />
      {showInlineError ? (
        <span className="flex items-start gap-1 text-sm font-light leading-[18px] text-danger">
          <span aria-hidden="true">*</span>
          <span>{t(errorKey)}</span>
        </span>
      ) : null}
    </label>
  );
}
