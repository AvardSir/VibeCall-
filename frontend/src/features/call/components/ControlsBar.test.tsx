import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../shared/i18n';
import { useMediaStore } from '../../../stores/useMediaStore';
import type { ParticipantRole } from '../../../shared/types';

const setMicEnabled = vi.fn().mockResolvedValue(undefined);
const setCamEnabled = vi.fn().mockResolvedValue(undefined);

vi.mock('@livekit/components-react', () => ({
  useLocalParticipant: () => ({
    localParticipant: { setMicrophoneEnabled: setMicEnabled, setCameraEnabled: setCamEnabled },
  }),
}));

import { ControlsBar } from './ControlsBar';

type RenderOptions = {
  onLeave?: () => void;
  role?: ParticipantRole;
  participantUrl?: string;
};

function renderControls({
  onLeave = vi.fn(),
  role = 'host',
  participantUrl = 'https://app/r/r1',
}: RenderOptions = {}) {
  return render(<ControlsBar onLeave={onLeave} role={role} participantUrl={participantUrl} />);
}

beforeEach(() => {
  useMediaStore.getState().reset();
  setMicEnabled.mockClear();
  setCamEnabled.mockClear();
});

describe('ControlsBar', () => {
  it('fires onLeave when Leave is clicked', () => {
    const onLeave = vi.fn();
    renderControls({ onLeave });
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('reconciles mic state to the published track when toggled', () => {
    renderControls();
    fireEvent.click(screen.getByRole('switch', { name: 'Microphone' }));
    expect(setMicEnabled).toHaveBeenLastCalledWith(false);
  });

  it('shows state-aware tooltips on the camera and mic toggles', () => {
    renderControls();
    // Defaults: mic on, camera on → tooltips offer the "turn off / mute" action.
    expect(screen.getByText('Turn camera off')).toBeInTheDocument();
    expect(screen.getByText('Mute microphone')).toBeInTheDocument();
    // Toggle the mic off → tooltip flips to the "unmute" action.
    fireEvent.click(screen.getByRole('switch', { name: 'Microphone' }));
    expect(screen.getByText('Unmute microphone')).toBeInTheDocument();
  });

  it('shows a tooltip on the Leave button', () => {
    renderControls();
    expect(screen.getByText('Leave the call')).toBeInTheDocument();
    // The custom tooltip is a sibling, so the button's accessible name is unchanged.
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
  });

  it('shows Copy link to the host only', () => {
    renderControls({ role: 'host', participantUrl: 'https://app/r/r1' });
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
  });

  it('hides Copy link from a guest', () => {
    renderControls({ role: 'guest', participantUrl: 'https://app/r/r1' });
    expect(screen.queryByRole('button', { name: /copy link/i })).not.toBeInTheDocument();
  });
});
