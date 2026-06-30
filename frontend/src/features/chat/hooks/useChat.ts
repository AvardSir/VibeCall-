import { useCallback, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '../../../shared/lib/socketClient';
import { useChatStore } from '../../../stores/useChatStore';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import type { ChatMessage, ChatErrorCode, ParticipantRole } from '../../../shared/types';

export type UseChatResult = { sendMessage: (text: string) => void };

export function useChat(role: ParticipantRole): UseChatResult {
  const localParticipant = useConnectionStore((s) => s.localParticipant);
  const setHistory = useChatStore((s) => s.setHistory);
  const receiveMessage = useChatStore((s) => s.receiveMessage);
  const addOptimistic = useChatStore((s) => s.addOptimistic);
  const markFailed = useChatStore((s) => s.markFailed);

  const socketRef = useRef<Socket | null>(null);
  const clientSeq = useRef(0);

  useEffect(() => {
    if (!localParticipant) return;
    const identity = localParticipant.identity;
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_chat', { identity, role });
    });
    socket.on('chat_history', (messages: ChatMessage[]) => setHistory(messages));
    socket.on('chat_message', (message: ChatMessage) => receiveMessage(message, identity));
    socket.on('message_failed', (_payload: { code: ChatErrorCode }) => markFailed());

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [localParticipant, role, setHistory, receiveMessage, markFailed]);

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
