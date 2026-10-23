/** @jest-environment node */

import {
  createDataIpcFailure,
  createDataIpcSuccess,
  unwrapDataIpcResult,
} from '../../../shared/data/data.ipc';
import {
  DataManagementError,
  createInvalidDataPathError,
} from '../../../shared/data/data.errors';
import {
  validateDataManagementInfo,
  validateExportResult,
} from '../../../shared/data/data.types';
import { IPC_CHANNELS } from '../../../shared/ipc/channels';

describe('data-management IPC contract', () => {
  it('round-trips a frozen management info payload', () => {
    const result = createDataIpcSuccess({
      dataDirectory: '/private/inknote',
      backupDirectory: '/private/backup',
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(unwrapDataIpcResult(result, validateDataManagementInfo)).toEqual({
      dataDirectory: '/private/inknote',
      backupDirectory: '/private/backup',
    });
  });

  it('reconstructs a typed path error instead of forwarding an Error object', () => {
    const result = createDataIpcFailure(
      createInvalidDataPathError('Backup directory must be absolute.'),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INVALID_DATA_PATH',
        message: 'Backup directory must be absolute.',
      },
    });

    expect(() =>
      unwrapDataIpcResult(result, validateDataManagementInfo),
    ).toThrow(DataManagementError);
  });

  it('rejects malformed successful payloads from the preload boundary', () => {
    expect(() =>
      unwrapDataIpcResult(
        { ok: true, value: { dataDirectory: '', backupDirectory: 3 } },
        validateDataManagementInfo,
      ),
    ).toThrow('invalid response');
  });

  it('accepts only non-negative whole-note counts for exports', () => {
    expect(
      unwrapDataIpcResult(
        {
          ok: true,
          value: { directory: '/private/export', exportedNotes: 2 },
        },
        validateExportResult,
      ),
    ).toEqual({ directory: '/private/export', exportedNotes: 2 });

    expect(() =>
      unwrapDataIpcResult(
        {
          ok: true,
          value: { directory: '/private/export', exportedNotes: -1 },
        },
        validateExportResult,
      ),
    ).toThrow('invalid response');
  });

  it('keeps data-management actions on dedicated IPC channels', () => {
    expect(IPC_CHANNELS.data.getInfo).toBe('data:get-info');
    expect(IPC_CHANNELS.data.chooseDirectory).toBe('data:choose-directory');
    expect(IPC_CHANNELS.data.configureBackup).toBe('data:configure-backup');
    expect(IPC_CHANNELS.data.restoreBackup).toBe('data:restore-backup');
    expect(IPC_CHANNELS.data.exportMarkdown).toBe('data:export-markdown');
  });
});
