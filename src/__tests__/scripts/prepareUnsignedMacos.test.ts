/** @jest-environment node */

const path = require('node:path');

const {
  afterPack,
  removeMacAppSignature,
} = require('../../../scripts/prepare-unsigned-macos.cjs');

describe('prepare unsigned macOS package', () => {
  test('removes the inherited macOS signature from the packaged app', () => {
    const execute = jest.fn();

    removeMacAppSignature('/tmp/InkNote.app', execute);

    expect(execute).toHaveBeenCalledWith(
      'codesign',
      ['--remove-signature', '/tmp/InkNote.app'],
      { stdio: 'pipe' },
    );
  });

  test('only strips signatures from darwin packages', () => {
    const execute = jest.fn();

    afterPack(
      {
        electronPlatformName: 'win32',
        appOutDir: '/tmp/output',
        packager: { appInfo: { productFilename: 'InkNote' } },
      },
      execute,
    );

    expect(execute).not.toHaveBeenCalled();
  });

  test('strips the completed app bundle before macOS distributables are created', () => {
    const execute = jest.fn();

    afterPack(
      {
        electronPlatformName: 'darwin',
        appOutDir: '/tmp/output',
        packager: { appInfo: { productFilename: 'InkNote' } },
      },
      execute,
    );

    expect(execute).toHaveBeenCalledWith(
      'codesign',
      ['--remove-signature', path.join('/tmp/output', 'InkNote.app')],
      { stdio: 'pipe' },
    );
  });
});
