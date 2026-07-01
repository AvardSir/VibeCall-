import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../shared/i18n';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';
import type { CallParticipant } from '../../../shared/types';

vi.mock('@livekit/components-react', () => ({ useTracks: () => [] }));

import { ThumbnailStrip } from './ThumbnailStrip';

function roster(): CallParticipant[] {
  return [
    { identity: 'p_0', name: 'Host', isLocal: true, isCameraEnabled: false, isMicrophoneEnabled: false },
    { identity: 'p_1', name: 'Guest', isLocal: false, isCameraEnabled: true, isMicrophoneEnabled: true },
  ];
}

beforeEach(() => {
  useParticipantsStore.getState().reset();
});

describe('ThumbnailStrip', () => {
  it('renders each participant in a horizontal strip', () => {
    useParticipantsStore.getState().setParticipants(roster());
    render(<ThumbnailStrip />);
    const strip = screen.getByTestId('thumbnail-strip');
    expect(strip).toHaveClass('flex');
    expect(strip).toHaveClass('overflow-x-auto');
    expect(screen.getByText('Host (You)')).toBeInTheDocument();
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });

  it('shows the mic-state icon for a camera-off participant', () => {
    useParticipantsStore.getState().setParticipants(roster());
    render(<ThumbnailStrip />);
    // The local Host tile has the camera off → VideoTile renders its centered mic-state icon.
    expect(screen.getAllByTestId('center-mic').length).toBeGreaterThan(0);
  });

  it('forwards onRemoveGuest to remote tiles only, not the local tile', () => {
    useParticipantsStore.getState().setParticipants(roster());
    const onRemoveGuest = vi.fn();
    render(<ThumbnailStrip onRemoveGuest={onRemoveGuest} />);
    // Local host tile: no remove control.
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemoveGuest).toHaveBeenCalledWith('p_1', 'Guest');
  });
});
