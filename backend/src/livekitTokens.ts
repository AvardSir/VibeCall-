import { AccessToken } from 'livekit-server-sdk';
import type { AppConfig } from './config.js';

export type GuestTokenInput = {
  identity: string;
  displayName: string;
  room: string;
};

export type TokenMinter = {
  mintGuestToken(input: GuestTokenInput): Promise<string>;
};

export function createTokenMinter(
  config: Pick<AppConfig, 'livekitApiKey' | 'livekitApiSecret'>,
): TokenMinter {
  return {
    async mintGuestToken({ identity, displayName, room }) {
      const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
        identity,
        name: displayName,
      });
      at.addGrant({
        roomJoin: true,
        room,
        canPublish: true,
        canSubscribe: true,
        // No roomAdmin: guests cannot perform host actions (deferred to master spec).
      });
      return at.toJwt();
    },
  };
}
