import type { DocumentIpcResult } from './documents/document.ipc';
import type { DataIpcResult } from './data/data.ipc';
import type {
  BackupResult,
  DataManagementInfo,
  DirectorySelectionPurpose,
  ExportResult,
  RestoreResult,
} from './data/data.types';
import type {
  DocumentMutation,
  CreateNotebookInput,
  DeleteNotebookInput,
  DeleteNotebookResult,
  Notebook,
  NoteDocument,
} from './documents/document.types';

export type WindowControlsApi = {
  setTrafficLightsVisible: (visible: boolean) => Promise<boolean>;
};

export type DocumentApi = {
  get: (id: string) => Promise<DocumentIpcResult<NoteDocument | null>>;
  apply: (
    mutation: DocumentMutation,
  ) => Promise<DocumentIpcResult<NoteDocument>>;
  listActive: () => Promise<DocumentIpcResult<readonly NoteDocument[]>>;
  listArchived: () => Promise<DocumentIpcResult<readonly NoteDocument[]>>;
  listNotebooks: () => Promise<DocumentIpcResult<readonly Notebook[]>>;
  createNotebook: (
    input: CreateNotebookInput,
  ) => Promise<DocumentIpcResult<Notebook>>;
  deleteNotebook: (
    input: DeleteNotebookInput,
  ) => Promise<DocumentIpcResult<DeleteNotebookResult>>;
};

/**
 * Renderer-safe data-management surface. All filesystem work stays in the
 * main process; every method returns a serializable result contract.
 */
export type DataManagementApi = {
  getInfo: () => Promise<DataIpcResult<DataManagementInfo>>;
  chooseDirectory: (
    purpose: DirectorySelectionPurpose,
  ) => Promise<DataIpcResult<string | null>>;
  configureBackup: (directory: string) => Promise<DataIpcResult<BackupResult>>;
  restoreBackup: (directory: string) => Promise<DataIpcResult<RestoreResult>>;
  exportMarkdown: (directory: string) => Promise<DataIpcResult<ExportResult>>;
};

export type InknoteApi = {
  windowControls: WindowControlsApi;
  documents: DocumentApi;
  data: DataManagementApi;
};
