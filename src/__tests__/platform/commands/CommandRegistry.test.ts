import { CommandRegistry } from '../../../renderer/platform/commands/CommandRegistry';
import { createPluginId } from '../../../renderer/platform/plugins/plugin.types';
import { PluginKernelError } from '../../../renderer/platform/plugins/plugin.errors';

describe('CommandRegistry', () => {
  const owner = createPluginId('editor');

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

  it('dispatches a namespaced command with an immutable invocation', async () => {
    const registry = new CommandRegistry();
    const handler = jest.fn();

    registry.register(owner, 'editor:toggle-vim-mode', handler);

    await expect(
      registry.dispatch('editor:toggle-vim-mode', {
        source: 'keymap',
        detail: { mode: 'normal' },
      }),
    ).resolves.toBe(true);

    expect(handler).toHaveBeenCalledTimes(1);

    const invocation = handler.mock.calls[0][0];

    expect(invocation).toEqual({
      source: 'keymap',
      detail: { mode: 'normal' },
    });
    expect(Object.isFrozen(invocation)).toBe(true);
  });

  it('returns false when no registered handler owns the command', async () => {
    const registry = new CommandRegistry();

    await expect(
      registry.dispatch('editor:toggle-vim-mode', { source: 'api' }),
    ).resolves.toBe(false);
  });

  it('rejects invalid command IDs and invalid handlers at the runtime boundary', () => {
    expect.hasAssertions();

    const registry = new CommandRegistry();

    expectKernelError(
      () => registry.register(owner, 'toggle-vim-mode', jest.fn()),
      'INVALID_COMMAND_ID',
    );
    expectKernelError(
      () =>
        registry.register(
          owner,
          'editor:toggle-vim-mode',
          'not-a-handler' as unknown as () => void,
        ),
      'INVALID_COMMAND_HANDLER',
    );
  });

  it('rejects duplicate ownership and removes only the disposed registration', async () => {
    const registry = new CommandRegistry();
    const firstHandler = jest.fn();
    const registration = registry.register(
      owner,
      'editor:toggle-vim-mode',
      firstHandler,
    );

    expectKernelError(
      () => registry.register(owner, 'editor:toggle-vim-mode', jest.fn()),
      'COMMAND_CONFLICT',
    );

    registration.dispose();
    registration.dispose();

    expect(registry.has('editor:toggle-vim-mode')).toBe(false);
    await expect(
      registry.dispatch('editor:toggle-vim-mode', { source: 'api' }),
    ).resolves.toBe(false);
    expect(firstHandler).not.toHaveBeenCalled();
  });

  it('awaits async handlers and propagates their failure', async () => {
    const registry = new CommandRegistry();
    const expected = new Error('command failed');

    registry.register(owner, 'editor:toggle-vim-mode', async () => {
      throw expected;
    });

    await expect(
      registry.dispatch('editor:toggle-vim-mode', { source: 'menu' }),
    ).rejects.toBe(expected);
  });

  it('rejects malformed command invocations', async () => {
    const registry = new CommandRegistry();

    registry.register(owner, 'editor:toggle-vim-mode', jest.fn());

    await expect(
      registry.dispatch('editor:toggle-vim-mode', {
        source: 'keyboard',
      } as unknown as { source: 'api' }),
    ).rejects.toMatchObject({ code: 'INVALID_COMMAND_INVOCATION' });
  });
});
