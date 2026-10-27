export const organizationCommandIds = Object.freeze({
  createNote: 'note:new',
  duplicateNote: 'note:duplicate',
  moveNotes: 'note:move',
  archiveNotes: 'note:archive',
  restoreNotes: 'note:restore',
  deleteNotesPermanently: 'note:delete-permanently',
  toggleNotePinned: 'note:toggle-pin',
  goBack: 'note:history-back',
  goForward: 'note:history-forward',
  createNotebook: 'notebook:new',
  updateNotebook: 'notebook:update',
  deleteNotebook: 'notebook:delete',
  openNotebook: 'notebook:open',
  createTag: 'tag:new',
  updateTag: 'tag:update',
  deleteTag: 'tag:delete',
  openTag: 'tag:open',
});

export const organizationCommandContexts = Object.freeze({
  global: 'workspace.global',
  selectedNotes: 'notes.selection',
  history: 'notes.history',
});

export type OrganizationCommand =
  (typeof organizationCommandIds)[keyof typeof organizationCommandIds];

const organizationCommands = Object.freeze(
  Object.values(organizationCommandIds),
) as readonly OrganizationCommand[];

export const isOrganizationCommand = (
  value: unknown,
): value is OrganizationCommand =>
  typeof value === 'string' &&
  organizationCommands.includes(value as OrganizationCommand);
