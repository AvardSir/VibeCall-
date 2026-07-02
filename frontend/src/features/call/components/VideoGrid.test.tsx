import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../shared/i18n';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';
import type { CallParticipant } from '../../../shared/types';

// The grid is what we test; the roster hook and LiveKit track subscription are
// stubbed so we drive the store directly.
vi.mock('../hooks/useParticipants', () => ({ useParticipants: () => undefined }));
vi.mock('@livekit/components-react', () => ({ useTracks: () => [] }));
vi.mock('./VideoTile', () => ({
  VideoTile: ({ name }: { name: string }) => <div data-testid="video-tile">{name}</div>,
}));

import { VideoGrid } from './VideoGrid';

function roster(count: number): CallParticipant[] {
  return Array.from({ length: count }, (_, i) => ({
    identity: `p_${i}`,
    name: `User ${i}`,
    isLocal: i === 0,
    isCameraEnabled: true,
    isMicrophoneEnabled: true,
  }));
}

beforeEach(() => {
  useParticipantsStore.getState().reset();
});

describe('VideoGrid', () => {
  it('renders the solo state with the "Waiting…" notice for one participant', () => {
    useParticipantsStore.getState().setParticipants(roster(1));
    render(<VideoGrid />);
    expect(screen.getAllByTestId('video-tile')).toHaveLength(1);
    expect(screen.getByText('Waiting for someone to join…')).toBeInTheDocument();
    expect(screen.getByTestId('video-grid')).toHaveAttribute('data-count', '1');
  });

  it('renders two tiles and no notice for two participants', () => {
    useParticipantsStore.getState().setParticipants(roster(2));
    render(<VideoGrid />);
    expect(screen.getAllByTestId('video-tile')).toHaveLength(2);
    expect(screen.queryByText('Waiting for someone to join…')).not.toBeInTheDocument();
    expect(screen.getByTestId('video-grid')).toHaveAttribute('data-count', '2');
  });

  it('renders three tiles for three participants', () => {
    useParticipantsStore.getState().setParticipants(roster(3));
    render(<VideoGrid />);
    expect(screen.getAllByTestId('video-tile')).toHaveLength(3);
    expect(screen.getByTestId('video-grid')).toHaveAttribute('data-count', '3');
  });

  it('renders four tiles for four participants', () => {
    useParticipantsStore.getState().setParticipants(roster(4));
    render(<VideoGrid />);
    expect(screen.getAllByTestId('video-tile')).toHaveLength(4);
    expect(screen.getByTestId('video-grid')).toHaveAttribute('data-count', '4');
  });
});
