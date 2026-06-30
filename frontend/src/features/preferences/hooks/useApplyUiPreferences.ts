import { useEffect } from 'react';
import i18n from '../../../shared/i18n';
import { useUiStore } from '../../../stores/useUiStore';

/**
 * Mirrors the persisted UI preferences to the DOM and i18next:
 * - theme  -> `dark` class on <html> (Tailwind class-based dark variant)
 * - language -> i18next active language
 * Mount once near the app root so the effects run for every screen.
 */
export function useApplyUiPreferences(): void {
  const theme = useUiStore((s) => s.theme);
  const language = useUiStore((s) => s.language);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [language]);
}
