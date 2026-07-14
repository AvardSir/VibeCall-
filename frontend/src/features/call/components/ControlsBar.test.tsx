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
  it('toggles the mic via the round control and reconciles the published track', () => {
    renderControls();
    // Default: mic on → the round control offers "Mute microphone".
    const micBtn = screen.getByRole('button', { name: 'Mute microphone' });
    expect(micBtn).toHaveClass('size-12', 'rounded-[30px]', 'bg-slate-800');
    fireEvent.click(micBtn);
    expect(setMicEnabled).toHaveBeenLastCalledWith(false);
  });

  it('flips the mic control label when muted', () => {
    renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Mute microphone' }));
    expect(screen.getByRole('button', { name: 'Unmute microphone' })).toBeInTheDocument();
  });

  it('toggles the camera via the round control', () => {
    renderControls();
    const camBtn = screen.getByRole('button', { name: 'Turn camera off' });
    expect(camBtn).toHaveClass('size-12', 'rounded-[30px]', 'bg-slate-800');
    fireEvent.click(camBtn);
    expect(setCamEnabled).toHaveBeenLastCalledWith(false);
  });

  it('shows state-aware tooltips on the mic and camera controls', () => {
    renderControls();
    expect(screen.getByText('Turn camera off')).toBeInTheDocument();
    expect(screen.getByText('Mute microphone')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mute microphone' }));
    expect(screen.getByText('Unmute microphone')).toBeInTheDocument();
  });

  it('shows a red end-call control (with tooltip) to the host', () => {
    const onEndCall = vi.fn();
    renderControls({ role: 'host', onEndCall });
    const endBtn = screen.getByRole('button', { name: 'End the call for everyone' });
    expect(endBtn).toHaveClass('bg-danger');
    expect(screen.getByText('End the call for everyone')).toBeInTheDocument();
    fireEvent.click(endBtn);
    expect(onEndCall).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Leave the call' })).not.toBeInTheDocument();
  });

  it('shows a red leave control (with tooltip) to a guest', () => {
    const onLeave = vi.fn();
    renderControls({ role: 'guest', onLeave });
    const leaveBtn = screen.getByRole('button', { name: 'Leave the call' });
    expect(leaveBtn).toHaveClass('bg-danger');
    expect(screen.getByText('Leave the call')).toBeInTheDocument();
    fireEvent.click(leaveBtn);
    expect(onLeave).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'End the call for everyone' })).not.toBeInTheDocument();
  });

  it('shows Copy link to the host only', () => {
    renderControls({ role: 'host', participantUrl: 'https://app/r/r1' });
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
  });

  it('hides Copy link from a guest', () => {
    renderControls({ role: 'guest', participantUrl: 'https://app/r/r1' });
    expect(screen.queryByRole('button', { name: /copy link/i })).not.toBeInTheDocument();
  });

  it('shows an enabled screen-share control with the idle tooltip by default', () => {
    renderControls();
    const button = screen.getByRole('button', { name: 'Share your screen' });
    expect(button).toBeEnabled();
    expect(button).toHaveClass('bg-slate-800');
    expect(screen.getByText('Share your screen')).toBeInTheDocument();
  });

  it('marks the share control active while sharing', () => {
    shareState = { ...shareState, isSharing: true };
    renderControls();
    const button = screen.getByRole('button', { name: 'Stop sharing' });
    expect(button).toHaveClass('bg-accent');
  });

  it('disables the share control with the busy tooltip when someone else is sharing', () => {
    shareState = { ...shareState, isBusy: true };
    renderControls();
    expect(screen.getByRole('button', { name: 'Someone is already sharing their screen' })).toBeDisabled();
    expect(screen.getByText('Someone is already sharing their screen')).toBeInTheDocument();
  });

  it('renders the inline share error when set', () => {
    shareState = { ...shareState, error: 'Unable to share your screen. Please check your browser permissions.' };
    renderControls();
    expect(
      screen.getByText('Unable to share your screen. Please check your browser permissions.'),
    ).toBeInTheDocument();
  });

  it('calls toggle when the share control is clicked', () => {
    const toggle = vi.fn();
    shareState = { ...shareState, toggle };
    renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Share your screen' }));
    expect(toggle).toHaveBeenCalledOnce();
  });
});
