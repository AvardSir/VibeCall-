import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { act } from 'react';
import '../../../shared/i18n';
import { CameraPreview } from './CameraPreview';
import { useMediaStore } from '../../../stores/useMediaStore';

// jsdom doesn't implement HTMLMediaElement.srcObject — define a backing setter
// so we can observe what the component attaches to the <video>.
beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    get(): unknown {
      return (this as { _srcObject?: unknown })._srcObject ?? null;
    },
    set(value: unknown) {
      (this as { _srcObject?: unknown })._srcObject = value;
    },
  });
});

describe('CameraPreview', () => {
  const stream = { id: 'preview' } as unknown as MediaStream;

  beforeEach(() => {
    useMediaStore.setState({ isCamOn: true, isMicOn: true, cameraPermission: 'granted' });
  });

  it('attaches the stream to the video on initial render', () => {
    const { container } = render(<CameraPreview stream={stream} />);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.srcObject).toBe(stream);
  });

  it('re-attaches the stream after the camera is toggled off then on again', () => {
    const { container } = render(<CameraPreview stream={stream} />);

    // Camera off — the <video> unmounts.
    act(() => useMediaStore.setState({ isCamOn: false }));
    expect(container.querySelector('video')).toBeNull();

    // Camera on — a fresh <video> mounts and must get the stream reattached.
    act(() => useMediaStore.setState({ isCamOn: true }));
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.srcObject).toBe(stream);
  });
});
