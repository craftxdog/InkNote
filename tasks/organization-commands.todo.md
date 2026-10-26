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

- [ ] `note:new` is the only recognized organization command ID.
- [ ] Dispatch invokes the supplied callback exactly once and preserves its
      invocation provenance.
- [ ] The plugin contributes `mod-n` in `workspace.global`; disposal removes
      both the command and binding.
- [ ] The pure module does not import React, the document bridge, IPC, SQLite,
      or Electron.

**Verification:**

- [ ] Focused feature suite passes.
- [ ] `npm run typecheck` passes.

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

- [ ] The adapter always uses the latest creation callback without activating
      a duplicate plugin.
- [ ] Dispatch before activation waits for activation; dispatch after cleanup
      returns `false` without calling a stale callback.
- [ ] Only an exact `mod-n` match is prevented and dispatched as `keymap`.
- [ ] Strict Mode reconnection neither emits `PLUGIN_LIFECYCLE_IN_PROGRESS`
      nor leaves duplicate command/keymap registrations.

**Verification:**

- [ ] Focused adapter/Strict Mode suite passes.
- [ ] Existing workspace-view command suite passes.
- [ ] `npm run typecheck` passes.

**Dependencies:** Task 1.

**Likely files:**

- `src/renderer/features/organization/hooks/useOrganizationCommands.ts`
- `src/__tests__/features/organization/useOrganizationCommands.test.tsx`

## Task 3: Route new-note UI through the command boundary

**Description:** Replace the direct new-note mutations in `WorkspacePage`
with the typed adapter. Retain every unrelated page shortcut in its current
path.

**Acceptance criteria:**

- [ ] New-note UI dispatches `note:new` with `menu` provenance.
- [ ] `Cmd/Ctrl+N` dispatches the same command with `keymap` provenance.
- [ ] The old page-level `Cmd/Ctrl+N` branch is absent.
- [ ] Navigation, distraction-free, preferences, and preview bindings keep
      their existing behavior; this task adds no `Cmd/Ctrl+P` binding.

**Verification:**

- [ ] Workspace page integration test passes.
- [ ] Existing app and workspace-view tests pass.

**Dependencies:** Tasks 1–2.

**Likely files:**

- `src/renderer/pages/WorkspacePage.tsx`
- `src/__tests__/App.test.tsx`

## Checkpoint: complete organization-commands

- [ ] Focused organization and workspace-view suites pass.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:ci` passes.
- [ ] `npm run build` passes.
- [ ] `npm run verify` passes.
- [ ] Manual Electron smoke test verifies new-note button, `Cmd/Ctrl+N`,
      unconsumed `Cmd/Ctrl+P`, and no lifecycle error after Strict Mode
      remounting.
- [ ] A human has reviewed the result before `note-organization`,
      `notebook-taxonomy`, or `tag-taxonomy` is specified or implemented.
