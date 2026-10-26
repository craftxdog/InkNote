# Tasks: organization-commands

This checklist implements only
[SPEC-organization-commands.md](../SPEC-organization-commands.md) and the
approved [technical plan](organization-commands.plan.md). It does not include
any later note, notebook, or tag command.

## Task 1: Define and test the pure organization command contribution

**Description:** Start with focused failing tests, then add a feature-local
`note:new` command model and pure plugin contribution using the existing
plugin kernel contracts.

**Acceptance criteria:**

- [x] `note:new` is the only recognized organization command ID.
- [x] Dispatch invokes the supplied callback exactly once and preserves its
      invocation provenance.
- [x] The plugin contributes `mod-n` in `workspace.global`; disposal removes
      both the command and binding.
- [x] The pure module does not import React, the document bridge, IPC, SQLite,
      or Electron.

**Verification:**

- [x] Focused feature suite passes.
- [x] `npm run typecheck` passes.

**Dependencies:** None.

**Likely files:**

- `src/renderer/features/organization/model/organizationCommands.ts`
- `src/renderer/features/organization/runtime/organizationCommandsPlugin.ts`
- `src/__tests__/features/organization/organizationCommands.test.ts`

## Task 2: Build the lifecycle-safe renderer adapter

**Description:** Start with hook tests, then add a React adapter that owns a
single runtime, serializes plugin lifecycle operations, resolves native keys,
and dispatches typed organization commands.

**Acceptance criteria:**

- [x] The adapter always uses the latest creation callback without activating
      a duplicate plugin.
- [x] Dispatch before activation waits for activation; dispatch after cleanup
      returns `false` without calling a stale callback.
- [x] Only an exact `mod-n` match is prevented and dispatched as `keymap`.
- [x] Strict Mode reconnection neither emits `PLUGIN_LIFECYCLE_IN_PROGRESS`
      nor leaves duplicate command/keymap registrations.

**Verification:**

- [x] Focused adapter/Strict Mode suite passes.
- [x] Existing workspace-view command suite passes.
- [x] `npm run typecheck` passes.

**Dependencies:** Task 1.

**Likely files:**

- `src/renderer/features/organization/hooks/useOrganizationCommands.ts`
- `src/__tests__/features/organization/useOrganizationCommands.test.tsx`

## Task 3: Route new-note UI through the command boundary

**Description:** Replace the direct new-note mutations in `WorkspacePage`
with the typed adapter. Retain every unrelated page shortcut in its current
path.

**Acceptance criteria:**

- [x] New-note UI dispatches `note:new` with `menu` provenance.
- [x] `Cmd/Ctrl+N` dispatches the same command with `keymap` provenance.
- [x] The old page-level `Cmd/Ctrl+N` branch is absent.
- [x] Navigation, distraction-free, preferences, and preview bindings keep
      their existing behavior; this task adds no `Cmd/Ctrl+P` binding.

**Verification:**

- [x] Workspace page integration test passes.
- [x] Existing app and workspace-view tests pass.

**Dependencies:** Tasks 1–2.

**Likely files:**

- `src/renderer/pages/WorkspacePage.tsx`
- `src/__tests__/App.test.tsx`

## Checkpoint: complete organization-commands

- [x] Focused organization and workspace-view suites pass.
- [x] `npm run lint` passes.
- [x] `npm run typecheck` passes.
- [x] `npm run test:ci` passes.
- [x] `npm run build` passes.
- [x] `npm run verify` passes.
- [x] Manual Electron smoke test verifies new-note button, `Cmd/Ctrl+N`, and
      no lifecycle error; focused tests cover unconsumed `Cmd/Ctrl+P` and
      Strict Mode remounting.
- [ ] A human has reviewed the result before `note-organization`,
      `notebook-taxonomy`, or `tag-taxonomy` is specified or implemented.
