# Tasks: `live-preview-ux`

## Task 1: Define command-driven view transitions

**Description:** Add the pure workspace view-command model and a pre-imported
`workspace-view` contribution. It registers the five stable `view:*` commands
and the two documented keymap descriptors without importing React or DOM APIs.

**Acceptance criteria:**

- [ ] All five command IDs from `SPEC-live-preview-ux.md` are registered with
      the existing renderer-local command runtime.
- [ ] Each command produces an explicit, exhaustive `editor | split | preview`
      transition; `toggle-preview` and `toggle-side-by-side` have defined
      return modes.
- [ ] `mod-e` resolves to `view:toggle-preview`; `mod-p` resolves to
      `view:show-side-by-side`; deactivation removes both commands and keys.

**Verification:**

- [ ] Red then green: `npm test -- src/__tests__/features/workspace/viewCommands.test.ts --runInBand`
- [ ] `npm run typecheck`

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

- [ ] `Cmd/Ctrl+E` dispatches `view:toggle-preview` and swaps editor/preview.
- [ ] `Cmd/Ctrl+P` dispatches `view:show-side-by-side` from every view mode.
- [ ] Editor, split, and preview buttons invoke the same command dispatcher;
      their `aria-pressed` state matches `data-view-mode`.
- [ ] Switching mode does not discard the current unsaved editor draft.

**Verification:**

- [ ] Red then green: `npm test -- src/__tests__/App.test.tsx --runInBand`
- [ ] Regression: `npm test -- src/__tests__/features/markdown/scrollSynchronization.test.ts src/__tests__/features/markdown/previewScrollRenderGuard.test.ts --runInBand`
- [ ] `npm run lint && npm run typecheck`

**Dependencies:** Task 1.

**Files likely touched:**

- `src/renderer/features/workspace/hooks/useWorkspaceViewCommands.ts`
- `src/renderer/pages/WorkspacePage.tsx`
- `src/renderer/components/workspace/WorkspaceNavbar.tsx`
- `src/__tests__/App.test.tsx`

**Estimated scope:** Medium (4 files).

## Checkpoint: Command-driven workspace

- [ ] Tasks 1–2 pass their focused tests, lint, and typecheck.
- [ ] Keyboard and buttons have one transition source; no direct duplicate
      view-mode mutation remains in those controls.
- [ ] Existing preview draft and scroll synchronization tests still pass.

## Task 3: Keep note identity in preview-only mode

**Description:** Render a read-only header for the selected note only in
preview-only mode. It communicates title, notebook, status, and tags with
semantic markup and existing theme tokens, while preserving the current shared
editable header in split view.

**Acceptance criteria:**

- [ ] Preview-only renders a meaningful title and organization summary for a
      selected note rather than a blank header band.
- [ ] The header is absent in split mode, which keeps the editor's existing
      spanning header and aligned panes.
- [ ] Loading, empty-note, archived-note, and tag-overflow states remain
      usable and accessible.

**Verification:**

- [ ] Red then green: `npm test -- src/__tests__/App.test.tsx --runInBand`
- [ ] Renderer regression: `npm test -- src/__tests__/features/preview/MarkdownPreview.test.ts --runInBand`
- [ ] `npm run lint && npm run typecheck`

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

- [ ] Automated gates pass with no skipped or disabled tests.
- [ ] Editor-only, split, and preview-only modes render cleanly in light and
      dark themes; documented shortcuts and button focus behavior work.
- [ ] Console is free of errors/warnings and no Markdown sanitization behavior
      regresses.

**Verification:**

- [ ] `npm run verify`
- [ ] `npm start` visual check at desktop and narrow workspace widths
- [ ] Review final diff and verification evidence before commit

**Dependencies:** Task 3.

**Files likely touched:**

- No intended production files; test or documentation edits only if a verified
  defect requires a separate focused fix.

**Estimated scope:** Small (verification only).

## Checkpoint: Complete

- [ ] All approved success criteria in `SPEC-live-preview-ux.md` are met.
- [ ] Full verification and visual runtime checks pass.
- [ ] No dependency, Markdown security, or persistence scope has expanded.
- [ ] Final code review has no unresolved required findings.
