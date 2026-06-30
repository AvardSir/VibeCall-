import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../shared/i18n';
import { PreJoinScreen } from './PreJoinScreen';
import { useMediaStore } from '../../stores/useMediaStore';

function fakeStream(): MediaStream {
  return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
}

beforeEach(() => {
  useMediaStore.getState().reset();
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) },
  });
});

describe('PreJoinScreen', () => {
  it('disables Enter call until the name is valid', async () => {
    render(<PreJoinScreen onEnter={vi.fn()} />);
    const button = screen.getByRole('button', { name: /enter call/i });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('calls onEnter with the trimmed name', async () => {
    const onEnter = vi.fn();
    render(<PreJoinScreen onEnter={onEnter} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: '  Ann  ' } });
    fireEvent.click(screen.getByRole('button', { name: /enter call/i }));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith('Ann'));
  });
});
