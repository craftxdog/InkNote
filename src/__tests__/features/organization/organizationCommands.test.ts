import { createPluginRuntime } from '../../../renderer/platform/environment/runtime';
import {
  createOrganizationCommandsPlugin,
  isOrganizationCommand,
  organizationCommandIds,
} from '../../../renderer/features/organization/runtime/organizationCommandsPlugin';

describe('organization commands', () => {
  it('accepts only its stable note command ID at the keymap boundary', () => {
    expect(isOrganizationCommand(organizationCommandIds.createNote)).toBe(true);
    expect(isOrganizationCommand('view:show-preview')).toBe(false);
  });

  it('registers note creation and its key binding through one contribution', async () => {
    const runtime = createPluginRuntime({
      appVersion: '0.1.0',
      devMode: true,
    });
    const onCreateNote = jest.fn();
    const plugin = createOrganizationCommandsPlugin({ onCreateNote });

    await runtime.plugins.activate(plugin);

    await expect(
      runtime.commands.dispatch(organizationCommandIds.createNote, {
        source: 'menu',
        detail: { trigger: 'new-note-button' },
      }),
    ).resolves.toBe(true);
    expect(onCreateNote).toHaveBeenCalledTimes(1);
    expect(onCreateNote).toHaveBeenCalledWith({
      source: 'menu',
      detail: { trigger: 'new-note-button' },
    });

    const workspaceTarget = {
      matches: (context: string) => (context === 'workspace.global' ? 1 : null),
    };

    expect(runtime.keymaps.resolve(['mod-n'], [workspaceTarget])).toMatchObject(
      {
        kind: 'matched',
        binding: { command: organizationCommandIds.createNote },
      },
    );
    expect(runtime.keymaps.resolve(['mod-p'], [workspaceTarget])).toEqual({
      kind: 'none',
    });

    await expect(runtime.plugins.deactivate(plugin.id)).resolves.toBe(true);
    await expect(
      runtime.commands.dispatch(organizationCommandIds.createNote, {
        source: 'api',
      }),
    ).resolves.toBe(false);
    expect(runtime.keymaps.resolve(['mod-n'], [workspaceTarget])).toEqual({
      kind: 'none',
    });
  });
});
