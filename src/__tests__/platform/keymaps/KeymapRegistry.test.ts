import {
  KeymapRegistry,
  type KeymapTarget,
} from '../../../renderer/platform/keymaps/KeymapRegistry';
import { PluginKernelError } from '../../../renderer/platform/plugins/plugin.errors';
import { createPluginId } from '../../../renderer/platform/plugins/plugin.types';

const owner = createPluginId('editor');

const contextTarget = (
  specificityByContext: Readonly<Record<string, number>>,
): KeymapTarget => ({
  matches: (context) => specificityByContext[context] ?? null,
});

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

describe('KeymapRegistry', () => {
  it('resolves a normalized exact binding without dispatching its command', () => {
    const registry = new KeymapRegistry();

    registry.add(owner, [
      {
        context: 'editor.focused',
        keystrokes: [' Mod-K '],
        command: 'editor:toggle-vim-mode',
      },
    ]);

    const resolution = registry.resolve(
      ['mod-k'],
      [contextTarget({ 'editor.focused': 1 })],
    );

    expect(resolution).toMatchObject({
      kind: 'matched',
      binding: {
        context: 'editor.focused',
        keystrokes: ['mod-k'],
        command: 'editor:toggle-vim-mode',
        priority: 0,
      },
    });
    expect(Object.isFrozen(resolution)).toBe(true);
  });

  it('distinguishes a chord prefix from an absent sequence', () => {
    const registry = new KeymapRegistry();

    registry.add(owner, [
      {
        context: 'editor.focused',
        keystrokes: ['mod-k', 'mod-c'],
        command: 'editor:copy-link',
      },
    ]);

    expect(
      registry.resolve(['mod-k'], [contextTarget({ 'editor.focused': 1 })]),
    ).toEqual({ kind: 'partial' });
    expect(
      registry.resolve(['mod-j'], [contextTarget({ 'editor.focused': 1 })]),
    ).toEqual({ kind: 'none' });
  });

  it('prioritizes a focused target before an ancestor', () => {
    const registry = new KeymapRegistry();

    registry.add(owner, [
      {
        context: 'editor.focused',
        keystrokes: ['mod-s'],
        command: 'editor:save',
      },
      {
        context: 'workspace.focused',
        keystrokes: ['mod-s'],
        command: 'workspace:save',
      },
    ]);

    expect(
      registry.resolve(
        ['mod-s'],
        [
          contextTarget({ 'editor.focused': 1 }),
          contextTarget({ 'workspace.focused': 100 }),
        ],
      ),
    ).toMatchObject({
      kind: 'matched',
      binding: { command: 'editor:save' },
    });
  });

  it('orders candidates by priority, specificity, then registration recency', () => {
    const registry = new KeymapRegistry();

    registry.add(owner, [
      {
        context: 'editor.focused',
        keystrokes: ['mod-s'],
        command: 'editor:save',
        priority: 0,
      },
      {
        context: 'editor.writable',
        keystrokes: ['mod-s'],
        command: 'editor:save-as',
        priority: 0,
      },
      {
        context: 'editor.temporary',
        keystrokes: ['mod-s'],
        command: 'editor:discard',
        priority: 1,
      },
    ]);

    const target = contextTarget({
      'editor.focused': 1,
      'editor.writable': 2,
      'editor.temporary': 1,
    });

    expect(registry.resolve(['mod-s'], [target])).toMatchObject({
      kind: 'matched',
      binding: { command: 'editor:discard' },
    });

    const secondRegistry = new KeymapRegistry();

    secondRegistry.add(owner, [
      {
        context: 'editor.focused',
        keystrokes: ['mod-s'],
        command: 'editor:save',
      },
    ]);
    secondRegistry.add(owner, [
      {
        context: 'editor.focused',
        keystrokes: ['mod-s'],
        command: 'editor:save-as',
      },
    ]);

    expect(
      secondRegistry.resolve(
        ['mod-s'],
        [contextTarget({ 'editor.focused': 1 })],
      ),
    ).toMatchObject({
      kind: 'matched',
      binding: { command: 'editor:save-as' },
    });
  });

  it('removes only the bindings belonging to a disposed registration', () => {
    const registry = new KeymapRegistry();
    const first = registry.add(owner, [
      {
        context: 'editor.focused',
        keystrokes: ['mod-s'],
        command: 'editor:save',
      },
    ]);
    registry.add(owner, [
      {
        context: 'editor.focused',
        keystrokes: ['mod-p'],
        command: 'editor:print',
      },
    ]);

    first.dispose();
    first.dispose();

    const target = contextTarget({ 'editor.focused': 1 });

    expect(registry.resolve(['mod-s'], [target])).toEqual({ kind: 'none' });
    expect(registry.resolve(['mod-p'], [target])).toMatchObject({
      kind: 'matched',
      binding: { command: 'editor:print' },
    });
  });

  it('rejects malformed descriptors before they become active', () => {
    expect.hasAssertions();

    const registry = new KeymapRegistry();

    expectKernelError(
      () =>
        registry.add(owner, [
          {
            context: 'editor.focused',
            keystrokes: [],
            command: 'editor:save',
          },
        ]),
      'INVALID_KEY_BINDING',
    );
    expectKernelError(
      () =>
        registry.add(owner, [
          {
            context: 'editor.focused',
            keystrokes: ['mod-s'],
            command: 'save' as 'editor:save',
          },
        ]),
      'INVALID_COMMAND_ID',
    );
  });
});
