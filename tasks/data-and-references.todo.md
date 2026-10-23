# Tasks: local data and note references

## data-management

- [x] Task 1: Add typed data-management IPC contracts and a preload bridge.
  - Acceptance: Renderer receives only validated results; no filesystem API is exposed.
  - Verify: focused bridge/IPC contract tests and `npm run typecheck`.
  - Files: `src/shared/data/*`, `src/shared/bridge.ts`, `src/main/preload.ts`, `src/shared/ipc/channels.ts`.

- [x] Task 2: Add a SQLite backup configuration and snapshot service.
  - Acceptance: A configured folder contains `data/inknote.sqlite` and metadata; invalid paths fail safely.
  - Verify: `src/__tests__/main/data/*` with temporary folders.
  - Files: `src/main/data/*`, `src/main/documents/LocalDocumentStore.ts`, tests.

- [x] Task 3: Add native folder selection, backup refresh, restore and Markdown export handlers.
  - Acceptance: Restore validates and requires an explicit caller confirmation; export returns the exact destination and note count.
  - Verify: main-process tests plus `npm run typecheck`.
  - Files: `src/main/main.ts`, `src/main/data/*`, tests.

- [x] Task 4: Add data controls and result notices to Preferences.
  - Acceptance: User can view the data directory, select/apply backup, request restore, export notes, and read success/failure status.
  - Verify: React interaction tests, `npm run lint`.
  - Files: `src/renderer/components/workspace/*`, `src/renderer/pages/WorkspacePage.tsx`, styles, tests.

## note-references

- [x] Task 5: Define pure note-reference parsing and formatting.
  - Acceptance: Only exact `inknote://note/<id>` URLs are internal references.
  - Verify: `src/__tests__/features/references/*`.
  - Files: `src/renderer/features/references/*`, tests.

- [x] Task 6: Add `[[` CodeMirror completion that inserts portable Markdown links.
  - Acceptance: Selecting a note inserts `[Title](inknote://note/<id>)`.
  - Verify: editor/completion tests and typecheck.
  - Files: `src/renderer/features/editor/*`, reference helpers, tests.

- [x] Task 7: Render reference cards and navigate to targets.
  - Acceptance: Cards open active targets and show unavailable state for missing/archived targets; external links keep their existing policy.
  - Verify: preview and workspace tests.
  - Files: `src/renderer/features/preview/*`, `src/renderer/pages/WorkspacePage.tsx`, tests.

## editor-theme

- [x] Task 8: Refine code and Markdown syntax tokens in both themes.
  - Acceptance: common Markdown and code syntax have distinguishable contrast-safe colors in editor and preview.
  - Verify: editor/preview tests, build and visual smoke.
  - Files: editor/preview styles and components, tests.
