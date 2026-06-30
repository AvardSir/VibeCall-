import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../shared/i18n';
import { useMediaStore } from '../../../stores/useMediaStore';

const setMicEnabled = vi.fn().mockResolvedValue(undefined);
const setCamEnabled = vi.fn().mockResolvedValue(undefined);

vi.mock('@livekit/components-react', () => ({
  useLocalParticipant: () => ({
    localParticipant: { setMicrophoneEnabled: setMicEnabled, setCameraEnabled: setCamEnabled },
  }),
}));

import { ControlsBar } from './ControlsBar';

beforeEach(() => {
  useMediaStore.getState().reset();
  setMicEnabled.mockClear();
  setCamEnabled.mockClear();
});

describe('ControlsBar', () => {
  it('fires onLeave when Leave is clicked', () => {
    const onLeave = vi.fn();
    render(<ControlsBar onLeave={onLeave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('reconciles mic state to the published track when toggled', () => {
    render(<ControlsBar onLeave={vi.fn()} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Microphone' }));
    expect(setMicEnabled).toHaveBeenLastCalledWith(false);
  });
});
