# Spec: live-preview-ux

Status: proposed on 2026-10-25.

## Objective

Make InkNote's existing live Markdown preview behave as a coherent,
command-driven workspace feature. The result keeps the note identifiable in
preview-only mode, centralizes the three view modes behind stable `view:*`
commands, and makes buttons and keyboard shortcuts invoke the same actions.

This is an InkNote feature informed by Inkdrop's public behavior; it does not
copy Inkdrop branding, CSS, or package code.

### Evidence and current baseline

- Inkdrop documents `view:show-editor`, `view:show-preview`,
  `view:show-side-by-side`, `view:toggle-preview`, and
  `view:toggle-side-by-side` as body-level view commands.
  https://developers.inkdrop.app/guides/list-of-commands
- Inkdrop documents `Cmd/Ctrl+E` to switch editor/preview and `Cmd/Ctrl+P` to
  show the two panes together.
  https://docs.inkdrop.app/reference/main-user-interface
- Inkdrop's renderer is a Remark/Rehype pipeline with explicit renderer
  events, a useful architectural reference for InkNote's already-sanitized
  Unified pipeline.
  https://developers.inkdrop.app/modules/markdown-renderer

Verified baseline: InkNote already has a sanitized GFM renderer, live draft
preview, Mermaid/KaTeX, bidirectional scroll synchronization, and
`editor | split | preview` state. Its focused preview test group passes
(21 tests across four suites). The unresolved gaps are command integration and
the empty, non-identifying preview-only header.

## Tech stack

- Electron 44.4, React 19.3, TypeScript 7, Vite 7.3.
- Existing Markdown stack: Unified 11, Remark 11, Remark GFM 4,
  Remark/Rehype 11, Rehype Sanitize 6 and Rehype Stringify 10.
- Existing platform contracts: `PluginRuntime`, `CommandRegistry`, and
  `KeymapRegistry`.

## Commands

```bash
# Focused red/green loop
npm test -- src/__tests__/features/workspace/viewCommands.test.ts --runInBand
npm test -- src/__tests__/App.test.tsx --runInBand

# Local quality checks
npm run lint
npm run typecheck
npm run verify

# Visual verification
npm start
```

## Scope

### Included

1. Keep one source of truth with the existing mode union:
   `editor | split | preview`.
2. Add a built-in workspace-view contribution that registers these stable
   commands through the existing runtime:
   - `view:show-editor`
   - `view:show-preview`
   - `view:show-side-by-side`
   - `view:toggle-preview`
   - `view:toggle-side-by-side`
3. Add a small renderer adapter that normalizes `Cmd/Ctrl+E` and `Cmd/Ctrl+P`,
   resolves their bindings through `KeymapRegistry`, then dispatches the
   resolved command through `CommandRegistry`. The platform core remains free
   of DOM and React imports.
4. Route the existing Editor / Split / Preview buttons through the same command
   dispatcher rather than mutating React state directly.
5. Render an accessible, read-only document identity header in preview-only
   mode: title, notebook/status summary, and tags. In split mode, preserve the
   existing shared editable header and its aligned preview scroll position.
6. Preserve all existing live-preview, sanitization, GFM, Mermaid, KaTeX,
   internal-reference, and scroll-sync behavior.

### Explicitly excluded

- Replacing the existing Unified renderer or weakening its sanitization.
- Adding a new syntax-highlighting dependency or claiming universal language
  coverage. Python highlighting is a separate dependency/design decision.
- Persisting a preferred view mode across application relaunches.
- A general DOM adapter for every plugin command/keymap or external plugin
  loading.
- Duplicating the current top-level view selector with a second floating UI.
  Current Inkdrop documentation also supports top editor controls, which
  matches InkNote's established workspace layout.

## Project structure

```text
src/renderer/features/workspace/
  model/viewCommands.ts          # mode transitions and stable command IDs
  runtime/workspaceViewPlugin.ts # built-in command/keymap contribution
  hooks/useWorkspaceViewCommands.ts # React-to-runtime adapter
src/renderer/pages/WorkspacePage.tsx
src/renderer/components/workspace/WorkspaceNavbar.tsx
src/renderer/features/preview/components/PreviewPanel.tsx
src/renderer/features/preview/styles/preview.css
src/__tests__/features/workspace/viewCommands.test.ts
src/__tests__/App.test.tsx
```

Names may be colocated differently only if a neighboring feature convention
proves clearer; the pure mode transition logic must remain independent of
React and DOM events.

## Code style

Use literal command IDs, immutable mappings, and a typed mode transition.
Buttons and key handlers dispatch commands; neither re-implements transition
logic.

```ts
export const workspaceViewCommandIds = Object.freeze({
  showEditor: 'view:show-editor',
  showPreview: 'view:show-preview',
  showSideBySide: 'view:show-side-by-side',
  togglePreview: 'view:toggle-preview',
  toggleSideBySide: 'view:toggle-side-by-side',
});

export const nextWorkspaceViewMode = (
  current: WorkspaceViewMode,
  command: WorkspaceViewCommand,
): WorkspaceViewMode => {
  // Explicit exhaustive transition table; no hidden DOM state.
};
```

All interactive controls retain visible accessible names, `aria-pressed` for
the active view, keyboard focus affordances, and project semantic CSS tokens.

## Testing strategy

- Start with a failing pure test for each view-command transition.
- Test registration/dispatch through the existing runtime, including cleanup.
- Add App integration tests proving button clicks and `Cmd/Ctrl+E` /
  `Cmd/Ctrl+P` produce the same `data-view-mode` and preserve the unsaved
  preview draft.
- Test preview-only identity content and active control ARIA state.
- Keep the existing real `MarkdownPreview` tests as renderer/security
  regression coverage; do not replace them with snapshots.
- Run a browser/Electron smoke verification after automated gates: inspect
  preview-only and split mode, ensure console errors/warnings are absent, and
  verify focus/keyboard behavior at desktop and narrow workspace widths.

## Boundaries

- Always: preserve existing Markdown security behavior; use the repository's
  commands; run focused tests before broader gates; keep the command core
  framework-free.
- Ask first: new runtime dependency, persisted user preference/schema change,
  external-plugin execution, or a public command API beyond this view scope.
- Never: render unsanitized HTML, bypass `CommandRegistry` from a view control,
  remove existing preview tests, or copy Inkdrop's proprietary presentation.

## Success criteria

- `view:*` commands above are registered once in the workspace runtime and
  survive neither unmount nor duplicate activation.
- Buttons and keyboard shortcuts invoke those commands, while only command
  handlers alter the mode.
- `Cmd/Ctrl+E` toggles editor and preview; `Cmd/Ctrl+P` always selects split.
- Preview-only retains a visible, semantic note title and organization summary;
  split keeps its current shared editable header.
- Switching views leaves the in-memory draft, rendered content, and scroll
  synchronization intact.
- The focused tests, lint, typecheck, full verification, and visual runtime
  check pass without console warnings.

## Open questions

- Should persisted per-window view preference be specified as a later
  configuration capability? It is intentionally not inferred from this
  request.
- Should broad syntax highlighting (including Python) be designed as a
  separately approved renderer-extension capability rather than a manual
  tokenizer expansion?
