import { describe, it, expect } from 'vitest';
import { generateIdentity } from './identity.js';

describe('generateIdentity', () => {
  it('produces a p_ prefixed id', () => {
    expect(generateIdentity()).toMatch(/^p_[a-z0-9-]+$/i);
  });

  it('produces a unique id each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateIdentity()));
    expect(ids.size).toBe(100);
  });
});
