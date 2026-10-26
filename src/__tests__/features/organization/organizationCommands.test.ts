import { createPluginRuntime } from '../../../renderer/platform/environment/runtime';
import {
  createOrganizationCommandsPlugin,
  isOrganizationCommand,
  organizationCommandIds,
} from '../../../renderer/features/organization/runtime/organizationCommandsPlugin';

describe('organization commands', () => {
  it('accepts only its stable note command IDs at the keymap boundary', () => {
    expect(isOrganizationCommand(organizationCommandIds.createNote)).toBe(true);
    expect(isOrganizationCommand(organizationCommandIds.moveNotes)).toBe(true);
    expect(isOrganizationCommand(organizationCommandIds.goBack)).toBe(true);
    expect(isOrganizationCommand('view:show-preview')).toBe(false);
  });

  it('registers note intents and contextual bindings through one contribution', async () => {
    const runtime = createPluginRuntime({
      appVersion: '0.1.0',
      devMode: true,
    });
    const onCommand = jest.fn();
    const plugin = createOrganizationCommandsPlugin({ onCommand });

    await runtime.plugins.activate(plugin);

    await expect(
      runtime.commands.dispatch(organizationCommandIds.moveNotes, {
        source: 'menu',
        detail: { noteIds: ['note:1'], notebookId: 'inbox' },
      }),
    ).resolves.toBe(true);
    expect(onCommand).toHaveBeenCalledWith(
      organizationCommandIds.moveNotes,
      {
        source: 'menu',
        detail: { noteIds: ['note:1'], notebookId: 'inbox' },
      },
    );

    for (const command of Object.values(organizationCommandIds)) {
      expect(runtime.commands.has(command)).toBe(true);
    }

    const workspaceTarget = {
      matches: (context: string) => (context === 'workspace.global' ? 1 : null),
    };
    const selectedNotesTarget = {
      matches: (context: string) => (context === 'notes.selection' ? 1 : null),
    };
    const historyTarget = {
      matches: (context: string) => (context === 'notes.history' ? 1 : null),
    };

    expect(runtime.keymaps.resolve(['mod-n'], [workspaceTarget])).toMatchObject(
      {
        kind: 'matched',
        binding: { command: organizationCommandIds.createNote },
      },
    );
    expect(
      runtime.keymaps.resolve(['mod-d'], [selectedNotesTarget]),
    ).toMatchObject({
      kind: 'matched',
      binding: { command: organizationCommandIds.duplicateNote },
    });
    expect(runtime.keymaps.resolve(['m'], [selectedNotesTarget])).toMatchObject(
      {
        kind: 'matched',
        binding: { command: organizationCommandIds.moveNotes },
      },
    );
    expect(runtime.keymaps.resolve(['mod-left'], [historyTarget])).toMatchObject(
      {
        kind: 'matched',
        binding: { command: organizationCommandIds.goBack },
      },
    );
    expect(runtime.keymaps.resolve(['mod-p'], [workspaceTarget])).toEqual({
      kind: 'none',
    });

    await expect(runtime.plugins.deactivate(plugin.id)).resolves.toBe(true);
    await expect(
      runtime.commands.dispatch(organizationCommandIds.moveNotes, {
        source: 'api',
      }),
    ).resolves.toBe(false);
    expect(runtime.keymaps.resolve(['mod-n'], [workspaceTarget])).toEqual({
      kind: 'none',
    });
  });
});
