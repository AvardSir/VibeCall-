import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../hooks/useParticipants', () => ({ useParticipants: () => undefined }));
vi.mock('./VideoGrid', () => ({ VideoGrid: () => <div data-testid="video-grid" /> }));
vi.mock('./ScreenShareView', () => ({ ScreenShareView: () => <div data-testid="screen-share-view" /> }));
vi.mock('./ThumbnailStrip', () => ({ ThumbnailStrip: () => <div data-testid="thumbnail-strip" /> }));

import { CallStage } from './CallStage';

describe('CallStage', () => {
  it('renders the video grid when nobody is sharing', () => {
    render(<CallStage activeSharerId={null} />);
    expect(screen.getByTestId('video-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-share-view')).not.toBeInTheDocument();
  });

  it('renders the share view and thumbnail strip when someone is sharing', () => {
    render(<CallStage activeSharerId="p_1" />);
    expect(screen.getByTestId('screen-share-view')).toBeInTheDocument();
    expect(screen.getByTestId('thumbnail-strip')).toBeInTheDocument();
    expect(screen.queryByTestId('video-grid')).not.toBeInTheDocument();
  });

  it('keeps min-h-0 on the share-layout column so the shared video cannot push the strip off-screen', () => {
    // Regression guard: without min-h-0 the flex-1 column cannot shrink to its track, the async-sized
    // shared <video> balloons, and overflow-hidden clips the thumbnail strip on wide viewports.
    const { container } = render(<CallStage activeSharerId="p_1" />);
    expect(container.firstChild).toHaveClass('min-h-0');
  });
});
