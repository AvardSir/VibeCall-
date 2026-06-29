import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDevicePermissions } from './useDevicePermissions';
import { useMediaStore } from '../../../stores/useMediaStore';

function fakeStream(): MediaStream {
  return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
}

beforeEach(() => useMediaStore.getState().reset());

describe('useDevicePermissions', () => {
  it('marks permissions granted when getUserMedia resolves', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    renderHook(() => useDevicePermissions());
    await waitFor(() => expect(useMediaStore.getState().cameraPermission).toBe('granted'));
    expect(useMediaStore.getState().micPermission).toBe('granted');
  });

  it('marks permissions denied on NotAllowedError', async () => {
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(err) } });
    renderHook(() => useDevicePermissions());
    await waitFor(() => expect(useMediaStore.getState().cameraPermission).toBe('denied'));
    expect(useMediaStore.getState().micPermission).toBe('denied');
  });
});
