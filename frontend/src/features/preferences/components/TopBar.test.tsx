import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../shared/i18n';
import { TopBar } from './TopBar';
import { useUiStore } from '../../../stores/useUiStore';

describe('TopBar', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useUiStore.setState({ theme: 'dark', language: 'en' });
  });

  it('renders theme and language controls', () => {
    render(<TopBar />);
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /english/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /russian/i })).toBeInTheDocument();
  });

  it('toggles the store theme when the theme button is clicked', () => {
    render(<TopBar />);
    fireEvent.click(screen.getByRole('button', { name: /switch to light theme/i }));
    expect(useUiStore.getState().theme).toBe('light');
  });

  it('sets the store language when a language button is clicked', () => {
    render(<TopBar />);
    fireEvent.click(screen.getByRole('button', { name: /russian/i }));
    expect(useUiStore.getState().language).toBe('ru');
  });
});
