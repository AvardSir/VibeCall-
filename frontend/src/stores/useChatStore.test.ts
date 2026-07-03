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
    attachments: [],
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

  it('markFailed flips the item matched by client id (not the first sending item)', () => {
    useChatStore.getState().addOptimistic('c1', 'a', SELF);
    useChatStore.getState().addOptimistic('c2', 'b', SELF);
    // The second send fails while the first is still in flight — only c2 must flip.
    useChatStore.getState().markFailed('c2');
    const msgs = useChatStore.getState().messages;
    expect(msgs[0]!.status).toBe('sending');
    expect(msgs[1]!.status).toBe('failed');
  });

  it('markFailed on an unknown id is a no-op', () => {
    useChatStore.getState().addOptimistic('c1', 'a', SELF);
    useChatStore.getState().markFailed('nope');
    expect(useChatStore.getState().messages[0]!.status).toBe('sending');
  });

  it('retryMessage restores a failed message text + staged files to the composer and drops the bubble', () => {
    const staged = { id: 's0', file: new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }) };
    useChatStore.getState().addOptimistic('c1', 'retry me', SELF, [], [staged]);
    useChatStore.getState().markFailed('c1');
    useChatStore.getState().retryMessage('c1');
    const s = useChatStore.getState();
    expect(s.messages).toEqual([]); // failed bubble removed
    expect(s.composerDraft).toBe('retry me'); // text handed back to the composer
    expect(s.stagedAttachments).toEqual([staged]); // attachments re-staged
  });

  it('clearComposerDraft resets the pending draft', () => {
    useChatStore.setState({ composerDraft: 'x' });
    useChatStore.getState().clearComposerDraft();
    expect(useChatStore.getState().composerDraft).toBeNull();
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

  it('stages and removes files', () => {
    const s = useChatStore.getState();
    const f = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
    s.addStaged(f);
    const id = useChatStore.getState().stagedAttachments[0].id;
    expect(useChatStore.getState().stagedAttachments).toHaveLength(1);
    useChatStore.getState().removeStaged(id);
    expect(useChatStore.getState().stagedAttachments).toHaveLength(0);
  });

  it('optimistic + delivered items carry attachments', () => {
    const s = useChatStore.getState();
    const att = { fileId: 'f0', name: 'c.png', size: 3, mime: 'image/png', kind: 'image' as const, url: '/attachments/r1/f0/c.png' };
    s.addOptimistic('c1', '', { identity: 'p_1', displayName: 'Ann' } as never, [att]);
    expect(useChatStore.getState().messages.at(-1)?.attachments).toEqual([att]);
  });
});
