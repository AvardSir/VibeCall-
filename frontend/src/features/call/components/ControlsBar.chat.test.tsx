import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../shared/i18n';
import { ControlsBar } from './ControlsBar';
import { useChatStore } from '../../../stores/useChatStore';

// ControlsBar uses the LiveKit local-participant hook; stub it (no room context in this test).
vi.mock('@livekit/components-react', () => ({
  useLocalParticipant: () => ({
    localParticipant: { setMicrophoneEnabled: vi.fn(), setCameraEnabled: vi.fn() },
  }),
}));

// The screen-share hook pulls in a socket + room context we don't wire here; stub it inert.
vi.mock('../hooks/useScreenShare', () => ({
  useScreenShare: () => ({ isSharing: false, isBusy: false, error: null, toggle: vi.fn() }),
}));

describe('ControlsBar chat button', () => {
  beforeEach(() => useChatStore.getState().reset());

  it('renders a dark chat control when the panel is closed and flips to active (blue) when open', async () => {
    render(
      <ControlsBar onLeave={vi.fn()} onEndCall={vi.fn()} role="guest" participantUrl="https://app/r/r1" />,
    );
    const btn = screen.getByRole('button', { name: 'Chat' });
    expect(btn).toHaveClass('size-12', 'rounded-[30px]', 'bg-slate-200');

    await userEvent.click(btn);
    expect(useChatStore.getState().isPanelOpen).toBe(true);
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveClass('bg-accent');
  });

  it('shows the unread badge count and clears it on open', async () => {
    useChatStore.setState({ unreadCount: 2 });
    render(
      <ControlsBar onLeave={vi.fn()} onEndCall={vi.fn()} role="guest" participantUrl="https://app/r/r1" />,
    );
    expect(screen.getByTestId('chat-unread')).toHaveTextContent('2');

    await userEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(useChatStore.getState().isPanelOpen).toBe(true);
    expect(useChatStore.getState().unreadCount).toBe(0);
    expect(screen.queryByTestId('chat-unread')).not.toBeInTheDocument();
  });

  it('toggles the panel closed on a second click', async () => {
    render(
      <ControlsBar onLeave={vi.fn()} onEndCall={vi.fn()} role="guest" participantUrl="https://app/r/r1" />,
    );
    const btn = screen.getByRole('button', { name: 'Chat' });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(useChatStore.getState().isPanelOpen).toBe(false);
  });
});
