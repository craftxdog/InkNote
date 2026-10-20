import {
  createPluginRuntime,
  type PluginRuntime,
} from '../../../renderer/platform/environment/runtime';
import type { ConfigSchema } from '../../../renderer/platform/config/config.types';
import type { PluginEnvironment } from '../../../renderer/platform/environment/environment.types';
import type { KeymapTarget } from '../../../renderer/platform/keymaps/keymap.types';
import { PluginKernelError } from '../../../renderer/platform/plugins/plugin.errors';
import {
  createPluginId,
  type InkNotePlugin,
  type PluginId,
} from '../../../renderer/platform/plugins/plugin.types';

const editorId = createPluginId('editor');

const editorSchema = {
  vimEnabled: { type: 'boolean', default: true },
} as const satisfies ConfigSchema;

const editorTarget: KeymapTarget = {
  matches: (context) => (context === 'editor.focused' ? 1 : null),
};

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

const createRuntime = (): PluginRuntime =>
  createPluginRuntime({ appVersion: '0.1.0', devMode: true });

const requireEnvironment = <S extends ConfigSchema>(
  environment: PluginEnvironment<S> | null,
): PluginEnvironment<S> => {
  if (environment === null) {
    throw new Error('Expected plugin activation to capture an environment.');
  }

  return environment;
};

describe('PluginManager', () => {
  it('hydrates before activation and cleans every scoped contribution on deactivation', async () => {
    const runtime = createRuntime();
    const observer = jest.fn();
    const handler = jest.fn();
    let environment: PluginEnvironment<typeof editorSchema> | null = null;

    const plugin: InkNotePlugin<typeof editorSchema> = {
      id: editorId,
      config: editorSchema,
      activate: (env) => {
        environment = env;
        env.config.observe('vimEnabled', observer);
        env.commands.add('editor:toggle-vim-mode', handler);
        env.keymaps.add([
          {
            context: 'editor.focused',
            keystrokes: ['mod-v'],
            command: 'editor:toggle-vim-mode',
          },
        ]);
      },
    };

    await runtime.plugins.activate(plugin);

    expect(observer).toHaveBeenCalledWith(true);
    await expect(
      runtime.commands.dispatch('editor:toggle-vim-mode', { source: 'keymap' }),
    ).resolves.toBe(true);
    expect(handler).toHaveBeenCalledWith({ source: 'keymap' });
    expect(runtime.keymaps.resolve(['mod-v'], [editorTarget])).toMatchObject({
      kind: 'matched',
      binding: { command: 'editor:toggle-vim-mode' },
    });

    await expect(runtime.plugins.deactivate(editorId)).resolves.toBe(true);

    const capturedEnvironment = requireEnvironment(environment);

    await expect(
      runtime.commands.dispatch('editor:toggle-vim-mode', { source: 'api' }),
    ).resolves.toBe(false);
    expect(runtime.keymaps.resolve(['mod-v'], [editorTarget])).toEqual({
      kind: 'none',
    });
    await expect(
      capturedEnvironment.config.set('vimEnabled', false),
    ).rejects.toMatchObject({ code: 'PLUGIN_SCOPE_CLOSED' });
    expectKernelError(
      () =>
        capturedEnvironment.commands.add('editor:toggle-vim-mode', jest.fn()),
      'PLUGIN_SCOPE_CLOSED',
    );
  });

  it('rolls back partial activation and closes an environment captured by a failing plugin', async () => {
    const runtime = createRuntime();
    const expected = new Error('activation failed');
    let environment: PluginEnvironment<typeof editorSchema> | null = null;

    const plugin: InkNotePlugin<typeof editorSchema> = {
      id: editorId,
      config: editorSchema,
      activate: (env) => {
        environment = env;
        env.commands.add('editor:toggle-vim-mode', jest.fn());
        env.keymaps.add([
          {
            context: 'editor.focused',
            keystrokes: ['mod-v'],
            command: 'editor:toggle-vim-mode',
          },
        ]);
        throw expected;
      },
    };

    await expect(runtime.plugins.activate(plugin)).rejects.toBe(expected);

    expect(runtime.plugins.isActive(editorId)).toBe(false);
    await expect(
      runtime.commands.dispatch('editor:toggle-vim-mode', { source: 'api' }),
    ).resolves.toBe(false);
    expect(runtime.keymaps.resolve(['mod-v'], [editorTarget])).toEqual({
      kind: 'none',
    });
    expectKernelError(
      () => requireEnvironment(environment).keymaps.add([]),
      'PLUGIN_SCOPE_CLOSED',
    );
  });

  it('rejects duplicate activation and finishes cleanup when deactivate throws', async () => {
    const runtime = createRuntime();
    const expected = new Error('deactivation failed');

    const plugin: InkNotePlugin<typeof editorSchema> = {
      id: editorId,
      config: editorSchema,
      activate: (env) => {
        env.commands.add('editor:toggle-vim-mode', jest.fn());
      },
      deactivate: () => {
        throw expected;
      },
    };

    await runtime.plugins.activate(plugin);

    await expect(runtime.plugins.activate(plugin)).rejects.toMatchObject({
      code: 'PLUGIN_ALREADY_ACTIVE',
    });
    await expect(runtime.plugins.deactivate(editorId)).rejects.toBe(expected);

    expect(runtime.plugins.isActive(editorId)).toBe(false);
    await expect(
      runtime.commands.dispatch('editor:toggle-vim-mode', { source: 'api' }),
    ).resolves.toBe(false);
    await expect(runtime.plugins.deactivate(editorId)).resolves.toBe(false);
  });

  it('removes config observers but preserves values across plugin reactivation', async () => {
    const runtime = createRuntime();
    const observer = jest.fn();
    const firstPlugin: InkNotePlugin<typeof editorSchema> = {
      id: editorId,
      config: editorSchema,
      activate: async (env) => {
        env.config.observe('vimEnabled', observer);
        await env.config.set('vimEnabled', false);
      },
    };

    await runtime.plugins.activate(firstPlugin);
    await runtime.plugins.deactivate(editorId);

    const secondPlugin: InkNotePlugin<typeof editorSchema> = {
      id: editorId,
      config: editorSchema,
      activate: async (env) => {
        expect(env.config.get('vimEnabled')).toBe(false);
        await env.config.set('vimEnabled', true);
      },
    };

    await runtime.plugins.activate(secondPlugin);

    expect(observer).toHaveBeenCalledTimes(2);
    expect(observer).toHaveBeenNthCalledWith(1, true);
    expect(observer).toHaveBeenNthCalledWith(2, false);
  });

  it('does not share registrations across runtime instances', async () => {
    const firstRuntime = createRuntime();
    const secondRuntime = createRuntime();
    const plugin = createCommandPlugin(editorId);

    await firstRuntime.plugins.activate(plugin);

    expect(
      await firstRuntime.commands.dispatch('editor:toggle-vim-mode', {
        source: 'api',
      }),
    ).toBe(true);
    expect(
      await secondRuntime.commands.dispatch('editor:toggle-vim-mode', {
        source: 'api',
      }),
    ).toBe(false);
  });
});

const createCommandPlugin = (id: PluginId): InkNotePlugin => ({
  id,
  activate: (env) => {
    env.commands.add('editor:toggle-vim-mode', jest.fn());
  },
});
