import type { JSX } from 'react';
import { useEffect } from 'react';
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

export function ControlsBar({ onLeave, onEndCall, role, participantUrl }: ControlsBarProps): JSX.Element {
  const { t } = useTranslation('call');
  const { t: tc } = useTranslation('chat');
  const { localParticipant } = useLocalParticipant();
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);
  const setMicOn = useMediaStore((s) => s.setMicOn);
  const setCamOn = useMediaStore((s) => s.setCamOn);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const togglePanel = useChatStore((s) => s.togglePanel);
  const isPanelOpen = useChatStore((s) => s.isPanelOpen);
  const markAllRead = useChatStore((s) => s.markAllRead);
  const { isSharing, isBusy, error: shareError, toggle: toggleShare } = useScreenShare();

  const shareTooltip = isBusy
    ? t('shareTooltipBusy')
    : isSharing
      ? t('shareTooltipActive')
      : t('shareTooltipIdle');

  // Reconcile published tracks with the store's desired state.
  useEffect(() => {
    void localParticipant.setMicrophoneEnabled(isMicOn);
  }, [localParticipant, isMicOn]);

  useEffect(() => {
    void localParticipant.setCameraEnabled(isCamOn);
  }, [localParticipant, isCamOn]);

  const handleToggleChat = (): void => {
    if (!isPanelOpen) markAllRead(); // opening the panel marks everything read
    togglePanel();
  };

  const micLabel = isMicOn ? t('micTooltipOn') : t('micTooltipOff');
  const camLabel = isCamOn ? t('cameraTooltipOn') : t('cameraTooltipOff');

  return (
    <div className="relative p-4">
      {shareError ? (
        <p className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full text-sm text-amber-400">
          {shareError}
        </p>
      ) : null}

      <div className="flex items-center justify-center gap-4">
        <Tooltip label={micLabel}>
          <ControlButton
            icon={isMicOn ? 'micOn' : 'micOff'}
            label={micLabel}
            onClick={() => setMicOn(!isMicOn)}
          />
        </Tooltip>
        <Tooltip label={camLabel}>
          <ControlButton
            icon={isCamOn ? 'camOn' : 'camOff'}
            label={camLabel}
            onClick={() => setCamOn(!isCamOn)}
          />
        </Tooltip>
        <Tooltip label={shareTooltip}>
          <ControlButton
            icon="screenShare"
            label={shareTooltip}
            variant={isSharing ? 'active' : 'white'}
            disabled={isBusy}
            onClick={toggleShare}
          />
        </Tooltip>
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
              className="pointer-events-none absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs text-white"
            >
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
