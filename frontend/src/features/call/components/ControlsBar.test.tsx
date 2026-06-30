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

  it('shows state-aware tooltips on the camera and mic toggles', () => {
    render(<ControlsBar onLeave={vi.fn()} />);
    // Defaults: mic on, camera on → tooltips offer the "turn off / mute" action.
    expect(screen.getByRole('switch', { name: 'Camera' })).toHaveAttribute('title', 'Turn camera off');
    expect(screen.getByRole('switch', { name: 'Microphone' })).toHaveAttribute('title', 'Mute microphone');
    // Toggle the mic off → tooltip flips to the "unmute" action.
    fireEvent.click(screen.getByRole('switch', { name: 'Microphone' }));
    expect(screen.getByRole('switch', { name: 'Microphone' })).toHaveAttribute('title', 'Unmute microphone');
  });

  it('shows a tooltip on the Leave button', () => {
    render(<ControlsBar onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Leave' })).toHaveAttribute('title', 'Leave the call');
  });
});
