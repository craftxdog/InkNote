import type { WorkspaceViewMode } from '../../../types/workspace';

export const workspaceViewCommandIds = Object.freeze({
  showEditor: 'view:show-editor',
  showPreview: 'view:show-preview',
  showSideBySide: 'view:show-side-by-side',
  togglePreview: 'view:toggle-preview',
  toggleSideBySide: 'view:toggle-side-by-side',
});

export type WorkspaceViewCommand =
  (typeof workspaceViewCommandIds)[keyof typeof workspaceViewCommandIds];

export const nextWorkspaceViewMode = (
  current: WorkspaceViewMode,
  command: WorkspaceViewCommand,
): WorkspaceViewMode => {
  switch (command) {
    case workspaceViewCommandIds.showEditor:
      return 'editor';
    case workspaceViewCommandIds.showPreview:
      return 'preview';
    case workspaceViewCommandIds.showSideBySide:
      return 'split';
    case workspaceViewCommandIds.togglePreview:
      return current === 'preview' ? 'editor' : 'preview';
    case workspaceViewCommandIds.toggleSideBySide:
      return current === 'split' ? 'editor' : 'split';
  }
};
