import {
  createPluginId,
  type PluginId,
} from '../../../renderer/platform/plugins/plugin.types';
import { PluginKernelError } from '../../../renderer/platform/plugins/plugin.errors';

describe('plugin identity', () => {
  const expectKernelError = (action: () => unknown, code: string): void => {
    try {
      action();
    } catch (error) {
      expect(error).toBeInstanceOf(PluginKernelError);
      expect(error).toMatchObject({ code });
      return;
    }

    throw new Error(`Expected plugin-kernel error ${code}.`);
  };

  it('creates a branded, canonical plugin ID', () => {
    expect(createPluginId('editor.vim')).toBe('editor.vim');
  });

  it.each(['', ' Editor', 'editor-', 'editor..vim', 'editor/vim'])(
    'rejects malformed plugin ID %p',
    (value) => {
      expect.hasAssertions();

      expectKernelError(() => createPluginId(value), 'INVALID_PLUGIN_ID');
    },
  );

  it('does not permit an arbitrary string where a PluginId is required', () => {
    const usePluginId = (id: PluginId): PluginId => id;

    expect(usePluginId(createPluginId('editor'))).toBe('editor');

    // @ts-expect-error Plugin IDs are nominal at TypeScript call sites.
    usePluginId('editor');
  });
});
