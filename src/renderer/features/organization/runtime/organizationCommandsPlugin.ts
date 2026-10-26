import type { CommandInvocation } from '../../../platform/commands/command.types';
import { createPluginId, type InkNotePlugin } from '../../../platform/plugins/plugin.types';

import {
  organizationCommandIds,
  type OrganizationCommand,
} from '../model/organizationCommands';

export {
  isOrganizationCommand,
  organizationCommandIds,
  type OrganizationCommand,
} from '../model/organizationCommands';

type OrganizationCommandsPluginOptions = Readonly<{
  onCreateNote(invocation: CommandInvocation): void | Promise<void>;
}>;

const organizationCommandsPluginId = createPluginId('organization-commands');

export const createOrganizationCommandsPlugin = (
  options: OrganizationCommandsPluginOptions,
): InkNotePlugin => ({
  id: organizationCommandsPluginId,
  activate: (environment) => {
    environment.commands.add(
      organizationCommandIds.createNote,
      options.onCreateNote,
    );
    environment.keymaps.add([
      {
        context: 'workspace.global',
        keystrokes: ['mod-n'],
        command: organizationCommandIds.createNote,
      },
    ]);
  },
});
