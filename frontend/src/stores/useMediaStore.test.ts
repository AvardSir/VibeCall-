import { describe, it, expect, beforeEach } from 'vitest';
import { useMediaStore } from './useMediaStore';

describe('useMediaStore', () => {
  beforeEach(() => useMediaStore.getState().reset());

  it('defaults mic and camera on', () => {
    const s = useMediaStore.getState();
    expect(s.isMicOn).toBe(true);
    expect(s.isCamOn).toBe(true);
    expect(s.cameraPermission).toBe('prompt');
  });

  it('toggles mic and camera', () => {
    useMediaStore.getState().setMicOn(false);
    useMediaStore.getState().setCamOn(false);
    expect(useMediaStore.getState().isMicOn).toBe(false);
    expect(useMediaStore.getState().isCamOn).toBe(false);
  });

  it('records device permission', () => {
    useMediaStore.getState().setCameraPermission('denied');
    expect(useMediaStore.getState().cameraPermission).toBe('denied');
  });

  it('reset restores defaults', () => {
    useMediaStore.getState().setMicOn(false);
    useMediaStore.getState().setCameraPermission('denied');
    useMediaStore.getState().reset();
    expect(useMediaStore.getState().isMicOn).toBe(true);
    expect(useMediaStore.getState().cameraPermission).toBe('prompt');
  });
});
