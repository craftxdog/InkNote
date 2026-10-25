import type { WorkspaceViewMode } from '../../../types/workspace';
import type { InkNotePlugin } from '../../../platform/plugins/plugin.types';
import { createPluginId } from '../../../platform/plugins/plugin.types';

import {
  nextWorkspaceViewMode,
  workspaceViewCommandIds,
  type WorkspaceViewCommand,
} from '../model/viewCommands';

export {
  nextWorkspaceViewMode,
  workspaceViewCommandIds,
  type WorkspaceViewCommand,
} from '../model/viewCommands';

type WorkspaceViewPluginOptions = Readonly<{
  getViewMode(): WorkspaceViewMode;
  onViewModeChange(mode: WorkspaceViewMode): void;
}>;

const workspaceViewPluginId = createPluginId('workspace-view');

const workspaceViewCommands = Object.freeze([
  workspaceViewCommandIds.showEditor,
  workspaceViewCommandIds.showPreview,
  workspaceViewCommandIds.showSideBySide,
  workspaceViewCommandIds.togglePreview,
  workspaceViewCommandIds.toggleSideBySide,
] as const satisfies readonly WorkspaceViewCommand[]);

export const createWorkspaceViewPlugin = (
  options: WorkspaceViewPluginOptions,
): InkNotePlugin => ({
  id: workspaceViewPluginId,
  activate: (environment) => {
    for (const command of workspaceViewCommands) {
      environment.commands.add(command, () => {
        options.onViewModeChange(
          nextWorkspaceViewMode(options.getViewMode(), command),
        );
      });
    }

    environment.keymaps.add([
      {
        context: 'workspace.global',
        keystrokes: ['mod-e'],
        command: workspaceViewCommandIds.togglePreview,
      },
      {
        context: 'workspace.global',
        keystrokes: ['mod-p'],
        command: workspaceViewCommandIds.showSideBySide,
      },
    ]);
  },
});
