import { describe, it, expect, vi } from 'vitest';
import { handleJoinChat, handleSendMessage } from './socket.js';
import type { ChatGatewayDeps, ChatSocketBinding } from './socket.js';
import { createChatService } from './chat.js';

function makeSocket() {
  const emitted: { event: string; payload: unknown }[] = [];
  const joined: string[] = [];
  const socket = {
    data: {} as { binding?: ChatSocketBinding },
    join: (room: string): void => {
      joined.push(room);
    },
    emit: (event: string, payload: unknown): void => {
      emitted.push({ event, payload });
    },
  };
  return { socket, emitted, joined };
}

function makeIo() {
  const broadcasts: { room: string; event: string; payload: unknown }[] = [];
  const io = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown): void => {
        broadcasts.push({ room, event, payload });
      },
    }),
  };
  return { io, broadcasts };
}

function makeDeps(participants: { identity: string; name: string }[]): ChatGatewayDeps {
  let seq = 0;
  return {
    config: { fixedRoomName: 'main', corsOrigin: '*' },
    admin: { listParticipants: vi.fn().mockResolvedValue(participants) },
    chat: createChatService({ now: () => 1000, newId: () => `m${++seq}` }),
  };
}

describe('handleJoinChat', () => {
  it('binds the socket and emits chat_history for a current member', async () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket, emitted, joined } = makeSocket();

    await handleJoinChat(socket, deps, { identity: 'p_1', role: 'guest' });

    expect(socket.data.binding).toEqual({ identity: 'p_1', displayName: 'Ann', roomName: 'main' });
    expect(joined).toEqual(['main']);
    expect(emitted).toEqual([{ event: 'chat_history', payload: [] }]);
  });

  it('rejects a non-member: no bind, no join, message_failed NOT_A_MEMBER', async () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket, emitted, joined } = makeSocket();

    await handleJoinChat(socket, deps, { identity: 'ghost', role: 'guest' });

    expect(socket.data.binding).toBeUndefined();
    expect(joined).toEqual([]);
    expect(emitted).toEqual([{ event: 'message_failed', payload: { code: 'NOT_A_MEMBER' } }]);
  });

  it('replays prior history to a new joiner', async () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    deps.chat.append(
      deps.chat.build({ roomName: 'main', senderIdentity: 'p_0', senderName: 'Bo', text: 'earlier' }),
    );
    const { socket, emitted } = makeSocket();

    await handleJoinChat(socket, deps, { identity: 'p_1', role: 'guest' });

    const history = emitted.find((e) => e.event === 'chat_history')?.payload as { text: string }[];
    expect(history.map((m) => m.text)).toEqual(['earlier']);
  });
});

describe('handleSendMessage', () => {
  function bound(deps: ChatGatewayDeps, binding: ChatSocketBinding) {
    const s = makeSocket();
    s.socket.data.binding = binding;
    return s;
  }

  it('stamps sender from the binding (not the payload) and broadcasts', () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket } = bound(deps, { identity: 'p_1', displayName: 'Ann', roomName: 'main' });
    const { io, broadcasts } = makeIo();

    // Even if a client sneaks extra fields, only `text` is read; sender comes from the binding.
    handleSendMessage(socket, io, deps, { text: 'hi' } as { text: string });

    expect(broadcasts).toHaveLength(1);
    const msg = broadcasts[0]!.payload as {
      senderIdentity: string;
      senderName: string;
      text: string;
    };
    expect(broadcasts[0]!.room).toBe('main');
    expect(broadcasts[0]!.event).toBe('chat_message');
    expect(msg).toMatchObject({ senderIdentity: 'p_1', senderName: 'Ann', text: 'hi' });
    expect(deps.chat.history('main')).toHaveLength(1);
  });

  it('keeps distinct senderIdentity for two participants sharing a display name', () => {
    const deps = makeDeps([
      { identity: 'p_1', name: 'Ann' },
      { identity: 'p_2', name: 'Ann' },
    ]);
    const { io, broadcasts } = makeIo();

    const a = bound(deps, { identity: 'p_1', displayName: 'Ann', roomName: 'main' });
    handleSendMessage(a.socket, io, deps, { text: 'from one' });
    const b = bound(deps, { identity: 'p_2', displayName: 'Ann', roomName: 'main' });
    handleSendMessage(b.socket, io, deps, { text: 'from two' });

    const ids = broadcasts.map((x) => (x.payload as { senderIdentity: string }).senderIdentity);
    expect(ids).toEqual(['p_1', 'p_2']);
  });

  it('rejects an unbound socket with NOT_A_MEMBER and does not broadcast', () => {
    const deps = makeDeps([]);
    const { socket, emitted } = makeSocket();
    const { io, broadcasts } = makeIo();

    handleSendMessage(socket, io, deps, { text: 'hi' });

    expect(emitted).toEqual([{ event: 'message_failed', payload: { code: 'NOT_A_MEMBER' } }]);
    expect(broadcasts).toEqual([]);
  });

  it('rejects empty text with EMPTY_MESSAGE (sender only)', () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket, emitted } = bound(deps, { identity: 'p_1', displayName: 'Ann', roomName: 'main' });
    const { io, broadcasts } = makeIo();

    handleSendMessage(socket, io, deps, { text: '   ' });

    expect(emitted).toEqual([{ event: 'message_failed', payload: { code: 'EMPTY_MESSAGE' } }]);
    expect(broadcasts).toEqual([]);
  });

  it('rejects > 1000 chars with TEXT_TOO_LONG', () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket, emitted } = bound(deps, { identity: 'p_1', displayName: 'Ann', roomName: 'main' });
    const { io } = makeIo();

    handleSendMessage(socket, io, deps, { text: 'a'.repeat(1001) });

    expect(emitted).toEqual([{ event: 'message_failed', payload: { code: 'TEXT_TOO_LONG' } }]);
  });
});
