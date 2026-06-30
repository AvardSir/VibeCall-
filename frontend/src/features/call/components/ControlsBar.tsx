import type { JSX } from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalParticipant } from '@livekit/components-react';
import { Toggle } from '../../../shared/ui/Toggle';
import { Button } from '../../../shared/ui/Button';
import { useMediaStore } from '../../../stores/useMediaStore';
import { useChatStore } from '../../../stores/useChatStore';

export type ControlsBarProps = { onLeave: () => void };

export function ControlsBar({ onLeave }: ControlsBarProps): JSX.Element {
  const { t } = useTranslation('call');
  const { t: tc } = useTranslation('chat');
  const { localParticipant } = useLocalParticipant();
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);
  const setMicOn = useMediaStore((s) => s.setMicOn);
  const setCamOn = useMediaStore((s) => s.setCamOn);
  const isPanelOpen = useChatStore((s) => s.isPanelOpen);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const openPanel = useChatStore((s) => s.openPanel);
  const closePanel = useChatStore((s) => s.closePanel);

  // Reconcile published tracks with the store's desired state.
  useEffect(() => {
    void localParticipant.setMicrophoneEnabled(isMicOn);
  }, [localParticipant, isMicOn]);

  useEffect(() => {
    void localParticipant.setCameraEnabled(isCamOn);
  }, [localParticipant, isCamOn]);

  return (
    <div className="flex items-center justify-center gap-3 p-4">
      <Toggle
        label={t('micToggle')}
        pressed={isMicOn}
        tooltip={isMicOn ? t('micTooltipOn') : t('micTooltipOff')}
        onChange={setMicOn}
      />
      <Toggle
        label={t('cameraToggle')}
        pressed={isCamOn}
        tooltip={isCamOn ? t('cameraTooltipOn') : t('cameraTooltipOff')}
        onChange={setCamOn}
      />
      <button
        type="button"
        aria-label={tc('openChat')}
        onClick={() => (isPanelOpen ? closePanel() : openPanel())}
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
      <Button variant="ghost" title={t('leaveTooltip')} onClick={onLeave}>
        {t('leave')}
      </Button>
    </div>
  );
}
