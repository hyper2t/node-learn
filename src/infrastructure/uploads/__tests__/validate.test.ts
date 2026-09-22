import { describe, expect, it } from 'vitest';
import { UPLOAD_LIMITS, UploadError, validateFile } from '../limits';

const f = (over: Partial<{ name: string; mimeType: string; size: number }> = {}) => ({ uri: 'file:///x', name: 'a.png', mimeType: 'image/png', size: 1024, kind: 'file' as const, ...over });

describe('validateFile', () => {
  it('accepts a small png for both purposes', () => {
    expect(() => validateFile('avatar', f())).not.toThrow();
    expect(() => validateFile('evidence', f())).not.toThrow();
  });
  it('rejects oversize files with a typed error', () => {
    expect(() => validateFile('avatar', f({ size: UPLOAD_LIMITS.avatar.maxBytes + 1 }))).toThrow(UploadError);
  });
  it('rejects disallowed mime types per purpose', () => {
    expect(() => validateFile('avatar', f({ name: 'a.pdf', mimeType: 'application/pdf' }))).toThrow(UploadError);
    expect(() => validateFile('evidence', f({ name: 'a.pdf', mimeType: 'application/pdf' }))).not.toThrow();
    expect(() => validateFile('evidence', f({ name: 'a.exe', mimeType: 'application/x-msdownload' }))).toThrow(UploadError);
  });
});
