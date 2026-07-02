import { useId } from 'react';
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
  const inputId = useId();
  const hintId = useId();

  return (
    <div className="flex w-[332px] flex-col items-start gap-2">
      {/* Label kept for accessibility only — Figma shows just the placeholder. Associated by id (not
          by wrapping) so the requirement hint/error below is a description, not part of the name. */}
      <label htmlFor={inputId} className="sr-only">{t('nameLabel')}</label>
      <input
        id={inputId}
        aria-describedby={hintId}
        value={value}
        maxLength={30}
        placeholder={t('namePlaceholder')}
        onChange={(e) => onChange(e.target.value)}
        className={`w-[332px] rounded-[11px] bg-slate-200 px-3 py-3.5 text-base font-light text-slate-900 outline-none placeholder:text-slate-400 dark:bg-surface-muted dark:text-white dark:placeholder:text-white/25 ${
          showInlineError ? 'border border-danger' : 'border border-transparent focus:border-accent'
        }`}
      />
      {showInlineError ? (
        <span id={hintId} className="flex items-start gap-1 text-sm font-light leading-[18px] text-danger">
          <span aria-hidden="true">*</span>
          <span>{t(errorKey)}</span>
        </span>
      ) : (
        // Persistent requirement hint so the rules are visible up front; the specific validation
        // error (empty / length / chars) replaces it after an invalid Join/Enter-call submit.
        <span id={hintId} className="text-sm font-light leading-[18px] text-text-muted">{t('nameHelp')}</span>
      )}
    </div>
  );
}
