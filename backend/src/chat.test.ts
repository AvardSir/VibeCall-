import { describe, it, expect } from 'vitest';
import { validateMessageText, createChatService, MAX_TEXT_LENGTH } from './chat.js';

describe('validateMessageText', () => {
  it('accepts normal text and returns it verbatim', () => {
    expect(validateMessageText('hello')).toEqual({ ok: true, value: 'hello' });
  });

  it('rejects blank / whitespace-only as EMPTY_MESSAGE', () => {
    expect(validateMessageText('   ')).toEqual({ ok: false, code: 'EMPTY_MESSAGE' });
    expect(validateMessageText('')).toEqual({ ok: false, code: 'EMPTY_MESSAGE' });
  });

  it('rejects non-string as EMPTY_MESSAGE', () => {
    expect(validateMessageText(undefined)).toEqual({ ok: false, code: 'EMPTY_MESSAGE' });
    expect(validateMessageText(42)).toEqual({ ok: false, code: 'EMPTY_MESSAGE' });
  });

  it('rejects > 1000 chars as TEXT_TOO_LONG', () => {
    expect(validateMessageText('a'.repeat(MAX_TEXT_LENGTH + 1))).toEqual({
      ok: false,
      code: 'TEXT_TOO_LONG',
    });
  });

  it('accepts exactly 1000 chars', () => {
    const text = 'a'.repeat(MAX_TEXT_LENGTH);
    expect(validateMessageText(text)).toEqual({ ok: true, value: text });
  });
});

describe('createChatService', () => {
  function make() {
    let seq = 0;
    return createChatService({ now: () => 1000, newId: () => `m${++seq}` });
  }

  it('builds a message stamping id and sentAt', () => {
    const chat = make();
    const msg = chat.build({
      roomName: 'main',
      senderIdentity: 'p_1',
      senderName: 'Ann',
      text: 'hi',
    });
    expect(msg).toEqual({
      id: 'm1',
      roomName: 'main',
      senderIdentity: 'p_1',
      senderName: 'Ann',
      sentAt: 1000,
      text: 'hi',
      attachments: [],
    });
  });

  it('appends messages to per-room history in order', () => {
    const chat = make();
    chat.append(chat.build({ roomName: 'main', senderIdentity: 'p_1', senderName: 'Ann', text: 'a' }));
    chat.append(chat.build({ roomName: 'main', senderIdentity: 'p_2', senderName: 'Bo', text: 'b' }));
    expect(chat.history('main').map((m) => m.text)).toEqual(['a', 'b']);
  });

  it('isolates history by room and returns a copy', () => {
    const chat = make();
    chat.append(chat.build({ roomName: 'main', senderIdentity: 'p_1', senderName: 'Ann', text: 'a' }));
    expect(chat.history('other')).toEqual([]);
    chat.history('main').push({} as never); // mutating the returned array must not affect internal state
    expect(chat.history('main')).toHaveLength(1);
  });

  it('clears history for a room', () => {
    const chat = make();
    chat.append(chat.build({ roomName: 'main', senderIdentity: 'p_1', senderName: 'Ann', text: 'a' }));
    chat.clear('main');
    expect(chat.history('main')).toEqual([]);
  });

  it('allows an empty text when attachments are present', () => {
    const chat = createChatService();
    const v = chat.validateMessage({ text: '   ', attachmentCount: 1 });
    expect(v.ok).toBe(true);
  });
  it('still rejects empty text with no attachments', () => {
    const chat = createChatService();
    expect(chat.validateMessage({ text: '', attachmentCount: 0 })).toMatchObject({ ok: false, code: 'EMPTY_MESSAGE' });
  });
  it('build carries attachments onto the message', () => {
    const chat = createChatService();
    const att = { fileId: 'f0', name: 'c.png', size: 3, mime: 'image/png', kind: 'image' as const, url: '/attachments/r1/f0/c.png' };
    const m = chat.build({ roomName: 'r1', senderIdentity: 'p_1', senderName: 'Ann', text: '', attachments: [att] });
    expect(m.attachments).toEqual([att]);
  });
});
