import type { DocumentIpcResult } from './documents/document.ipc';
import type { DataIpcResult } from './data/data.ipc';
import type { ThemeIpcResult } from './themes/theme.ipc';
import type { NoteOrganizationIpcResult } from './note-organization/noteOrganizationPreferences.ipc';
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
  PermanentlyDeleteNotesInput,
  PermanentlyDeleteNotesResult,
  Notebook,
  NoteDocument,
  TagSummary,
} from './documents/document.types';
import type {
  ThemeAppearanceSettings,
  ThemeDescriptor,
  ThemeStyles,
} from './themes/theme.types';
import type { DefaultNotebookPreference } from './note-organization/noteOrganizationPreferences.types';

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
  listTags: () => Promise<DocumentIpcResult<readonly TagSummary[]>>;
  createNotebook: (
    input: CreateNotebookInput,
  ) => Promise<DocumentIpcResult<Notebook>>;
  deleteNotebook: (
    input: DeleteNotebookInput,
  ) => Promise<DocumentIpcResult<DeleteNotebookResult>>;
  deletePermanently: (
    input: PermanentlyDeleteNotesInput,
  ) => Promise<DocumentIpcResult<PermanentlyDeleteNotesResult>>;
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

/** Renderer-safe theme API. Package parsing and filesystem access remain in
 * the main process, so themes never receive Node or Electron privileges. */
export type ThemeApi = {
  list: () => Promise<ThemeIpcResult<readonly ThemeDescriptor[]>>;
  choosePackageDirectory: () => Promise<ThemeIpcResult<string | null>>;
  install: (directory: string) => Promise<ThemeIpcResult<ThemeDescriptor>>;
  load: (id: string) => Promise<ThemeIpcResult<ThemeStyles>>;
  remove: (id: string) => Promise<ThemeIpcResult<undefined>>;
  getAppearance: () => Promise<ThemeIpcResult<ThemeAppearanceSettings>>;
  setAcrylicEnabled: (
    enabled: boolean,
  ) => Promise<ThemeIpcResult<ThemeAppearanceSettings>>;
};

/** Renderer-safe note organization settings. The preference stays in the
 * main process and is validated against the durable notebook catalogue. */
export type NoteOrganizationApi = {
  getDefaultNotebook: () => Promise<
    NoteOrganizationIpcResult<DefaultNotebookPreference>
  >;
  setDefaultNotebook: (
    notebookId: string,
  ) => Promise<NoteOrganizationIpcResult<DefaultNotebookPreference>>;
};

export type InknoteApi = {
  windowControls: WindowControlsApi;
  documents: DocumentApi;
  data: DataManagementApi;
  themes?: ThemeApi;
  noteOrganization: NoteOrganizationApi;
};
