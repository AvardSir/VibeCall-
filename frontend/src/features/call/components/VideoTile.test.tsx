import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../shared/i18n';
import type { TrackReference } from '@livekit/components-react';

vi.mock('@livekit/components-react', () => ({
  VideoTrack: ({ className }: { className: string }) => (
    <div data-testid="video-track" className={className} />
  ),
}));

import { VideoTile } from './VideoTile';

// A camera track is identified only by presence in these tests; the mocked
// VideoTrack ignores its content, so an empty object cast is sufficient.
const fakeTrack = {} as TrackReference;

describe('VideoTile', () => {
  it('renders mirrored video with the "(You)" label for the local participant', () => {
    render(
      <VideoTile name="Ann" isLocal isCameraEnabled isMicrophoneEnabled cameraTrackRef={fakeTrack} />,
    );
    expect(screen.getByText('Ann (You)')).toBeInTheDocument();
    expect(screen.getByTestId('video-track').className).toContain('-scale-x-100');
    expect(screen.getByTestId('video-track').className).toContain('object-cover');
  });

  it('does not mirror remote video and uses a plain name label', () => {
    render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled isMicrophoneEnabled cameraTrackRef={fakeTrack} />,
    );
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByTestId('video-track').className).not.toContain('-scale-x-100');
  });

  it('shows the centered mic-state icon + name (no video) when the camera is off', () => {
    render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled={false} isMicrophoneEnabled cameraTrackRef={undefined} />,
    );
    expect(screen.queryByTestId('video-track')).not.toBeInTheDocument();
    expect(screen.getByTestId('center-mic')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows a corner mute icon when the camera is on and the mic is off', () => {
    render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled isMicrophoneEnabled={false} cameraTrackRef={fakeTrack} />,
    );
    expect(screen.getByTestId('video-track')).toBeInTheDocument();
    expect(screen.getByTestId('corner-mute')).toBeInTheDocument();
  });

  it('does not show a corner mute icon when the camera is off (uses the centered icon instead)', () => {
    render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled={false} isMicrophoneEnabled={false} cameraTrackRef={undefined} />,
    );
    expect(screen.queryByTestId('corner-mute')).not.toBeInTheDocument();
    expect(screen.getByTestId('center-mic')).toBeInTheDocument();
  });
});
