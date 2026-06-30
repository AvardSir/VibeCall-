import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from './useUiStore';

describe('useUiStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useUiStore.setState({ theme: 'dark', language: 'en' });
  });

  it('defaults to dark theme and english', () => {
    expect(useUiStore.getState().theme).toBe('dark');
    expect(useUiStore.getState().language).toBe('en');
  });

  it('toggleTheme flips between dark and light', () => {
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe('light');
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe('dark');
  });

  it('setLanguage updates the language', () => {
    useUiStore.getState().setLanguage('ru');
    expect(useUiStore.getState().language).toBe('ru');
  });

  it('persists theme and language to sessionStorage', () => {
    useUiStore.getState().setTheme('light');
    useUiStore.getState().setLanguage('ru');
    const raw = sessionStorage.getItem('kmb-ui');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { state: { theme: string; language: string } };
    expect(parsed.state.theme).toBe('light');
    expect(parsed.state.language).toBe('ru');
  });
});
