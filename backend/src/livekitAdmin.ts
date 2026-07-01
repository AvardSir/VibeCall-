import { RoomServiceClient } from 'livekit-server-sdk';
import type { AppConfig } from './config.js';
import { logger } from './logger.js';

export type ParticipantSummary = { identity: string; name: string };

export type LivekitAdmin = {
  ensureRoom(roomId: string): Promise<void>;
  listParticipantCount(roomId: string): Promise<number>;
  listParticipants(roomId: string): Promise<ParticipantSummary[]>;
};

export function createLivekitAdmin(config: AppConfig): LivekitAdmin {
  const client = new RoomServiceClient(
    config.livekitHost,
    config.livekitApiKey,
    config.livekitApiSecret,
  );

  async function fetchParticipants(roomId: string): Promise<ParticipantSummary[]> {
    const participants = await client.listParticipants(roomId);
    return participants.map((p) => ({ identity: p.identity, name: p.name }));
  }

  return {
    async ensureRoom(roomId) {
      // Idempotent: createRoom on an existing room is a no-op upsert.
      await client.createRoom({
        name: roomId,
        maxParticipants: config.maxParticipants,
        emptyTimeout: config.emptyTimeoutSeconds,
      });
      logger.info({ room: roomId }, 'ensured room exists');
    },

    async listParticipantCount(roomId) {
      const participants = await fetchParticipants(roomId);
      return participants.length;
    },

    async listParticipants(roomId) {
      return fetchParticipants(roomId);
    },
  };
}
