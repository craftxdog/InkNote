/** @jest-environment node */

import {
  createDocumentIpcFailure,
  createDocumentIpcSuccess,
  runDocumentIpcOperation,
  unwrapDocumentIpcResult,
} from '../../../shared/documents/document.ipc';
import {
  DocumentDomainError,
  DocumentTransportError,
  createDocumentNotFoundError,
} from '../../../shared/documents/document.errors';

describe('document IPC result contract', () => {
  it('returns a frozen serializable success result', async () => {
    const result = await runDocumentIpcOperation(async () => ({
      documentId: 'note-1',
    }));

    expect(result).toEqual({ ok: true, value: { documentId: 'note-1' } });
    expect(Object.isFrozen(result)).toBe(true);
    expect(unwrapDocumentIpcResult(result, (value) => value)).toEqual({
      documentId: 'note-1',
    });
  });

  it('serializes a domain error and reconstructs it on the receiving side', () => {
    const result = createDocumentIpcFailure(
      createDocumentNotFoundError('missing-note'),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Document "missing-note" was not found.',
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.error)).toBe(true);

    expect(() => unwrapDocumentIpcResult(result, (value) => value)).toThrow(
      DocumentDomainError,
    );
    expect(() => unwrapDocumentIpcResult(result, (value) => value)).toThrow(
      expect.objectContaining({ code: 'DOCUMENT_NOT_FOUND' }),
    );
  });

  it('redacts unexpected main-process errors as an internal transport error', async () => {
    const result = await runDocumentIpcOperation(async () => {
      throw new Error('database path: /private/user-data/inknote.sqlite');
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The document operation could not be completed.',
      },
    });

    expect(() => unwrapDocumentIpcResult(result, (value) => value)).toThrow(
      DocumentTransportError,
    );
  });

  it('rejects malformed IPC responses instead of trusting a remote prototype', () => {
    expect(() =>
      unwrapDocumentIpcResult(
        {
          ok: false,
          error: { code: 'DOCUMENT_NOT_FOUND', message: 42 },
        },
        (value) => value,
      ),
    ).toThrow(DocumentTransportError);

    expect(() =>
      unwrapDocumentIpcResult(
        createDocumentIpcSuccess({ documentId: 'note-1' }),
        () => {
          throw new Error('invalid document projection');
        },
      ),
    ).toThrow(DocumentTransportError);
  });
});
