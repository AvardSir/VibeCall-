import type { JSX } from 'react';
import { VideoGrid } from './VideoGrid';
import { ScreenShareView } from './ScreenShareView';
import { ThumbnailStrip } from './ThumbnailStrip';

export type CallStageProps = {
  // Non-null while someone is sharing → the share layout replaces the grid.
  activeSharerId: string | null;
  onRemoveGuest?: (identity: string, name: string) => void;
};

// Presentational layout switch: the video grid, or the shared screen above a thumbnail strip.
export function CallStage({ activeSharerId, onRemoveGuest }: CallStageProps): JSX.Element {
  if (activeSharerId !== null) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <ScreenShareView />
        </div>
        <ThumbnailStrip onRemoveGuest={onRemoveGuest} />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <VideoGrid onRemoveGuest={onRemoveGuest} />
    </div>
  );
}
