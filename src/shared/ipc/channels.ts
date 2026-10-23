export const IPC_CHANNELS = {
  data: {
    getInfo: 'data:get-info',
    chooseDirectory: 'data:choose-directory',
    configureBackup: 'data:configure-backup',
    restoreBackup: 'data:restore-backup',
    exportMarkdown: 'data:export-markdown',
  },
  documents: {
    get: 'documents:get',
    apply: 'documents:apply',
    listActive: 'documents:list-active',
    listArchived: 'documents:list-archived',
    listNotebooks: 'documents:list-notebooks',
    createNotebook: 'documents:create-notebook',
    deleteNotebook: 'documents:delete-notebook',
    deletePermanently: 'documents:delete-permanently',
  },
  window: {
    setTrafficLightsVisibility: 'window:set-traffic-lights-visibility',
  },
} as const;
