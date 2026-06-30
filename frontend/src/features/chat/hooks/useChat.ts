import { useCallback, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '../../../shared/lib/socketClient';
import { useChatStore } from '../../../stores/useChatStore';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import type { ChatMessage, ParticipantRole } from '../../../shared/types';

export type UseChatResult = { sendMessage: (text: string) => void };

export function useChat(role: ParticipantRole): UseChatResult {
  const localParticipant = useConnectionStore((s) => s.localParticipant);
  const phase = useConnectionStore((s) => s.phase);
  const setHistory = useChatStore((s) => s.setHistory);
  const receiveMessage = useChatStore((s) => s.receiveMessage);
  const addOptimistic = useChatStore((s) => s.addOptimistic);
  const markFailed = useChatStore((s) => s.markFailed);

  const socketRef = useRef<Socket | null>(null);
  const joinedRef = useRef(false);
  const clientSeq = useRef(0);

  useEffect(() => {
    if (!localParticipant) return;
    const identity = localParticipant.identity;
    const socket = createSocket();
    socketRef.current = socket;
    joinedRef.current = false;

    // Join only after LiveKit reports the call connected: the participant is
    // registered with the SFU by then, so the server's listParticipants()
    // membership check succeeds. Joining on the bare socket 'connect' races that
    // registration and is rejected as NOT_A_MEMBER with no recovery.
    const joinChat = (): void => {
      if (joinedRef.current) return;
      if (useConnectionStore.getState().phase !== 'connected') return;
      joinedRef.current = true;
      socket.emit('join_chat', { identity, role });
    };

    socket.on('connect', joinChat);
    socket.on('disconnect', () => {
      // A reconnect creates a fresh server-side binding, so allow re-joining.
      joinedRef.current = false;
    });
    socket.on('chat_history', (messages: ChatMessage[]) => setHistory(messages));
    socket.on('chat_message', (message: ChatMessage) => receiveMessage(message, identity));
    socket.on('message_failed', () => markFailed());

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      joinedRef.current = false;
    };
  }, [localParticipant, role, setHistory, receiveMessage, markFailed]);

  // Common case: the socket connected before LiveKit finished connecting, so the
  // 'connect' handler saw phase !== 'connected' and skipped. When the phase
  // transitions to 'connected', fire the still-pending join. joinedRef keeps this
  // idempotent with the 'connect' handler. socket.io buffers the emit if the
  // socket is not open yet and flushes it on connect.
  useEffect(() => {
    if (phase !== 'connected' || joinedRef.current) return;
    const socket = socketRef.current;
    if (!socket || !localParticipant) return;
    joinedRef.current = true;
    socket.emit('join_chat', { identity: localParticipant.identity, role });
  }, [phase, localParticipant, role]);

  const sendMessage = useCallback(
    (text: string) => {
      const socket = socketRef.current;
      if (!socket || !localParticipant) return;
      const clientId = `c_${clientSeq.current++}`;
      addOptimistic(clientId, text, localParticipant);
      socket.emit('send_message', { text });
    },
    [addOptimistic, localParticipant],
  );

  return { sendMessage };
}
