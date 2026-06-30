import { describe, it, expect } from 'vitest';
import { createTokenMinter } from './livekitTokens.js';

describe('createTokenMinter', () => {
  const minter = createTokenMinter({ livekitApiKey: 'devkey', livekitApiSecret: 'secret-secret-secret' });

  it('mints a JWT (three dot-separated segments)', async () => {
    const jwt = await minter.mintGuestToken({ identity: 'p_1', displayName: 'Ann', room: 'main' });
    expect(jwt.split('.')).toHaveLength(3);
  });

  it('encodes the identity and grants in the payload (no roomAdmin)', async () => {
    const jwt = await minter.mintGuestToken({ identity: 'p_1', displayName: 'Ann', room: 'main' });
    const payloadPart = jwt.split('.')[1] ?? '';
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString());
    expect(payload.sub).toBe('p_1');
    expect(payload.video.room).toBe('main');
    expect(payload.video.roomJoin).toBe(true);
    expect(payload.video.canPublish).toBe(true);
    expect(payload.video.canSubscribe).toBe(true);
    expect(payload.video.roomAdmin).toBeFalsy();
  });
});
