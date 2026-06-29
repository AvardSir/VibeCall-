import { describe, it, expect } from 'vitest';
import { loadConfig, MAX_PARTICIPANTS } from './config.js';

const base = {
  LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's',
  LIVEKIT_URL: 'ws://localhost:7880', LIVEKIT_HOST: 'http://localhost:7880',
};

describe('loadConfig', () => {
  it('parses a valid env with defaults', () => {
    const cfg = loadConfig(base);
    expect(cfg.fixedRoomName).toBe('main');
    expect(cfg.port).toBe(3000);
    expect(cfg.maxParticipants).toBe(MAX_PARTICIPANTS);
    expect(cfg.maxParticipants).toBe(4);
  });

  it('throws when a required LiveKit var is missing', () => {
    expect(() => loadConfig({ ...base, LIVEKIT_API_KEY: undefined })).toThrow();
  });

  it('honours FIXED_ROOM_NAME and PORT overrides', () => {
    const cfg = loadConfig({ ...base, FIXED_ROOM_NAME: 'demo', PORT: '4000' });
    expect(cfg.fixedRoomName).toBe('demo');
    expect(cfg.port).toBe(4000);
  });
});
