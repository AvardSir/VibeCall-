import { describe, it, expect, vi } from 'vitest';

const removeParticipant = vi.fn().mockResolvedValue(undefined);
const deleteRoom = vi.fn().mockResolvedValue(undefined);
vi.mock('livekit-server-sdk', () => {
  class RoomServiceClient {
    createRoom = vi.fn().mockResolvedValue(undefined);
    listParticipants = vi.fn().mockResolvedValue([]);
    removeParticipant = removeParticipant;
    deleteRoom = deleteRoom;
  }
  return { RoomServiceClient };
});

import { createLivekitAdmin } from './livekitAdmin.js';
const config = { livekitHost: 'http://x', livekitApiKey: 'k', livekitApiSecret: 's', maxParticipants: 4, emptyTimeoutSeconds: 300 } as never;

describe('livekitAdmin host actions', () => {
  it('removeParticipant delegates to the SDK with roomId + identity', async () => {
    await createLivekitAdmin(config).removeParticipant('r1', 'p_1');
    expect(removeParticipant).toHaveBeenCalledWith('r1', 'p_1');
  });
  it('deleteRoom delegates to the SDK with roomId', async () => {
    await createLivekitAdmin(config).deleteRoom('r1');
    expect(deleteRoom).toHaveBeenCalledWith('r1');
  });
});
