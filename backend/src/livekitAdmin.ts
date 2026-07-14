import { RoomServiceClient } from 'livekit-server-sdk';
import type { AppConfig } from './config.js';
import { logger } from './logger.js';

export type ParticipantSummary = { identity: string; name: string };

export type LivekitAdmin = {
  ensureRoom(): Promise<void>;
  listParticipantCount(): Promise<number>;
  listParticipants(): Promise<ParticipantSummary[]>;
};

export function createLivekitAdmin(config: AppConfig): LivekitAdmin {
  const client = new RoomServiceClient(
    config.livekitHost,
    config.livekitApiKey,
    config.livekitApiSecret,
  );

  async function fetchParticipants(): Promise<ParticipantSummary[]> {
    const participants = await client.listParticipants(config.fixedRoomName);
    return participants.map((p) => ({ identity: p.identity, name: p.name }));
  }

  return {
    async ensureRoom() {
      // Idempotent: createRoom on an existing room is a no-op upsert.
      await client.createRoom({
        name: config.fixedRoomName,
        maxParticipants: config.maxParticipants,
        emptyTimeout: config.emptyTimeoutSeconds,
      });
      logger.info({ room: config.fixedRoomName }, 'ensured fixed room exists');
    },

    async listParticipantCount() {
      const participants = await fetchParticipants();
      return participants.length;
    },

    async listParticipants() {
      return fetchParticipants();
    },
  };
}
