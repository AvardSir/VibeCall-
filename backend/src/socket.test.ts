import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import {
  handleJoinChat,
  handleSendMessage,
  createSocketServer,
  emitGraceTick,
  emitRoomEnded,
} from './socket.js';
import type { ChatGatewayDeps, ChatSocketBinding, ChatSocket, ChatServer } from './socket.js';
import type { Server as HttpServer } from 'node:http';
import { createChatService } from './chat.js';
import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// Fake socket.io Server so createSocketServer does not bind a real port.
// We capture the connection handler to drive tests directly.
// ---------------------------------------------------------------------------
type ConnectionHandler = (socket: unknown) => void;

let capturedConnectionHandler: ConnectionHandler | undefined;

vi.mock('socket.io', () => {
  class Server {
    on(event: string, handler: ConnectionHandler): void {
      if (event === 'connection') capturedConnectionHandler = handler;
    }
  }
  return { Server };
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
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

function makeDeps(participants: { identity: string; name: string }[], roomId = 'r1'): ChatGatewayDeps {
  let seq = 0;
  return {
    config: { corsOrigin: '*' },
    admin: {
      listParticipants: vi.fn(async (id: string) => (id === roomId ? participants : [])),
    },
    chat: createChatService({ now: () => 1000, newId: () => `m${++seq}` }),
  };
}

// ---------------------------------------------------------------------------
// Helper: use the mocked Server to extract the send_message listener that
// createSocketServer registers, bound to a pre-bound fake socket.
// ---------------------------------------------------------------------------
function extractSendMessageListener(deps: ChatGatewayDeps, binding: ChatSocketBinding) {
  capturedConnectionHandler = undefined;

  // Fake http.Server — createSocketServer passes it to `new Server(httpServer, ...)`.
  // The mock ignores the arguments, so {} is fine.
  const fakeHttpServer = {} as HttpServer;
  createSocketServer(fakeHttpServer, deps);

  // The Server mock captures the connection handler registered by createSocketServer.
  const connectionHandler: ConnectionHandler | undefined = capturedConnectionHandler;
  if (connectionHandler === undefined) throw new Error('connection handler was not registered');

  // Build a fake socket that records which event listeners are registered.
  const listeners: Record<string, (payload: unknown) => void> = {};
  const fakeSocket = {
    data: { binding } as { binding?: ChatSocketBinding },
    join: (_room: string): void => {},
    emit: (_event: string, _payload: unknown): void => {},
    on: (event: string, handler: (payload: unknown) => void): void => {
      listeners[event] = handler;
    },
  };

  // Trigger the connection callback — this causes createSocketServer to call
  // socket.on('send_message', ...) on our fake socket.
  const handler: ConnectionHandler = connectionHandler;
  handler(fakeSocket);

  const sendMessageListener = listeners['send_message'];
  if (!sendMessageListener) throw new Error('send_message listener was not registered');
  return sendMessageListener;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('handleJoinChat', () => {
  it('binds the socket and emits chat_history for a current member', async () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket, emitted, joined } = makeSocket();

    await handleJoinChat(socket as unknown as ChatSocket, deps, { roomId: 'r1', identity: 'p_1', role: 'guest' });

    expect(socket.data.binding).toEqual({ identity: 'p_1', displayName: 'Ann', roomName: 'r1' });
    expect(joined).toEqual(['r1']);
    expect(emitted).toEqual([{ event: 'chat_history', payload: [] }]);
  });

  it('rejects a non-member: no bind, no join, message_failed NOT_A_MEMBER', async () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket, emitted, joined } = makeSocket();

    await handleJoinChat(socket as unknown as ChatSocket, deps, { roomId: 'r1', identity: 'ghost', role: 'guest' });

    expect(socket.data.binding).toBeUndefined();
    expect(joined).toEqual([]);
    expect(emitted).toEqual([{ event: 'message_failed', payload: { code: 'NOT_A_MEMBER' } }]);
  });

  it('rejects a join with a missing roomId', async () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket, emitted } = makeSocket();

    await handleJoinChat(socket as unknown as ChatSocket, deps, { roomId: '', identity: 'p_1', role: 'guest' });

    expect(socket.data.binding).toBeUndefined();
    expect(emitted).toEqual([{ event: 'message_failed', payload: { code: 'NOT_A_MEMBER' } }]);
    expect(deps.admin.listParticipants).not.toHaveBeenCalled();
  });

  it('replays prior history to a new joiner', async () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    deps.chat.append(
      deps.chat.build({ roomName: 'r1', senderIdentity: 'p_0', senderName: 'Bo', text: 'earlier' }),
    );
    const { socket, emitted } = makeSocket();

    await handleJoinChat(socket as unknown as ChatSocket, deps, { roomId: 'r1', identity: 'p_1', role: 'guest' });

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
    handleSendMessage(socket as unknown as ChatSocket, io as unknown as ChatServer, deps, { text: 'hi' } as { text: string });

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
    handleSendMessage(a.socket as unknown as ChatSocket, io as unknown as ChatServer, deps, { text: 'from one' });
    const b = bound(deps, { identity: 'p_2', displayName: 'Ann', roomName: 'main' });
    handleSendMessage(b.socket as unknown as ChatSocket, io as unknown as ChatServer, deps, { text: 'from two' });

    const ids = broadcasts.map((x) => (x.payload as { senderIdentity: string }).senderIdentity);
    expect(ids).toEqual(['p_1', 'p_2']);
  });

  it('rejects an unbound socket with NOT_A_MEMBER and does not broadcast', () => {
    const deps = makeDeps([]);
    const { socket, emitted } = makeSocket();
    const { io, broadcasts } = makeIo();

    handleSendMessage(socket as unknown as ChatSocket, io as unknown as ChatServer, deps, { text: 'hi' });

    expect(emitted).toEqual([{ event: 'message_failed', payload: { code: 'NOT_A_MEMBER' } }]);
    expect(broadcasts).toEqual([]);
  });

  it('rejects empty text with EMPTY_MESSAGE (sender only)', () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket, emitted } = bound(deps, { identity: 'p_1', displayName: 'Ann', roomName: 'main' });
    const { io, broadcasts } = makeIo();

    handleSendMessage(socket as unknown as ChatSocket, io as unknown as ChatServer, deps, { text: '   ' });

    expect(emitted).toEqual([{ event: 'message_failed', payload: { code: 'EMPTY_MESSAGE' } }]);
    expect(broadcasts).toEqual([]);
  });

  it('rejects > 1000 chars with TEXT_TOO_LONG', () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket, emitted } = bound(deps, { identity: 'p_1', displayName: 'Ann', roomName: 'main' });
    const { io } = makeIo();

    handleSendMessage(socket as unknown as ChatSocket, io as unknown as ChatServer, deps, { text: 'a'.repeat(1001) });

    expect(emitted).toEqual([{ event: 'message_failed', payload: { code: 'TEXT_TOO_LONG' } }]);
  });
});

