export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// Mirror of backend's ALLOWED map from attachments.ts
const ALLOWED: Record<string, { mimes: string[]; kind: 'image' | 'file' }> = {
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

export const ALLOWED_EXTENSIONS = new Set(Object.keys(ALLOWED));

export const MAX_FILES_PER_MESSAGE = 5;

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

type ValidationSuccess = { ok: true };
type ValidationFailure = { ok: false; errorKey: 'unsupportedType' | 'fileTooLarge' | 'tooManyFiles' };
type ValidationResult = ValidationSuccess | ValidationFailure;

export function validateStagedFile(file: File, currentCount: number): ValidationResult {
  // 1. Count check first
  if (currentCount >= MAX_FILES_PER_MESSAGE) {
    return { ok: false, errorKey: 'tooManyFiles' };
  }

  // 2. Type check
  const ext = extensionOf(file.name);
  const entry = ALLOWED[ext];

  if (!entry) {
    return { ok: false, errorKey: 'unsupportedType' };
  }

  // If file.type is non-empty, it should match one of the allowed mimes
  if (file.type && !entry.mimes.includes(file.type)) {
    return { ok: false, errorKey: 'unsupportedType' };
  }

  // 3. Size check
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, errorKey: 'fileTooLarge' };
  }

  return { ok: true };
}
