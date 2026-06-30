// frontend/src/features/preferences/hooks/useApplyUiPreferences.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApplyUiPreferences } from './useApplyUiPreferences';
import { useUiStore } from '../../../stores/useUiStore';
import i18n from '../../../shared/i18n';

describe('useApplyUiPreferences', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useUiStore.setState({ theme: 'dark', language: 'en' });
    document.documentElement.classList.remove('dark');
  });

  it('adds the dark class on <html> when theme is dark and removes it for light', () => {
    renderHook(() => useApplyUiPreferences());
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    act(() => useUiStore.getState().setTheme('light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('switches the i18n language when language changes', async () => {
    renderHook(() => useApplyUiPreferences());
    await act(async () => {
      useUiStore.getState().setLanguage('ru');
    });
    expect(i18n.language).toBe('ru');
  });
});
