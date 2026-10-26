import type { CommandInvocation } from '../../../platform/commands/command.types';
import {
  createPluginId,
  type InkNotePlugin,
} from '../../../platform/plugins/plugin.types';

import {
  organizationCommandContexts,
  organizationCommandIds,
  type OrganizationCommand,
} from '../model/organizationCommands';

export {
  isOrganizationCommand,
  organizationCommandIds,
  type OrganizationCommand,
} from '../model/organizationCommands';

type OrganizationCommandsPluginOptions = Readonly<{
  onCommand(
    command: OrganizationCommand,
    invocation: CommandInvocation,
  ): unknown | Promise<unknown>;
}>;

const organizationCommandsPluginId = createPluginId('organization-commands');

export const createOrganizationCommandsPlugin = (
  options: OrganizationCommandsPluginOptions,
): InkNotePlugin => ({
  id: organizationCommandsPluginId,
  activate: (environment) => {
    for (const command of Object.values(organizationCommandIds)) {
      environment.commands.add(command, (invocation) =>
        options.onCommand(command, invocation),
      );
    }
    environment.keymaps.add([
      {
        context: organizationCommandContexts.global,
        keystrokes: ['mod-n'],
        command: organizationCommandIds.createNote,
      },
      {
        context: organizationCommandContexts.selectedNotes,
        keystrokes: ['mod-d'],
        command: organizationCommandIds.duplicateNote,
      },
      {
        context: organizationCommandContexts.selectedNotes,
        keystrokes: ['delete'],
        command: organizationCommandIds.archiveNotes,
      },
      {
        context: organizationCommandContexts.selectedNotes,
        keystrokes: ['mod-backspace'],
        command: organizationCommandIds.archiveNotes,
      },
      {
        context: organizationCommandContexts.selectedNotes,
        keystrokes: ['m'],
        command: organizationCommandIds.moveNotes,
      },
      {
        context: organizationCommandContexts.history,
        keystrokes: ['mod-left'],
        command: organizationCommandIds.goBack,
      },
      {
        context: organizationCommandContexts.history,
        keystrokes: ['alt-left'],
        command: organizationCommandIds.goBack,
      },
      {
        context: organizationCommandContexts.history,
        keystrokes: ['mod-right'],
        command: organizationCommandIds.goForward,
      },
      {
        context: organizationCommandContexts.history,
        keystrokes: ['alt-right'],
        command: organizationCommandIds.goForward,
      },
    ]);
  },
});
