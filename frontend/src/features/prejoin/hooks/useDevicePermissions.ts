import { useEffect, useState } from 'react';
import { useMediaStore, type PermissionState } from '../../../stores/useMediaStore';

export type DevicePermissions = {
  previewStream: MediaStream | null;
  cameraPermission: PermissionState;
  micPermission: PermissionState;
};

export function useDevicePermissions(): DevicePermissions {
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const cameraPermission = useMediaStore((s) => s.cameraPermission);
  const micPermission = useMediaStore((s) => s.micPermission);
  const setCameraPermission = useMediaStore((s) => s.setCameraPermission);
  const setMicPermission = useMediaStore((s) => s.setMicPermission);
  const setCamOn = useMediaStore((s) => s.setCamOn);
  const setMicOn = useMediaStore((s) => s.setMicOn);

  useEffect(() => {
    let active = true;
    const acquired: MediaStream[] = [];

    // Request camera and microphone independently so a denial of one device
    // does not collapse both permission states (PRD US-2, FR-11).
    async function request(): Promise<void> {
      const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      const [camResult, micResult] = await Promise.allSettled([
        getUserMedia({ video: true }),
        getUserMedia({ audio: true }),
      ]);

      if (!active) {
        [camResult, micResult].forEach((r) => {
          if (r.status === 'fulfilled') r.value.getTracks().forEach((t) => t.stop());
        });
        return;
      }

      let preview: MediaStream | null = null;

      if (camResult.status === 'fulfilled') {
        acquired.push(camResult.value);
        preview = camResult.value;
        setCameraPermission('granted');
      } else {
        setCameraPermission('denied');
        setCamOn(false);
      }

      if (micResult.status === 'fulfilled') {
        acquired.push(micResult.value);
        if (preview) {
          const target = preview;
          micResult.value.getTracks().forEach((t) => target.addTrack(t));
        } else {
          preview = micResult.value;
        }
        setMicPermission('granted');
      } else {
        setMicPermission('denied');
        setMicOn(false);
      }

      setPreviewStream(preview);
    }

    void request();

    return () => {
      active = false;
      acquired.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    };
  }, [setCameraPermission, setMicPermission, setCamOn, setMicOn]);

  return { previewStream, cameraPermission, micPermission };
}
