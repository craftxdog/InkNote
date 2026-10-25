# Implementation Plan: `live-preview-ux`

## Overview

Deliver the approved live-preview UX specification in small, reversible
slices. The change keeps InkNote's existing Unified renderer and document
draft flow intact, while making workspace view changes go through the existing
plugin command/keymap contracts and making preview-only mode retain its note
identity.

## Dependency graph

```text
pure view command transitions + built-in contribution
                         |
                         v
React workspace command adapter + buttons/keyboard integration
                         |
                         +------------------+
                         |                  |
                         v                  v
                 preview-only document header  regression/visual checks
                         |
                         v
                     final verification
```

The command foundation is first because both navbar controls and keyboard
bindings depend on it. The header is intentionally independent once the
workspace can provide the current mode and document context.

## Architecture decisions

- Activate a pre-imported `workspace-view` built-in contribution through the
  existing renderer-local `PluginRuntime`; do not register ad-hoc global
  handlers. This exercises the lifecycle and ownership model already in the
  repository while preserving `plugin-kernel`'s framework-free boundary.
- Put command IDs and transitions in a pure workspace feature module. The
  contribution registers five Inkdrop-inspired `view:*` commands. Its keymap
  descriptors bind `mod-e` to `view:toggle-preview` and `mod-p` to
  `view:show-side-by-side`.
- Put DOM `KeyboardEvent` normalization and React state ownership in a small
  workspace hook. The hook resolves a `workspace.global` target via
  `KeymapRegistry` and dispatches only matching commands. Existing non-preview
  shortcuts stay untouched in this change.
- Pass a command dispatcher into the navbar, so click handlers and keyboard
  handlers share command IDs and transition logic.
- Add a read-only preview identity header only when the current mode is
  `preview`. It receives the active document and notebook list so it can show
  the title, notebook, status, and tags. Split continues to use the existing
  editable header spanning both panes, preserving current alignment and scroll
  behavior.
- Do not add dependencies, modify the Markdown processing pipeline, or persist
  view preference. Python syntax coverage remains a separately approved
  renderer-extension decision.

## Implementation slices

### Slice 1: Command model and workspace contribution

Add pure command identifiers and exhaustive mode transitions, then register
the five commands and two keymap descriptors through a built-in contribution.
Start with focused failing tests for transitions, dispatch, and teardown.

Checkpoint: command model is framework-free; focused tests and typecheck pass.

### Slice 2: Workspace integration

Create the React adapter, connect the current `Cmd/Ctrl+E` and `Cmd/Ctrl+P`
events to resolved commands, and route view selector buttons through the same
dispatcher. Preserve the current behavior in CodeMirror focus and preserve the
draft supplied to the preview.

Checkpoint: App tests prove button/keyboard equivalence, correct ARIA state,
and live draft retention; lint and typecheck pass.

### Slice 3: Preview-only identity

Add the semantic, read-only header and scoped CSS. It must become visible only
in preview mode, keep split's existing spanning editor header, and use the
existing workspace color and tag tokens.

Checkpoint: component/App tests prove title, organization summary, tags, mode
visibility, and no regression in empty/loading states.

### Slice 4: Finish gate

Run the full repository verification gate and inspect the Electron workspace
in editor, split, and preview-only states. Check console cleanliness, control
focus/labels, both documented shortcuts, draft persistence, and narrow
workspace presentation.

## Verification strategy

- Focused Jest tests follow red → green → refactor for each slice.
- Existing MarkdownPreview and scroll synchronization suites are rerun after
  UI wiring to protect the live-render path.
- `npm run verify` is the final automated gate.
- The visual check uses the local Electron app and treats all rendered content
  as untrusted data; it does not inspect credentials or browser storage.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Lifecycle registration is asynchronous and a command arrives too early | Medium | Install the contribution before enabling dispatch; test registration and clean teardown. |
| New keymap adapter diverges from existing shortcut behavior | High | Preserve the existing modifiers and exercise editor-focused shortcut tests before replacing direct mutations. |
| Preview header duplicates split metadata | Medium | Render it only for `preview`; retain the current split header's spanning CSS untouched. |
| Header styling harms themes or narrow layout | Medium | Use existing semantic tokens and inspect both native appearances plus a narrow workspace. |
| Scope expands into renderer/highlighting work | High | Keep parser, sanitization, and dependency manifest unchanged; record renderer extensions separately. |

## Open questions

- None block this delivery. Persisted view preference and broad syntax-language
  coverage remain consciously deferred by the approved specification.

## Approval gate

No production implementation starts until this plan is approved. After
approval, the detailed checklist will be recorded in
`tasks/live-preview-ux.todo.md` before the first red test is written.
