import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('applies the Figma 12px corner radius to the tile root', () => {
    const { container } = render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled isMicrophoneEnabled cameraTrackRef={fakeTrack} />,
    );
    expect(container.firstElementChild).toHaveClass('rounded-[12px]');
  });

  it('shows the centered mic-glyph (SVG, not emoji) + name when the camera is off', () => {
    const { container } = render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled={false} isMicrophoneEnabled cameraTrackRef={undefined} />,
    );
    expect(screen.queryByTestId('video-track')).not.toBeInTheDocument();
    const centerMic = container.querySelector('[data-testid="center-mic"]');
    expect(centerMic).not.toBeNull();
    expect(centerMic?.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows a corner mute glyph (SVG) when the camera is on and the mic is off', () => {
    const { container } = render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled isMicrophoneEnabled={false} cameraTrackRef={fakeTrack} />,
    );
    expect(screen.getByTestId('video-track')).toBeInTheDocument();
    const cornerMute = container.querySelector('[data-testid="corner-mute"]');
    expect(cornerMute).not.toBeNull();
    expect(cornerMute?.querySelector('svg')).not.toBeNull();
  });

  it('renders a mic glyph (SVG) in the live-video name label', () => {
    const { container } = render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled isMicrophoneEnabled cameraTrackRef={fakeTrack} />,
    );
    const label = container.querySelector('[data-testid="name-label"]');
    expect(label).not.toBeNull();
    expect(label?.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('does not show a corner mute icon when the camera is off (uses the centered icon instead)', () => {
    render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled={false} isMicrophoneEnabled={false} cameraTrackRef={undefined} />,
    );
    expect(screen.queryByTestId('corner-mute')).not.toBeInTheDocument();
    expect(screen.getByTestId('center-mic')).toBeInTheDocument();
  });

  it('renders a Remove control when onRemove is passed and calls it on click', () => {
    const onRemove = vi.fn();
    render(
      <VideoTile
        name="Bob"
        isLocal={false}
        isCameraEnabled
        isMicrophoneEnabled
        cameraTrackRef={fakeTrack}
        onRemove={onRemove}
      />,
    );
    const removeButton = screen.getByRole('button', { name: /^remove$/i });
    fireEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalled();
  });

  it('does not render a Remove control when onRemove is absent', () => {
    render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled isMicrophoneEnabled cameraTrackRef={fakeTrack} />,
    );
    expect(screen.queryByRole('button', { name: /^remove$/i })).not.toBeInTheDocument();
  });
});
