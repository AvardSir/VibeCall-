import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../shared/i18n';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';
import type { CallParticipant } from '../../../shared/types';

const useTracksMock = vi.fn();

vi.mock('@livekit/components-react', () => ({
  useTracks: (...args: unknown[]) => useTracksMock(...args),
  VideoTrack: ({ className }: { className?: string }) => <div data-testid="video-track" className={className} />,
}));

import { ScreenShareView } from './ScreenShareView';

function participant(identity: string, name: string): CallParticipant {
  return { identity, name, isLocal: false, isCameraEnabled: true, isMicrophoneEnabled: true };
}

beforeEach(() => {
  useTracksMock.mockReset();
  useConnectionStore.getState().reset();
  useParticipantsStore.getState().reset();
});

describe('ScreenShareView', () => {
  it('labels the share with the sharer name for a viewer', () => {
    useTracksMock.mockReturnValue([{ participant: { identity: 'p_1' } }]);
    useConnectionStore.getState().setLocalParticipant({ identity: 'p_me', displayName: 'Me', roomId: 'r1', memberToken: 'mt' });
    useParticipantsStore.getState().setParticipants([participant('p_1', 'Ann')]);
    useParticipantsStore.getState().setActiveSharerId('p_1');
    render(<ScreenShareView />);
    expect(screen.getByText('Ann is sharing their screen')).toBeInTheDocument();
    expect(screen.getByTestId('video-track')).toHaveClass('object-contain');
  });

  it('labels the share "You are sharing" when the local participant is the sharer', () => {
    useTracksMock.mockReturnValue([{ participant: { identity: 'p_me' } }]);
    useConnectionStore.getState().setLocalParticipant({ identity: 'p_me', displayName: 'Me', roomId: 'r1', memberToken: 'mt' });
    useParticipantsStore.getState().setActiveSharerId('p_me');
    render(<ScreenShareView />);
    expect(screen.getByText('You are sharing your screen')).toBeInTheDocument();
  });

  it('renders a placeholder while the share track is not yet published', () => {
    useTracksMock.mockReturnValue([]);
    useParticipantsStore.getState().setParticipants([participant('p_1', 'Ann')]);
    useParticipantsStore.getState().setActiveSharerId('p_1');
    render(<ScreenShareView />);
    expect(screen.getByTestId('share-placeholder')).toBeInTheDocument();
    expect(screen.getByText('Ann is sharing their screen')).toBeInTheDocument();
  });

  it('keeps the "Waiting…" notice visible when the lone host is sharing (ES-HostAlone)', () => {
    useTracksMock.mockReturnValue([{ participant: { identity: 'p_me' } }]);
    useConnectionStore
      .getState()
      .setLocalParticipant({ identity: 'p_me', displayName: 'Me', roomId: 'r1', memberToken: 'mt' });
    useParticipantsStore.getState().setParticipants([participant('p_me', 'Me')]);
    useParticipantsStore.getState().setActiveSharerId('p_me');
    render(<ScreenShareView />);
    expect(screen.getByTestId('waiting-notice')).toBeInTheDocument();
    expect(screen.getByText('Waiting for someone to join…')).toBeInTheDocument();
  });

  it('suppresses the "Waiting…" notice while the room is in host grace', () => {
    useTracksMock.mockReturnValue([{ participant: { identity: 'p_me' } }]);
    useConnectionStore
      .getState()
      .setLocalParticipant({ identity: 'p_me', displayName: 'Me', roomId: 'r1', memberToken: 'mt' });
    useParticipantsStore.getState().setParticipants([participant('p_me', 'Me')]);
    useParticipantsStore.getState().setActiveSharerId('p_me');
    useConnectionStore.getState().setGraceSecondsLeft(47);
    render(<ScreenShareView />);
    expect(screen.queryByTestId('waiting-notice')).not.toBeInTheDocument();
  });

  it('hides the "Waiting…" notice once another participant is present', () => {
    useTracksMock.mockReturnValue([{ participant: { identity: 'p_1' } }]);
    useParticipantsStore
      .getState()
      .setParticipants([participant('p_1', 'Ann'), participant('p_2', 'Bob')]);
    useParticipantsStore.getState().setActiveSharerId('p_1');
    render(<ScreenShareView />);
    expect(screen.queryByTestId('waiting-notice')).not.toBeInTheDocument();
  });
});
