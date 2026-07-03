import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDevicePermissions } from './useDevicePermissions';
import { useMediaStore } from '../../../stores/useMediaStore';

function fakeStream(kind: 'video' | 'audio'): MediaStream {
  return {
    getTracks: () => [{ kind, stop: vi.fn() }],
    addTrack: vi.fn(),
  } as unknown as MediaStream;
}

function notAllowed(): Error {
  return Object.assign(new Error('denied'), { name: 'NotAllowedError' });
}

/** Route each getUserMedia call to a per-device outcome based on the constraints. */
function stubGetUserMedia(outcomes: {
  video: MediaStream | Error;
  audio: MediaStream | Error;
}): void {
  const getUserMedia = vi.fn((constraints: MediaStreamConstraints) => {
    const outcome = constraints.video ? outcomes.video : outcomes.audio;
    return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
  });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
}

beforeEach(() => useMediaStore.getState().reset());

describe('useDevicePermissions', () => {
  it('marks both granted when camera and mic both resolve', async () => {
    stubGetUserMedia({ video: fakeStream('video'), audio: fakeStream('audio') });
    renderHook(() => useDevicePermissions());
    await waitFor(() => expect(useMediaStore.getState().cameraPermission).toBe('granted'));
    expect(useMediaStore.getState().micPermission).toBe('granted');
    expect(useMediaStore.getState().isCamOn).toBe(true);
    expect(useMediaStore.getState().isMicOn).toBe(true);
  });

  it('marks both denied when both devices reject and turns off both', async () => {
    stubGetUserMedia({ video: notAllowed(), audio: notAllowed() });
    renderHook(() => useDevicePermissions());
    await waitFor(() => expect(useMediaStore.getState().cameraPermission).toBe('denied'));
    expect(useMediaStore.getState().micPermission).toBe('denied');
    expect(useMediaStore.getState().isCamOn).toBe(false);
    expect(useMediaStore.getState().isMicOn).toBe(false);
  });

  it('marks camera denied but mic granted independently', async () => {
    stubGetUserMedia({ video: notAllowed(), audio: fakeStream('audio') });
    renderHook(() => useDevicePermissions());
    await waitFor(() => expect(useMediaStore.getState().cameraPermission).toBe('denied'));
    expect(useMediaStore.getState().micPermission).toBe('granted');
    expect(useMediaStore.getState().isCamOn).toBe(false);
    expect(useMediaStore.getState().isMicOn).toBe(true);
  });

  it('marks mic denied but camera granted independently', async () => {
    stubGetUserMedia({ video: fakeStream('video'), audio: notAllowed() });
    renderHook(() => useDevicePermissions());
    await waitFor(() => expect(useMediaStore.getState().micPermission).toBe('denied'));
    expect(useMediaStore.getState().cameraPermission).toBe('granted');
    expect(useMediaStore.getState().isMicOn).toBe(false);
    expect(useMediaStore.getState().isCamOn).toBe(true);
  });
});
