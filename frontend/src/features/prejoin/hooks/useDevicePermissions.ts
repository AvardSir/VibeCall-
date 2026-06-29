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

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;

    void navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        setPreviewStream(s);
        setCameraPermission('granted');
        setMicPermission('granted');
      })
      .catch(() => {
        if (!active) return;
        setCameraPermission('denied');
        setMicPermission('denied');
      });

    return () => {
      active = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [setCameraPermission, setMicPermission]);

  return { previewStream, cameraPermission, micPermission };
}
