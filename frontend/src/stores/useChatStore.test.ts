import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from './useChatStore';
import type { ChatMessage } from '../shared/types';

const SELF = { identity: 'p_self', displayName: 'Me' };

function serverMsg(over: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'srv1',
    roomName: 'main',
    senderIdentity: 'p_other',
    senderName: 'Other',
    sentAt: 1000,
    text: 'hello',
    ...over,
  };
}

describe('useChatStore', () => {
  beforeEach(() => useChatStore.getState().reset());

  it('defaults to empty, closed, no unread', () => {
    const s = useChatStore.getState();
    expect(s.messages).toEqual([]);
    expect(s.isPanelOpen).toBe(false);
    expect(s.unreadCount).toBe(0);
  });

  it('setHistory loads delivered items keyed by server id', () => {
    useChatStore.getState().setHistory([serverMsg({ id: 'a' }), serverMsg({ id: 'b', text: 'hi' })]);
    const msgs = useChatStore.getState().messages;
    expect(msgs.map((m) => m.key)).toEqual(['a', 'b']);
    expect(msgs.every((m) => m.status === 'delivered')).toBe(true);
  });

  it("increments unread on others' message while panel closed; not for own", () => {
    useChatStore.getState().receiveMessage(serverMsg({ senderIdentity: 'p_other' }), SELF.identity);
    expect(useChatStore.getState().unreadCount).toBe(1);
    useChatStore.getState().receiveMessage(serverMsg({ id: 'own', senderIdentity: SELF.identity }), SELF.identity);
    expect(useChatStore.getState().unreadCount).toBe(1); // own message does not bump unread
  });

  it('openPanel opens without clearing unread; markAllRead clears it', () => {
    useChatStore.getState().receiveMessage(serverMsg({}), SELF.identity);
    useChatStore.getState().openPanel();
    expect(useChatStore.getState().isPanelOpen).toBe(true);
    expect(useChatStore.getState().unreadCount).toBe(1); // opening no longer marks read
    useChatStore.getState().markAllRead();
    expect(useChatStore.getState().unreadCount).toBe(0);
    useChatStore.getState().receiveMessage(serverMsg({ id: 'srv2' }), SELF.identity);
    expect(useChatStore.getState().unreadCount).toBe(0); // received while open does not bump
  });

  it('optimistic message shows sending, then is reconciled to delivered on echo', () => {
    useChatStore.getState().addOptimistic('c1', 'hi there', SELF);
    let msgs = useChatStore.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ key: 'c1', status: 'sending', text: 'hi there', senderIdentity: 'p_self' });

    useChatStore
      .getState()
      .receiveMessage(serverMsg({ id: 'srv-echo', senderIdentity: SELF.identity, text: 'hi there' }), SELF.identity);
    msgs = useChatStore.getState().messages;
    expect(msgs).toHaveLength(1); // reconciled, not duplicated
    expect(msgs[0]).toMatchObject({ key: 'srv-echo', status: 'delivered' });
  });

  it('markFailed flips the first sending item to failed', () => {
    useChatStore.getState().addOptimistic('c1', 'a', SELF);
    useChatStore.getState().addOptimistic('c2', 'b', SELF);
    useChatStore.getState().markFailed();
    const msgs = useChatStore.getState().messages;
    expect(msgs[0]!.status).toBe('failed');
    expect(msgs[1]!.status).toBe('sending');
  });

  describe('togglePanel', () => {
    it('toggles from closed to open without clearing unreadCount', () => {
      useChatStore.setState({ isPanelOpen: false, unreadCount: 3 });
      useChatStore.getState().togglePanel();
      const s = useChatStore.getState();
      expect(s.isPanelOpen).toBe(true);
      expect(s.unreadCount).toBe(3); // togglePanel manages visibility only
    });

    it('toggles from open to closed and leaves unreadCount untouched', () => {
      useChatStore.setState({ isPanelOpen: true, unreadCount: 5 });
      useChatStore.getState().togglePanel();
      const s = useChatStore.getState();
      expect(s.isPanelOpen).toBe(false);
      expect(s.unreadCount).toBe(5);
    });

    it('idempotent double-toggle returns to the start visibility, unread untouched', () => {
      useChatStore.setState({ isPanelOpen: false, unreadCount: 2 });
      useChatStore.getState().togglePanel(); // → open
      useChatStore.getState().togglePanel(); // → closed
      const s = useChatStore.getState();
      expect(s.isPanelOpen).toBe(false);
      expect(s.unreadCount).toBe(2);
    });
  });

  it('reset clears everything', () => {
    useChatStore.getState().addOptimistic('c1', 'a', SELF);
    useChatStore.getState().receiveMessage(serverMsg({}), SELF.identity);
    useChatStore.getState().openPanel();
    useChatStore.getState().reset();
    const s = useChatStore.getState();
    expect(s.messages).toEqual([]);
    expect(s.isPanelOpen).toBe(false);
    expect(s.unreadCount).toBe(0);
  });
});
