import { RoomServiceClient } from 'livekit-server-sdk';
import type { AppConfig } from './config.js';
import { logger } from './logger.js';

export type LivekitAdmin = {
  ensureRoom(): Promise<void>;
  listParticipantCount(): Promise<number>;
};

export function createLivekitAdmin(config: AppConfig): LivekitAdmin {
  const client = new RoomServiceClient(
    config.livekitHost,
    config.livekitApiKey,
    config.livekitApiSecret,
  );

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
      const participants = await client.listParticipants(config.fixedRoomName);
      return participants.length;
    },
  };
}
