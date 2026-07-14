import type { JSX } from 'react';

type Language = 'en' | 'ru';

export type LanguageSelectorProps = {
  language: Language;
  groupLabel: string;
  onChange: (language: Language) => void;
};

export function LanguageSelector({ language, groupLabel, onChange }: LanguageSelectorProps): JSX.Element {
  return (
    <div role="group" aria-label={groupLabel} className="flex items-center gap-0.5 rounded-full bg-black/5 p-0.5 dark:bg-white/10">
      <LanguageButton code="en" text="EN" active={language === 'en'} onClick={onChange} />
      <LanguageButton code="ru" text="RU" active={language === 'ru'} onClick={onChange} />
    </div>
  );
}

type LanguageButtonProps = {
  code: Language;
  text: string;
  active: boolean;
  onClick: (language: Language) => void;
};

function LanguageButton({ code, text, active, onClick }: LanguageButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onClick(code)}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
        active ? 'bg-accent text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
      }`}
    >
      {text}
    </button>
  );
}
