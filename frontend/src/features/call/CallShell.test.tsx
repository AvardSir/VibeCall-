import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import '../../shared/i18n';
import { useParticipantsStore } from '../../stores/useParticipantsStore';
import type { CallParticipant } from '../../shared/types';

// Heavy in-room dependencies are stubbed; we only exercise CallShell's remove-dialog lifecycle.
vi.mock('@livekit/components-styles', () => ({}));
vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  RoomAudioRenderer: () => null,
}));
vi.mock('livekit-client', () => ({
  ConnectionError: class ConnectionError extends Error {},
  ConnectionErrorReason: { NotAllowed: 'NotAllowed' },
}));
vi.mock('./hooks/useRoomLifecycle', () => ({ useRoomLifecycle: () => undefined }));
vi.mock('./hooks/useShareState', () => ({ useShareState: () => undefined }));
vi.mock('./components/ControlsBar', () => ({ ControlsBar: () => null }));
vi.mock('./components/GraceOverlay', () => ({ GraceOverlay: () => null }));
vi.mock('../../shared/lib/apiClient', () => ({ removeParticipant: vi.fn().mockResolvedValue(undefined) }));

// CallStage exposes the host's remove-guest trigger so the test can open the dialog for a target.
vi.mock('./components/CallStage', () => ({
  CallStage: ({ onRemoveGuest }: { onRemoveGuest?: (id: string, name: string) => void }) => (
    <button type="button" onClick={() => onRemoveGuest?.('p_guest', 'Bob')}>
      open-remove
    </button>
  ),
}));

vi.mock('./components/RemoveGuestDialog', () => ({
  RemoveGuestDialog: ({ name }: { name: string }): JSX.Element => (
    <div data-testid="remove-dialog">Remove {name}?</div>
  ),
}));

import { CallShell } from './CallShell';

function participant(identity: string, name: string): CallParticipant {
  return { identity, name, isLocal: false, isCameraEnabled: true, isMicrophoneEnabled: true };
}

const baseProps = {
  accessToken: 'token',
  serverUrl: 'ws://localhost',
  role: 'host' as const,
  participantUrl: 'http://localhost/j/r1',
  roomId: 'r1',
  hostToken: 'ht',
  identity: 'p_host',
  onLeave: vi.fn(),
  onConnectError: vi.fn(),
  onRoomFull: vi.fn(),
  onEndCall: vi.fn(),
  onRoomEnded: vi.fn(),
  onRemoved: vi.fn(),
};

beforeEach(() => {
  useParticipantsStore.getState().reset();
});

describe('CallShell remove-guest dialog', () => {
  it('auto-dismisses the confirmation when the targeted guest leaves before confirm (X1)', () => {
    useParticipantsStore
      .getState()
      .setParticipants([participant('p_host', 'Host'), participant('p_guest', 'Bob')]);
    render(<CallShell {...baseProps} />);

    fireEvent.click(screen.getByText('open-remove'));
    expect(screen.getByTestId('remove-dialog')).toBeInTheDocument();

    // The targeted guest leaves the room before the host confirms.
    act(() => {
      useParticipantsStore.getState().setParticipants([participant('p_host', 'Host')]);
    });

    expect(screen.queryByTestId('remove-dialog')).not.toBeInTheDocument();
  });

  it('keeps the confirmation open while the targeted guest is still present', () => {
    useParticipantsStore
      .getState()
      .setParticipants([participant('p_host', 'Host'), participant('p_guest', 'Bob')]);
    render(<CallShell {...baseProps} />);

    fireEvent.click(screen.getByText('open-remove'));
    expect(screen.getByTestId('remove-dialog')).toBeInTheDocument();

    // A different guest leaves — the target remains, so the dialog stays.
    act(() => {
      useParticipantsStore
        .getState()
        .setParticipants([participant('p_host', 'Host'), participant('p_guest', 'Bob')]);
    });

    expect(screen.getByTestId('remove-dialog')).toBeInTheDocument();
  });
});
