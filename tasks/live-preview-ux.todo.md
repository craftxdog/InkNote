# Tasks: `live-preview-ux`

## Task 1: Define command-driven view transitions

**Description:** Add the pure workspace view-command model and a pre-imported
`workspace-view` contribution. It registers the five stable `view:*` commands
and the two documented keymap descriptors without importing React or DOM APIs.

**Acceptance criteria:**

- [x] All five command IDs from `SPEC-live-preview-ux.md` are registered with
      the existing renderer-local command runtime.
- [x] Each command produces an explicit, exhaustive `editor | split | preview`
      transition; `toggle-preview` and `toggle-side-by-side` have defined
      return modes.
- [x] `mod-e` resolves to `view:toggle-preview`; `mod-p` resolves to
      `view:show-side-by-side`; deactivation removes both commands and keys.

**Verification:**

- [x] Red then green: `npm test -- src/__tests__/features/workspace/viewCommands.test.ts --runInBand`
- [x] `npm run typecheck`

**Dependencies:** None.

**Files likely touched:**

- `src/renderer/features/workspace/model/viewCommands.ts`
- `src/renderer/features/workspace/runtime/workspaceViewPlugin.ts`
- `src/__tests__/features/workspace/viewCommands.test.ts`

**Estimated scope:** Small (3 files).

## Task 2: Route workspace controls through commands

**Description:** Add the React/DOM adapter that normalizes the preview
shortcuts, resolves keymaps, and dispatches commands. Connect the existing
navbar view selector to that dispatcher while retaining all current non-preview
shortcuts and draft-preview behavior.

**Acceptance criteria:**

- [x] `Cmd/Ctrl+E` dispatches `view:toggle-preview` and swaps editor/preview.
- [x] `Cmd/Ctrl+P` dispatches `view:show-side-by-side` from every view mode.
- [x] Editor, split, and preview buttons invoke the same command dispatcher;
      their `aria-pressed` state matches `data-view-mode`.
- [x] Switching mode does not discard the current unsaved editor draft.

**Verification:**

- [x] Red then green: `npm test -- src/__tests__/App.test.tsx --runInBand`
- [x] Regression: `npm test -- src/__tests__/features/markdown/scrollSynchronization.test.ts src/__tests__/features/markdown/previewScrollRenderGuard.test.ts --runInBand`
- [x] `npm run lint && npm run typecheck`

**Dependencies:** Task 1.

**Files likely touched:**

- `src/renderer/features/workspace/hooks/useWorkspaceViewCommands.ts`
- `src/renderer/pages/WorkspacePage.tsx`
- `src/renderer/components/workspace/WorkspaceNavbar.tsx`
- `src/__tests__/App.test.tsx`

**Estimated scope:** Medium (4 files).

## Checkpoint: Command-driven workspace

- [x] Tasks 1–2 pass their focused tests, lint, and typecheck.
- [x] Keyboard and buttons have one transition source; no direct duplicate
      view-mode mutation remains in those controls.
- [x] Existing preview draft and scroll synchronization tests still pass.

## Task 3: Keep note identity in preview-only mode

**Description:** Render a read-only header for the selected note only in
preview-only mode. It communicates title, notebook, status, and tags with
semantic markup and existing theme tokens, while preserving the current shared
editable header in split view.

**Acceptance criteria:**

- [x] Preview-only renders a meaningful title and organization summary for a
      selected note rather than a blank header band.
- [x] The header is absent in split mode, which keeps the editor's existing
      spanning header and aligned panes.
- [x] Loading, empty-note, archived-note, and tag-overflow states remain
      usable and accessible.

**Verification:**

- [x] Red then green: `npm test -- src/__tests__/App.test.tsx --runInBand`
- [x] Renderer regression: `npm test -- src/__tests__/features/preview/MarkdownPreview.test.ts --runInBand`
- [x] `npm run lint && npm run typecheck`

**Dependencies:** Task 2.

**Files likely touched:**

- `src/renderer/features/preview/components/PreviewPanel.tsx`
- `src/renderer/features/preview/styles/preview.css`
- `src/renderer/pages/WorkspacePage.tsx`
- `src/__tests__/App.test.tsx`

**Estimated scope:** Medium (4 files).

## Task 4: Validate the finished preview workflow

**Description:** Verify the completed behavior through the repository's full
quality gate and a local Electron visual pass. Review the final diff across
correctness, readability, architecture, security, and performance.

**Acceptance criteria:**

- [x] Automated gates pass with no skipped or disabled tests.
- [ ] Editor-only, split, and preview-only modes render cleanly in light and
      dark themes; documented shortcuts and button focus behavior work.
- [x] Existing Markdown sanitization coverage remains green; renderer-console
      inspection is pending the visual runtime pass.
      regresses.

**Verification:**

- [x] `npm run verify`
- [ ] `npm start` visual check at desktop and narrow workspace widths — the
      app started, but the Mac is locked and its window cannot be inspected.
- [x] Review final diff and verification evidence before commit

**Dependencies:** Task 3.

**Files likely touched:**

- No intended production files; test or documentation edits only if a verified
  defect requires a separate focused fix.

**Estimated scope:** Small (verification only).

## Checkpoint: Complete

- [ ] All approved success criteria in `SPEC-live-preview-ux.md` are met —
      only the pending visual inspection remains.
- [ ] Full verification and visual runtime checks pass — the runtime window is
      awaiting an unlocked Mac for inspection.
- [x] No dependency, Markdown security, or persistence scope has expanded.
- [x] Final code review has no unresolved required findings.

## Task 5: Stabilize preview updates and restore the active note on reload

**Description:** Prevent a burst of editor changes and Mermaid layout
notifications from visibly rebuilding the preview multiple times, while
retaining the active non-archived note across a renderer reload.

**Acceptance criteria:**

- [x] A sequence of edits coalesces to one latest preview publication and one
      settled source-anchor reveal; the prior preview remains visible until
      that latest result is ready.
- [x] Existing Mermaid content, themes, and editor-to-preview scroll ownership
      remain correct after the coalesced update.
- [x] Reloading restores the previously active note when it remains active;
      a missing or archived stored ID safely selects the first active note.

**Verification:**

- [x] Red then green focused tests for preview scheduling/layout coalescing
      and workspace selection restoration.
- [x] Regression: existing Markdown preview, Mermaid, and scroll-sync tests
      pass.
- [x] Manual Electron check: type continuously in a Mermaid note, then use
      `Cmd/Ctrl+R` and verify the same note remains active.

**Dependencies:** Task 4 visual workflow.

**Files likely touched:**

- `src/renderer/features/preview/components/MarkdownPreview.tsx`
- `src/renderer/features/markdown/model/*`
- `src/renderer/platform/documents/useDocumentWorkspace.ts`
- focused Jest tests under `src/__tests__/features` and
  `src/__tests__/platform/documents`

**Estimated scope:** Medium (4–5 files).
