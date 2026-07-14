import { describe, it, expect, vi } from 'vitest';
import { createAttachmentService } from './attachments.js';

function memFs() {
  const files = new Map<string, Buffer>();
  const dirs = new Set<string>();
  return {
    files,
    dirs,
    mkdir: vi.fn(async (p: string) => {
      dirs.add(p);
    }),
    writeFile: vi.fn(async (p: string, b: Buffer) => {
      files.set(p, b);
    }),
    readdir: vi.fn(async () => [...dirs].map((d) => d.split('/').pop() as string)),
    rm: vi.fn(async (p: string) => {
      dirs.delete(p);
    }),
    access: vi.fn(async (p: string) => {
      if (![...files.keys()].some((k) => k.startsWith(p))) throw new Error('ENOENT');
    }),
  };
}

function make() {
  let n = 0;
  const fs = memFs();
  const svc = createAttachmentService({
    storageRoot: '/up',
    maxBytes: 10,
    newId: () => `f${n++}`,
    fs: fs as never,
  });
  return { svc, fs };
}

describe('attachmentService.validateAndStore', () => {
  it('stores an allowed image and returns tokenless metadata', async () => {
    const { svc, fs } = make();
    const a = await svc.validateAndStore({
      roomName: 'r1',
      originalName: 'cat.png',
      mime: 'image/png',
      buffer: Buffer.from('img'),
    });
    expect(a).toMatchObject({
      fileId: 'f0',
      name: 'cat.png',
      mime: 'image/png',
      kind: 'image',
      size: 3,
      url: '/attachments/r1/f0/cat.png',
    });
    expect(fs.writeFile).toHaveBeenCalledWith('/up/r1/f0__cat.png', expect.any(Buffer));
  });

  it('rejects an unsupported type', async () => {
    const { svc } = make();
    await expect(
      svc.validateAndStore({
        roomName: 'r1',
        originalName: 'a.exe',
        mime: 'application/octet-stream',
        buffer: Buffer.from('x'),
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_TYPE' });
  });

  it('rejects a mismatched mime for a good extension', async () => {
    const { svc } = make();
    await expect(
      svc.validateAndStore({
        roomName: 'r1',
        originalName: 'a.png',
        mime: 'text/plain',
        buffer: Buffer.from('x'),
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_TYPE' });
  });

  it('rejects an oversize file', async () => {
    const { svc } = make();
    await expect(
      svc.validateAndStore({
        roomName: 'r1',
        originalName: 'a.txt',
        mime: 'text/plain',
        buffer: Buffer.alloc(11),
      }),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('classifies a document as kind=file', async () => {
    const { svc } = make();
    const a = await svc.validateAndStore({
      roomName: 'r1',
      originalName: 'doc.pdf',
      mime: 'application/pdf',
      buffer: Buffer.from('x'),
    });
    expect(a.kind).toBe('file');
  });
});
