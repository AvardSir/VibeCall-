import { useCallback, useEffect, useRef } from 'react';
import { useSocket } from '../../../shared/hooks/useSocket';
import { useChatStore } from '../../../stores/useChatStore';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import type { ChatMessage, ParticipantRole } from '../../../shared/types';

export type UseChatResult = { sendMessage: (text: string) => void };

export function useChat(role: ParticipantRole): UseChatResult {
  const socket = useSocket();
  const localParticipant = useConnectionStore((s) => s.localParticipant);
  const phase = useConnectionStore((s) => s.phase);
  const setHistory = useChatStore((s) => s.setHistory);
  const receiveMessage = useChatStore((s) => s.receiveMessage);
  const addOptimistic = useChatStore((s) => s.addOptimistic);
  const markFailed = useChatStore((s) => s.markFailed);

  const joinedRef = useRef(false);
  const clientSeq = useRef(0);

  useEffect(() => {
    if (!localParticipant) return;
    const identity = localParticipant.identity;
    joinedRef.current = false;

    // Join only after LiveKit reports the call connected: the participant is
    // registered with the SFU by then, so the server's listParticipants()
    // membership check succeeds. Joining on the bare socket 'connect' races that
    // registration and is rejected as NOT_A_MEMBER with no recovery.
    const handleConnect = (): void => {
      if (joinedRef.current) return;
      if (useConnectionStore.getState().phase !== 'connected') return;
      joinedRef.current = true;
      socket.emit('join_chat', { roomId: localParticipant.roomId, identity, role });
    };

    const handleDisconnect = (): void => {
      // A reconnect creates a fresh server-side binding, so allow re-joining.
      joinedRef.current = false;
    };

    const handleChatHistory = (messages: ChatMessage[]): void => setHistory(messages);

    const handleChatMessage = (message: ChatMessage): void => receiveMessage(message, identity);

    const handleMessageFailed = (): void => markFailed();

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('chat_history', handleChatHistory);
    socket.on('chat_message', handleChatMessage);
    socket.on('message_failed', handleMessageFailed);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('chat_history', handleChatHistory);
      socket.off('chat_message', handleChatMessage);
      socket.off('message_failed', handleMessageFailed);
      joinedRef.current = false;
    };
  }, [localParticipant, role, socket, setHistory, receiveMessage, markFailed]);

  // Common case: the socket connected before LiveKit finished connecting, so the
  // 'connect' handler saw phase !== 'connected' and skipped. When the phase
  // transitions to 'connected', fire the still-pending join. joinedRef keeps this
  // idempotent with the 'connect' handler. socket.io buffers the emit if the
  // socket is not open yet and flushes it on connect.
  useEffect(() => {
    if (phase !== 'connected' || joinedRef.current) return;
    if (!localParticipant) return;
    joinedRef.current = true;
    socket.emit('join_chat', { roomId: localParticipant.roomId, identity: localParticipant.identity, role });
  }, [phase, localParticipant, role, socket]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!localParticipant) return;
      const clientId = `c_${clientSeq.current++}`;
      addOptimistic(clientId, text, localParticipant);
      socket.emit('send_message', { text });
    },
    [addOptimistic, localParticipant, socket],
  );

  return { sendMessage };
}
