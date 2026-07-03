import { useCallback, useEffect, useRef } from 'react';
import { useSocket } from '../../../shared/hooks/useSocket';
import { useChatStore } from '../../../stores/useChatStore';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import { uploadAttachment } from '../../../shared/lib/apiClient';
import type { ChatMessage, ParticipantRole, Attachment, UploadResult } from '../../../shared/types';
import type { StagedFile } from '../../../stores/useChatStore';

export type UseChatResult = { sendMessage: (text: string, files?: StagedFile[]) => void };

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

    // The server's `message_failed` event carries only an error code, no client id, so it cannot be
    // mapped to a specific optimistic bubble. Fall back to the oldest still-sending message. (The
    // upload-failure path, by contrast, knows its client id and flips that exact message.)
    const handleMessageFailed = (): void => {
      const oldestSending = useChatStore.getState().messages.find((m) => m.status === 'sending');
      if (oldestSending) markFailed(oldestSending.key);
    };

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
    // `files` defaults to empty so text-only sends can call `sendMessage(text)` without attachments.
    (text: string, files: StagedFile[] = []) => {
      if (!localParticipant) return;
      const { roomId, memberToken } = localParticipant;
      const clientId = `c_${clientSeq.current++}`;

      // Trim leading/trailing whitespace so the optimistic bubble matches what the server broadcasts
      // (the backend trims in validateMessage — VAL-ChatText).
      const trimmedText = text.trim();

      // Blob-URL previews let the optimistic bubble render attachments immediately, before the
      // upload resolves; ChatMessageItem (Task 17) swaps them for tokened URLs once delivered.
      const previews: Attachment[] = files.map((sf) => ({
        fileId: sf.id,
        name: sf.file.name,
        size: sf.file.size,
        mime: sf.file.type,
        kind: sf.file.type.startsWith('image/') ? 'image' : 'file',
        url: URL.createObjectURL(sf.file),
      }));
      // Retain the staged files on the optimistic item so a failed send can be restored & resent.
      addOptimistic(clientId, trimmedText, localParticipant, previews, files);

      void (async () => {
        try {
          const results = await Promise.all(files.map((sf) => uploadAttachment(roomId, memberToken, sf.file)));
          if (results.every((r) => r.ok)) {
            const uploaded = results.map((r) => (r as Extract<UploadResult, { ok: true }>).data);
            socket.emit('send_message', { text: trimmedText, attachments: uploaded });
          } else {
            markFailed(clientId);
          }
        } catch {
          markFailed(clientId);
        }
      })();
    },
    [addOptimistic, markFailed, localParticipant, socket],
  );

  return { sendMessage };
}
