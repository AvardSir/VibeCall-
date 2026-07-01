import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../shared/i18n';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';
import type { CallParticipant } from '../../../shared/types';

// The grid is what we test; the roster hook and LiveKit track subscription are
// stubbed so we drive the store directly.
vi.mock('../hooks/useParticipants', () => ({ useParticipants: () => undefined }));
vi.mock('@livekit/components-react', () => ({ useTracks: () => [] }));
vi.mock('./VideoTile', () => ({
  VideoTile: ({ name, onRemove }: { name: string; onRemove?: () => void }) => (
    <div data-testid="video-tile">
      {name}
      {onRemove ? (
        <button type="button" onClick={onRemove}>
          Remove {name}
        </button>
      ) : null}
    </div>
  ),
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

  it('does not wire a remove control on any tile when onRemoveGuest is omitted (guest viewer)', () => {
    useParticipantsStore.getState().setParticipants(roster(3));
    render(<VideoGrid />);
    expect(screen.queryByRole('button', { name: /^remove/i })).not.toBeInTheDocument();
  });

  it('wires onRemoveGuest to remote tiles only, not the local tile (host viewer)', () => {
    useParticipantsStore.getState().setParticipants(roster(3));
    const onRemoveGuest = vi.fn();
    render(<VideoGrid onRemoveGuest={onRemoveGuest} />);
    // roster(3): index 0 is local (User 0); indices 1-2 are remote.
    expect(screen.queryByRole('button', { name: 'Remove User 0' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove User 1' }));
    expect(onRemoveGuest).toHaveBeenCalledWith('p_1', 'User 1');
    fireEvent.click(screen.getByRole('button', { name: 'Remove User 2' }));
    expect(onRemoveGuest).toHaveBeenCalledWith('p_2', 'User 2');
  });
});
