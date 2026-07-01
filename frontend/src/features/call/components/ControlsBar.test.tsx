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

let shareState = { isSharing: false, isBusy: false, error: null as string | null, toggle: vi.fn() };
vi.mock('../hooks/useScreenShare', () => ({ useScreenShare: () => shareState }));

import { ControlsBar } from './ControlsBar';

type RenderOptions = {
  onLeave?: () => void;
  onEndCall?: () => void;
  role?: ParticipantRole;
  participantUrl?: string;
};

function renderControls({
  onLeave = vi.fn(),
  onEndCall = vi.fn(),
  role = 'host',
  participantUrl = 'https://app/r/r1',
}: RenderOptions = {}) {
  return render(
    <ControlsBar onLeave={onLeave} onEndCall={onEndCall} role={role} participantUrl={participantUrl} />,
  );
}

beforeEach(() => {
  useMediaStore.getState().reset();
  setMicEnabled.mockClear();
  setCamEnabled.mockClear();
  shareState = { isSharing: false, isBusy: false, error: null, toggle: vi.fn() };
});

describe('ControlsBar', () => {
  it('fires onLeave when Leave is clicked (guest)', () => {
    const onLeave = vi.fn();
    renderControls({ onLeave, role: 'guest' });
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

  it('shows a tooltip on the Leave button (guest)', () => {
    renderControls({ role: 'guest' });
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

  it('shows a red End call button (with tooltip) to the host instead of Leave', () => {
    renderControls({ role: 'host' });
    expect(screen.getByRole('button', { name: 'End call' })).toBeInTheDocument();
    expect(screen.getByText('End the call for everyone')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument();
  });

  it('fires onEndCall when the host clicks End call', () => {
    const onEndCall = vi.fn();
    renderControls({ role: 'host', onEndCall });
    fireEvent.click(screen.getByRole('button', { name: 'End call' }));
    expect(onEndCall).toHaveBeenCalledOnce();
  });

  it('shows Leave (not End call) to a guest', () => {
    renderControls({ role: 'guest' });
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End call' })).not.toBeInTheDocument();
  });

  it('shows an enabled Share screen button with the idle tooltip by default', () => {
    renderControls();
    const button = screen.getByRole('button', { name: 'Share screen' });
    expect(button).toBeEnabled();
    expect(screen.getByText('Share your screen')).toBeInTheDocument();
  });

  it('labels the button Stop sharing while sharing', () => {
    shareState = { ...shareState, isSharing: true };
    renderControls();
    expect(screen.getByRole('button', { name: 'Stop sharing' })).toBeInTheDocument();
  });

  it('disables the button with the busy tooltip when someone else is sharing', () => {
    shareState = { ...shareState, isBusy: true };
    renderControls();
    expect(screen.getByRole('button', { name: 'Share screen' })).toBeDisabled();
    expect(screen.getByText('Someone is already sharing their screen')).toBeInTheDocument();
  });

  it('renders the inline share error when set', () => {
    shareState = { ...shareState, error: 'Unable to share your screen. Please check your browser permissions.' };
    renderControls();
    expect(
      screen.getByText('Unable to share your screen. Please check your browser permissions.'),
    ).toBeInTheDocument();
  });

  it('calls toggle when the Share button is clicked', () => {
    const toggle = vi.fn();
    shareState = { ...shareState, toggle };
    renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Share screen' }));
    expect(toggle).toHaveBeenCalledOnce();
  });
});
