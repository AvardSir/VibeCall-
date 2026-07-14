import { create } from 'zustand';

export type PermissionState = 'prompt' | 'granted' | 'denied';

type MediaState = {
  isMicOn: boolean;
  isCamOn: boolean;
  cameraPermission: PermissionState;
  micPermission: PermissionState;
  setMicOn: (on: boolean) => void;
  setCamOn: (on: boolean) => void;
  setCameraPermission: (state: PermissionState) => void;
  setMicPermission: (state: PermissionState) => void;
  reset: () => void;
};

const INITIAL = {
  isMicOn: true,
  isCamOn: true,
  cameraPermission: 'prompt' as PermissionState,
  micPermission: 'prompt' as PermissionState,
};

export const useMediaStore = create<MediaState>()((set) => ({
  ...INITIAL,
  setMicOn: (on) => set({ isMicOn: on }),
  setCamOn: (on) => set({ isCamOn: on }),
  setCameraPermission: (state) => set({ cameraPermission: state }),
  setMicPermission: (state) => set({ micPermission: state }),
  reset: () => set({ ...INITIAL }),
}));
