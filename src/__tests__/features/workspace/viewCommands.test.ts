import { createPluginRuntime } from '../../../renderer/platform/environment/runtime';
import {
  createWorkspaceViewPlugin,
  isWorkspaceViewCommand,
  nextWorkspaceViewMode,
  workspaceViewCommandIds,
} from '../../../renderer/features/workspace/runtime/workspaceViewPlugin';
import type { WorkspaceViewMode } from '../../../renderer/types/workspace';

describe('workspace view commands', () => {
  it('accepts only its stable view command IDs at the keymap boundary', () => {
    expect(isWorkspaceViewCommand(workspaceViewCommandIds.showPreview)).toBe(
      true,
    );
    expect(isWorkspaceViewCommand('editor:toggle-vim-mode')).toBe(false);
  });

  it.each([
    ['editor', workspaceViewCommandIds.showEditor, 'editor'],
    ['preview', workspaceViewCommandIds.showEditor, 'editor'],
    ['editor', workspaceViewCommandIds.showPreview, 'preview'],
    ['split', workspaceViewCommandIds.showPreview, 'preview'],
    ['editor', workspaceViewCommandIds.showSideBySide, 'split'],
    ['preview', workspaceViewCommandIds.showSideBySide, 'split'],
    ['editor', workspaceViewCommandIds.togglePreview, 'preview'],
    ['preview', workspaceViewCommandIds.togglePreview, 'editor'],
    ['split', workspaceViewCommandIds.togglePreview, 'preview'],
    ['editor', workspaceViewCommandIds.toggleSideBySide, 'split'],
    ['preview', workspaceViewCommandIds.toggleSideBySide, 'split'],
    ['split', workspaceViewCommandIds.toggleSideBySide, 'editor'],
  ] as const)('moves %s with %s to %s', (current, command, expected) => {
    expect(nextWorkspaceViewMode(current, command)).toBe(expected);
  });

  it('registers commands and documented key bindings through one contribution', async () => {
    const runtime = createPluginRuntime({
      appVersion: '0.1.0',
      devMode: true,
    });
    let currentMode: WorkspaceViewMode = 'editor';
    const onViewModeChange = jest.fn((nextMode: WorkspaceViewMode) => {
      currentMode = nextMode;
    });
    const plugin = createWorkspaceViewPlugin({
      onViewCommand: (command) =>
        onViewModeChange(nextWorkspaceViewMode(currentMode, command)),
    });

    await runtime.plugins.activate(plugin);

    await expect(
      runtime.commands.dispatch(workspaceViewCommandIds.showPreview, {
        source: 'menu',
      }),
    ).resolves.toBe(true);
    expect(onViewModeChange).toHaveBeenLastCalledWith('preview');

    await expect(
      runtime.commands.dispatch(workspaceViewCommandIds.togglePreview, {
        source: 'keymap',
      }),
    ).resolves.toBe(true);
    expect(onViewModeChange).toHaveBeenLastCalledWith('editor');

    const workspaceTarget = {
      matches: (context: string) => (context === 'workspace.global' ? 1 : null),
    };

    expect(runtime.keymaps.resolve(['mod-e'], [workspaceTarget])).toMatchObject(
      {
        kind: 'matched',
        binding: { command: workspaceViewCommandIds.togglePreview },
      },
    );
    expect(runtime.keymaps.resolve(['mod-p'], [workspaceTarget])).toMatchObject(
      {
        kind: 'matched',
        binding: { command: workspaceViewCommandIds.showSideBySide },
      },
    );
    expect(
      runtime.keymaps.resolve(['mod-shift-p'], [workspaceTarget]),
    ).toMatchObject({
      kind: 'matched',
      binding: { command: workspaceViewCommandIds.showSideBySide },
    });

    await expect(runtime.plugins.deactivate(plugin.id)).resolves.toBe(true);
    await expect(
      runtime.commands.dispatch(workspaceViewCommandIds.showPreview, {
        source: 'api',
      }),
    ).resolves.toBe(false);
    expect(runtime.keymaps.resolve(['mod-e'], [workspaceTarget])).toEqual({
      kind: 'none',
    });
  });
});
