import { create } from 'zustand';

type Theme = 'dark' | 'light';
type Language = 'en' | 'ru';

type UiState = {
  theme: Theme;
  language: Language;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
};

export const useUiStore = create<UiState>()((set) => ({
  theme: 'dark',
  language: 'en',
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
}));