describe('createSocketServer — send_message listener error handling', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'error');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not propagate an error thrown by handleSendMessage and logs it via logger.error', () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const throwingError = new Error('validateText exploded');
    deps.chat.validateText = () => {
      throw throwingError;
    };

    const binding: ChatSocketBinding = { identity: 'p_1', displayName: 'Ann', roomName: 'main' };
    const listener = extractSendMessageListener(deps, binding);

    // Without the try/catch fix, the error would propagate here and the test would fail.
    expect(() => listener({ text: 'hi' })).not.toThrow();
    expect(logger.error).toHaveBeenCalledOnce();
    const call = vi.mocked(logger.error).mock.calls[0];
    expect((call?.[0] as { err: unknown }).err).toBe(throwingError);
  });
});

describe('lifecycle broadcast helpers', () => {
  it('emitGraceTick broadcasts to the room channel', () => {
    const emit = vi.fn();
    const io = { to: vi.fn(() => ({ emit })) } as never;
    emitGraceTick(io, 'r1', 42);
    expect((io as { to: Mock }).to).toHaveBeenCalledWith('r1');
    expect(emit).toHaveBeenCalledWith('grace_tick', { secondsLeft: 42 });
  });

  it('emitRoomEnded broadcasts the reason to the room channel', () => {
    const emit = vi.fn();
    const io = { to: vi.fn(() => ({ emit })) } as never;
    emitRoomEnded(io, 'r1', 'host_ended');
    expect(emit).toHaveBeenCalledWith('room_ended', { reason: 'host_ended' });
  });
});
