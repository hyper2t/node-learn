import type { UploadPurpose } from '@/types/api';
import type { PickedFile } from './pick';

/** Client-side pre-checks; the server enforces the same limits. Pure module (no env) so it is unit-testable. */
export const UPLOAD_LIMITS: Record<UploadPurpose, { maxBytes: number; mime: RegExp; label: string }> = {
  avatar: { maxBytes: 2 * 1024 * 1024, mime: /^image\/(jpeg|png|webp)$/, label: 'JPG, PNG or WebP up to 2 MB' },
  evidence: { maxBytes: 25 * 1024 * 1024, mime: /^(image\/(jpeg|png|webp)|application\/(pdf|zip)|text\/(plain|markdown))$/, label: 'Images, PDF, ZIP, text or Markdown up to 25 MB' },
  qa: { maxBytes: 25 * 1024 * 1024, mime: /^(image\/(jpeg|png|webp)|application\/(pdf|zip)|text\/(plain|markdown))$/, label: 'Images, PDF, ZIP, text or Markdown up to 25 MB' },
};

export class UploadError extends Error {
  constructor(readonly code: 'too_large' | 'unsupported' | 'failed', message: string) { super(message); this.name = 'UploadError'; }
}

export function validateFile(purpose: UploadPurpose, f: PickedFile): void {
  const lim = UPLOAD_LIMITS[purpose];
  if (f.size && f.size > lim.maxBytes) throw new UploadError('too_large', `This file is too large (${lim.label}).`);
  if (!lim.mime.test(f.mimeType)) throw new UploadError('unsupported', `This file type is not supported (${lim.label}).`);
}
