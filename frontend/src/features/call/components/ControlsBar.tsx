import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalParticipant } from '@livekit/components-react';
import { ControlButton } from '../../../shared/ui/ControlButton';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { useMediaStore } from '../../../stores/useMediaStore';
import { useChatStore } from '../../../stores/useChatStore';
import type { ParticipantRole } from '../../../shared/types';
import { CopyLinkButton } from './CopyLinkButton';
import { useScreenShare } from '../hooks/useScreenShare';

export type ControlsBarProps = {
  onLeave: () => void;
  onEndCall: () => void;
  role: ParticipantRole;
  participantUrl: string;
};

const DEVICE_ERROR_DISMISS_MS = 4000;

export function ControlsBar({ onLeave, onEndCall, role, participantUrl }: ControlsBarProps): JSX.Element {
  const { t } = useTranslation('call');
  const { t: tc } = useTranslation('chat');
  const { localParticipant } = useLocalParticipant();
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);
  const setMicOn = useMediaStore((s) => s.setMicOn);
  const setCamOn = useMediaStore((s) => s.setCamOn);
  const micPermission = useMediaStore((s) => s.micPermission);
  const cameraPermission = useMediaStore((s) => s.cameraPermission);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const togglePanel = useChatStore((s) => s.togglePanel);
  const isPanelOpen = useChatStore((s) => s.isPanelOpen);
  const markAllRead = useChatStore((s) => s.markAllRead);
  const { isSharing, isBusy, error: shareError, toggle: toggleShare } = useScreenShare();

  const [deviceError, setDeviceError] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show an inline device-access error that auto-dismisses (mirrors the shareError pattern).
  const showDeviceError = useCallback((message: string): void => {
    setDeviceError(message);
    if (dismissTimerRef.current !== null) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => setDeviceError(null), DEVICE_ERROR_DISMISS_MS);
  }, []);

  useEffect(
    () => () => {
      if (dismissTimerRef.current !== null) clearTimeout(dismissTimerRef.current);
    },
    [],
  );

  const micDenied = micPermission === 'denied';
  const camDenied = cameraPermission === 'denied';

  const shareTooltip = isBusy
    ? t('shareTooltipBusy')
    : isSharing
      ? t('shareTooltipActive')
      : t('shareTooltipIdle');

  // Reconcile published tracks with the store's desired state. On failure (e.g. permission revoked
  // mid-call), revert the store toggle to its previous value and surface an inline error.
  useEffect(() => {
    localParticipant.setMicrophoneEnabled(isMicOn).catch(() => {
      setMicOn(!isMicOn);
      showDeviceError(t('micAccessError'));
    });
  }, [localParticipant, isMicOn, setMicOn, showDeviceError, t]);

  useEffect(() => {
    localParticipant.setCameraEnabled(isCamOn).catch(() => {
      setCamOn(!isCamOn);
      showDeviceError(t('cameraAccessError'));
    });
  }, [localParticipant, isCamOn, setCamOn, showDeviceError, t]);

  const handleToggleMic = (): void => {
    if (micDenied) return; // guard: a denied device can never be turned on from here
    setMicOn(!isMicOn);
  };

  const handleToggleCam = (): void => {
    if (camDenied) return;
    setCamOn(!isCamOn);
  };

  const handleToggleChat = (): void => {
    if (!isPanelOpen) markAllRead(); // opening the panel marks everything read
    togglePanel();
  };

  const micLabel = isMicOn ? t('micTooltipOn') : t('micTooltipOff');
  const camLabel = isCamOn ? t('cameraTooltipOn') : t('cameraTooltipOff');
  const inlineError = shareError ?? deviceError;

  return (
    <div className="relative p-4">
      {inlineError ? (
        <p className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full text-sm text-amber-400">
          {inlineError}
        </p>
      ) : null}

      <div className="flex items-center justify-center gap-4">
        <Tooltip label={micLabel}>
          <ControlButton
            icon={isMicOn ? 'micOn' : 'micOff'}
            label={micLabel}
            disabled={micDenied}
            onClick={handleToggleMic}
          />
        </Tooltip>
        <Tooltip label={camLabel}>
          <ControlButton
            icon={isCamOn ? 'camOn' : 'camOff'}
            label={camLabel}
            disabled={camDenied}
            onClick={handleToggleCam}
          />
        </Tooltip>
        <Tooltip label={shareTooltip}>
          <ControlButton
            icon="screenShare"
            label={shareTooltip}
            variant={isSharing ? 'active' : 'white'}
            disabled={isBusy}
            onClick={toggleShare}
            iconClassName="h-[26px] w-[26px]"
          />
        </Tooltip>
        {/* Extra separation (ml-6, 24px) keeps the destructive control clear of the media toggles. */}
        <div className="ml-6">
          {role === 'host' ? (
            <Tooltip label={t('endCallTooltip')}>
              <ControlButton icon="hangup" label={t('endCallTooltip')} variant="danger" onClick={onEndCall} />
            </Tooltip>
          ) : (
            <Tooltip label={t('leaveTooltip')}>
              <ControlButton icon="hangup" label={t('leaveTooltip')} variant="danger" onClick={onLeave} />
            </Tooltip>
          )}
        </div>
      </div>

      <div className="absolute bottom-4 right-7 flex items-center gap-4">
        {role === 'host' ? <CopyLinkButton url={participantUrl} /> : null}
        {/* data-chat-toggle: excluded from ChatPanel's outside-click-close so this button keeps its own toggle. */}
        <div className="relative" data-chat-toggle>
          <Tooltip label={tc('openChat')}>
            <ControlButton
              icon="chat"
              label={tc('openChat')}
              variant={isPanelOpen ? 'active' : 'dark'}
              onClick={handleToggleChat}
            />
          </Tooltip>
          {unreadCount > 0 && (
            <span
              data-testid="chat-unread"
              aria-hidden="true"
              className="pointer-events-none absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-accent"
            />
          )}
        </div>
      </div>
    </div>
  );
}
