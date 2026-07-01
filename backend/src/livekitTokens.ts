import { AccessToken } from 'livekit-server-sdk';
import type { AppConfig } from './config.js';

export type GuestTokenInput = {
  identity: string;
  displayName: string;
  room: string;
};

export type TokenMinter = {
  mintGuestToken(input: GuestTokenInput): Promise<string>;
  mintHostToken(input: GuestTokenInput): Promise<string>;
};

export function createTokenMinter(
  config: Pick<AppConfig, 'livekitApiKey' | 'livekitApiSecret'>,
): TokenMinter {
  async function mint(input: GuestTokenInput, roomAdmin: boolean): Promise<string> {
    const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
      identity: input.identity,
      name: input.displayName,
    });
    at.addGrant({
      roomJoin: true,
      room: input.room,
      canPublish: true,
      canSubscribe: true,
      // roomAdmin is granted only to the host; M4 (remove guest / end call) relies on it.
      roomAdmin,
    });
    return at.toJwt();
  }

  return {
    mintGuestToken: (input) => mint(input, false),
    mintHostToken: (input) => mint(input, true),
  };
}
