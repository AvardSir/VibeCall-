import type { JSX } from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalParticipant } from '@livekit/components-react';
import { Toggle } from '../../../shared/ui/Toggle';
import { Button } from '../../../shared/ui/Button';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { useMediaStore } from '../../../stores/useMediaStore';
import { useChatStore } from '../../../stores/useChatStore';
import type { ParticipantRole } from '../../../shared/types';
import { CopyLinkButton } from './CopyLinkButton';

export type ControlsBarProps = {
  onLeave: () => void;
  role: ParticipantRole;
  participantUrl: string;
};

export function ControlsBar({ onLeave, role, participantUrl }: ControlsBarProps): JSX.Element {
  const { t } = useTranslation('call');
  const { t: tc } = useTranslation('chat');
  const { localParticipant } = useLocalParticipant();
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);
  const setMicOn = useMediaStore((s) => s.setMicOn);
  const setCamOn = useMediaStore((s) => s.setCamOn);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const togglePanel = useChatStore((s) => s.togglePanel);

  // Reconcile published tracks with the store's desired state.
  useEffect(() => {
    void localParticipant.setMicrophoneEnabled(isMicOn);
  }, [localParticipant, isMicOn]);

  useEffect(() => {
    void localParticipant.setCameraEnabled(isCamOn);
  }, [localParticipant, isCamOn]);

  return (
    <div className="flex items-center justify-center gap-3 p-4">
      <Tooltip label={isMicOn ? t('micTooltipOn') : t('micTooltipOff')}>
        <Toggle label={t('micToggle')} pressed={isMicOn} onChange={setMicOn} />
      </Tooltip>
      <Tooltip label={isCamOn ? t('cameraTooltipOn') : t('cameraTooltipOff')}>
        <Toggle label={t('cameraToggle')} pressed={isCamOn} onChange={setCamOn} />
      </Tooltip>
      <button
        type="button"
        aria-label={tc('openChat')}
        onClick={togglePanel}
        className="relative rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-muted"
      >
        {tc('openChat')}
        {unreadCount > 0 && (
          <span
            data-testid="chat-unread"
            className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs text-white"
          >
            {unreadCount}
          </span>
        )}
      </button>
      {role === 'host' ? <CopyLinkButton url={participantUrl} /> : null}
      <Tooltip label={t('leaveTooltip')}>
        <Button variant="ghost" onClick={onLeave}>
          {t('leave')}
        </Button>
      </Tooltip>
    </div>
  );
}
