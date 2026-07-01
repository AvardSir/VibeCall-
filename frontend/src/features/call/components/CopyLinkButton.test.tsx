import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '../../../shared/i18n';
import { CopyLinkButton } from './CopyLinkButton';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('CopyLinkButton', () => {
  it('copies the url and confirms for 2 seconds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<CopyLinkButton url="https://app/r/r1" />);
    // Click and let the resolved promise flush state updates
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy link/i }));
    });
    expect(writeText).toHaveBeenCalledWith('https://app/r/r1');
    expect(screen.getByText('Link copied!')).toBeInTheDocument();
    // Advance past the 2s revert timer and flush resulting state update
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText('Link copied!')).not.toBeInTheDocument();
  });

  it('shows a fallback with the selectable url when clipboard is denied', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<CopyLinkButton url="https://app/r/r1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy link/i }));
    });
    expect(screen.getByText(/Unable to copy/i)).toBeInTheDocument();
    expect(screen.getByText('https://app/r/r1')).toBeInTheDocument();
  });
});
