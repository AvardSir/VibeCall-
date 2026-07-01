import { randomBytes } from 'node:crypto';
import * as fsPromises from 'node:fs/promises';
import { posix } from 'node:path';

const { join } = posix;
import { AppError } from './errors.js';
import { logger } from './logger.js';

export type AttachmentKind = 'image' | 'file';

export type Attachment = {
  fileId: string;
  name: string;
  size: number;
  mime: string;
  kind: AttachmentKind;
  url: string;
};

export type AttachmentService = {
  validateAndStore(input: {
    roomName: string;
    originalName: string;
    mime: string;
    buffer: Buffer;
  }): Promise<Attachment>;
  resolvePath(roomName: string, fileId: string): Promise<string | null>;
  deleteRoomFolder(roomName: string): Promise<void>;
  sweepOrphans(liveRoomIds: string[]): Promise<void>;
};

// Minimal surface of `node:fs/promises` this module depends on — injectable for tests.
export type FsLike = {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
  writeFile(path: string, data: Buffer): Promise<void>;
  readdir(path: string): Promise<string[]>;
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  access(path: string): Promise<void>;
};

export type AttachmentServiceDeps = {
  storageRoot: string;
  maxBytes: number;
  newId?: () => string;
  fs?: FsLike;
};

const ALLOWED: Record<string, { mimes: string[]; kind: AttachmentKind }> = {
  png: { mimes: ['image/png'], kind: 'image' },
  jpg: { mimes: ['image/jpeg'], kind: 'image' },
  jpeg: { mimes: ['image/jpeg'], kind: 'image' },
  gif: { mimes: ['image/gif'], kind: 'image' },
  webp: { mimes: ['image/webp'], kind: 'image' },
  pdf: { mimes: ['application/pdf'], kind: 'file' },
  doc: { mimes: ['application/msword'], kind: 'file' },
  docx: {
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    kind: 'file',
  },
  xls: { mimes: ['application/vnd.ms-excel'], kind: 'file' },
  xlsx: {
    mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    kind: 'file',
  },
  txt: { mimes: ['text/plain'], kind: 'file' },
  zip: { mimes: ['application/zip', 'application/x-zip-compressed'], kind: 'file' },
};

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

function sanitizeName(name: string): string {
  return name.replace(/[/\\]/g, '').replace(/[^\w.\- ]/g, '');
}

export function createAttachmentService(deps: AttachmentServiceDeps): AttachmentService {
  const fs = deps.fs ?? (fsPromises as unknown as FsLike);
  const newId = deps.newId ?? ((): string => randomBytes(16).toString('hex'));

  return {
    async validateAndStore({ roomName, originalName, mime, buffer }) {
      const ext = extensionOf(originalName);
      const entry = ALLOWED[ext];
      if (!entry || !entry.mimes.includes(mime)) {
        throw new AppError('UNSUPPORTED_TYPE');
      }
      if (buffer.length > deps.maxBytes) {
        throw new AppError('FILE_TOO_LARGE');
      }

      const fileId = newId();
      const sanitized = sanitizeName(originalName);
      const roomDir = join(deps.storageRoot, roomName);
      const filePath = join(roomDir, `${fileId}__${sanitized}`);

      await fs.mkdir(roomDir, { recursive: true });
      await fs.writeFile(filePath, buffer);

      logger.info({ roomName, fileId, name: sanitized }, 'attachment stored');

      return {
        fileId,
        name: sanitized,
        size: buffer.length,
        mime,
        kind: entry.kind,
        url: `/attachments/${roomName}/${fileId}/${sanitized}`,
      };
    },

    async resolvePath(roomName, fileId) {
      const roomDir = join(deps.storageRoot, roomName);
      let entries: string[];
      try {
        entries = await fs.readdir(roomDir);
      } catch (err) {
        logger.warn({ err, roomName, fileId }, 'attachment resolvePath: readdir failed');
        return null;
      }
      const prefix = `${fileId}__`;
      const match = entries.find((entry) => entry.startsWith(prefix));
      return match ? join(roomDir, match) : null;
    },

    async deleteRoomFolder(roomName) {
      await fs.rm(join(deps.storageRoot, roomName), { recursive: true, force: true });
    },

    async sweepOrphans(liveRoomIds) {
      let entries: string[];
      try {
        entries = await fs.readdir(deps.storageRoot);
      } catch (err) {
        logger.warn({ err }, 'attachment sweepOrphans: readdir failed');
        return;
      }
      const live = new Set(liveRoomIds);
      await Promise.all(
        entries
          .filter((entry) => !live.has(entry))
          .map(async (entry) => {
            await fs.rm(join(deps.storageRoot, entry), { recursive: true, force: true });
            logger.info({ roomName: entry }, 'attachment sweepOrphans: removed orphan folder');
          }),
      );
    },
  };
}
