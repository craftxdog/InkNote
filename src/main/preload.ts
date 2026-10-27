// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */

import { contextBridge, ipcRenderer } from 'electron';

import type { InknoteApi } from '../shared/bridge';
import type {
  CreateNotebookInput,
  CreateTagInput,
  DeleteTagInput,
  DeleteNotebookInput,
  DocumentMutation,
  PermanentlyDeleteNotesInput,
  UpdateNotebookInput,
  UpdateTagInput,
} from '../shared/documents/document.types';
import type { DirectorySelectionPurpose } from '../shared/data/data.types';
import { IPC_CHANNELS } from '../shared/ipc/channels';

const inknoteApi: InknoteApi = {
  windowControls: {
    setTrafficLightsVisible: async (visible: boolean) => {
      const result = await ipcRenderer.invoke(
        IPC_CHANNELS.window.setTrafficLightsVisibility,
        visible,
      );

      return Boolean(result);
    },
  },
  documents: {
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.documents.get, id),
    apply: (mutation: DocumentMutation) =>
      ipcRenderer.invoke(IPC_CHANNELS.documents.apply, mutation),
    listActive: () => ipcRenderer.invoke(IPC_CHANNELS.documents.listActive),
    listArchived: () => ipcRenderer.invoke(IPC_CHANNELS.documents.listArchived),
    listNotebooks: () =>
      ipcRenderer.invoke(IPC_CHANNELS.documents.listNotebooks),
    listTags: () => ipcRenderer.invoke(IPC_CHANNELS.documents.listTags),
    createTag: (input: CreateTagInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.documents.createTag, input),
    updateTag: (input: UpdateTagInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.documents.updateTag, input),
    deleteTag: (input: DeleteTagInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.documents.deleteTag, input),
    createNotebook: (input: CreateNotebookInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.documents.createNotebook, input),
    updateNotebook: (input: UpdateNotebookInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.documents.updateNotebook, input),
    deleteNotebook: (input: DeleteNotebookInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.documents.deleteNotebook, input),
    deletePermanently: (input: PermanentlyDeleteNotesInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.documents.deletePermanently, input),
  },
  data: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.data.getInfo),
    chooseDirectory: (purpose: DirectorySelectionPurpose) =>
      ipcRenderer.invoke(IPC_CHANNELS.data.chooseDirectory, purpose),
    configureBackup: (directory: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.data.configureBackup, directory),
    restoreBackup: (directory: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.data.restoreBackup, directory),
    exportMarkdown: (directory: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.data.exportMarkdown, directory),
  },
  themes: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.themes.list),
    choosePackageDirectory: () =>
      ipcRenderer.invoke(IPC_CHANNELS.themes.choosePackageDirectory),
    install: (directory: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.themes.install, directory),
    load: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.themes.load, id),
    remove: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.themes.remove, id),
    getAppearance: () => ipcRenderer.invoke(IPC_CHANNELS.themes.getAppearance),
    setAcrylicEnabled: (enabled: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.themes.setAcrylicEnabled, enabled),
  },
  noteOrganization: {
    getDefaultNotebook: () =>
      ipcRenderer.invoke(IPC_CHANNELS.noteOrganization.getDefaultNotebook),
    setDefaultNotebook: (notebookId: string) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.noteOrganization.setDefaultNotebook,
        notebookId,
      ),
  },
};

// API propia de Inknote
contextBridge.exposeInMainWorld('inknote', inknoteApi);
