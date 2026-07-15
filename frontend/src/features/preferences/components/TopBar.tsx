import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../../stores/useUiStore';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSelector } from './LanguageSelector';

export function TopBar(): JSX.Element {
  const { t } = useTranslation('common');
  const theme = useUiStore((s) => s.theme);
  const language = useUiStore((s) => s.language);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const setLanguage = useUiStore((s) => s.setLanguage);

  return (
    // data-chat-keep-open: these are global app-chrome controls, not the call area — clicking the
    // theme toggle or language selector must not trigger the chat panel's outside-click-close.
    <div data-chat-keep-open className="fixed right-4 top-4 z-50 flex items-center gap-2">
      <LanguageSelector
        language={language}
        onChange={setLanguage}
        groupLabel={t('language')}
      />
      <ThemeToggle
        theme={theme}
        onToggle={toggleTheme}
        label={theme === 'dark' ? t('themeSwitchToLight') : t('themeSwitchToDark')}
      />
    </div>
  );
}
