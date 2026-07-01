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

describe('ControlsBar chat button', () => {
  beforeEach(() => useChatStore.getState().reset());

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
