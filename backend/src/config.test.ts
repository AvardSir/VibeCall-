import { describe, it, expect } from 'vitest';
import { loadConfig, MAX_PARTICIPANTS } from './config.js';

const base = {
  LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's',
  LIVEKIT_URL: 'ws://localhost:7880', LIVEKIT_HOST: 'http://localhost:7880',
};

describe('loadConfig', () => {
  it('parses a valid env with defaults', () => {
    const cfg = loadConfig(base);
    expect(cfg.port).toBe(3000);
    expect(cfg.maxParticipants).toBe(MAX_PARTICIPANTS);
    expect(cfg.maxParticipants).toBe(4);
    expect('fixedRoomName' in cfg).toBe(false);
  });

  it('throws when a required LiveKit var is missing', () => {
    expect(() => loadConfig({ ...base, LIVEKIT_API_KEY: undefined })).toThrow();
  });

  it('throws when a LiveKit URL is not a valid URL', () => {
    expect(() => loadConfig({ ...base, LIVEKIT_URL: 'not-a-url' })).toThrow();
  });

  it('honours the PORT override', () => {
    const cfg = loadConfig({ ...base, PORT: '4000' });
    expect(cfg.port).toBe(4000);
  });

  it('defaults grace timeout to 60 and honours the override', () => {
    expect(loadConfig(base).graceTimeoutSeconds).toBe(60);
    expect(loadConfig({ ...base, GRACE_TIMEOUT_SECONDS: '5' }).graceTimeoutSeconds).toBe(5);
  });
});
