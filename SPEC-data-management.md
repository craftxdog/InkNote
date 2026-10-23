# Spec: Local data management

## Objective

Give an InkNote user control over local data without exposing Node filesystem APIs to the renderer. The user can inspect the app data directory, choose a backup folder, keep a current SQLite backup there, restore a chosen backup after confirmation, and export active notes as Markdown. A successful export reports its destination in an in-app notification.

## Tech stack

Electron 44, TypeScript 7, React 19, better-sqlite3 13, Jest 30. Native folder selection stays in Electron's main process; the renderer receives only typed results through preload IPC.

## Commands

- Focused tests: `npm run test:ci -- --runTestsByPath <path>`
- Full tests: `npm run test:ci`
- Types: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build`

## Project structure

- `src/main/data/` owns backup, restore and Markdown export operations.
- `src/shared/data/` owns serializable IPC contract types and validation.
- `src/main/main.ts` authorizes IPC and retains ownership of the SQLite connection.
- `src/main/preload.ts` and `src/shared/bridge.ts` expose a narrow `data` API.
- `src/renderer/components/workspace/` renders Preferences and transient notices.
- `src/__tests__/main/data/` verifies filesystem behavior using a temporary directory.

## Contract

- `getInfo()` returns only the app data directory and configured backup directory.
- `chooseDirectory(purpose)` uses an operating-system folder picker and may return `null` when cancelled.
- `configureBackup(directory)` validates an absolute directory, persists its configuration, and creates a SQLite backup at `data/inknote.sqlite`.
- `restoreBackup(directory)` requires a valid backup layout. The caller must show a confirmation before invoking it. Main safely replaces the local database and the renderer reloads only after success.
- `exportMarkdown(directory)` writes one UTF-8 `.md` file per active note under notebook-path directories. Colliding names receive a stable suffix. It returns the actual output directory.
- A backup is refreshed after every successful document or notebook mutation when a backup directory is configured.

## Code style

```ts
export type ExportResult = Readonly<{
  directory: string;
  exportedNotes: number;
}>;
```

Contracts are immutable, are validated at IPC boundaries, and never expose database handles or untrusted paths to the renderer.

## Testing strategy

- Unit and integration tests cover path validation, backup layout, export hierarchy, title collision handling, and restore validation.
- IPC tests cover failure shapes and rejected untrusted input.
- React tests cover Preferences controls, confirmation state, and success notification text.
- The complete Jest suite, typecheck, lint, and production build must pass.

## Boundaries

- Always: preserve user data until the restore confirmation, use native pickers, and display actionable failures.
- Ask first: add a dependency, alter database schema, or overwrite a user-selected folder outside the explicit export/backup action.
- Never: expose Node filesystem APIs to the renderer, delete a backup automatically, or silently restore data.

## Success criteria

- A configured backup contains a readable `data/inknote.sqlite` snapshot and is refreshed after durable edits.
- Restore cannot run without a valid selected backup and explicit user confirmation.
- Export preserves notebook hierarchy and note bodies, and reports `Finished exporting all notes` with the directory.
- The user-data path is visible from Preferences.

## Sources

- https://docs.inkdrop.app/reference/user-data-directory
- https://docs.inkdrop.app/reference/data-backup
- https://www.electronjs.org/docs/latest/api/dialog
