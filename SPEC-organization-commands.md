# Spec: organization-commands

Status: proposed on 2026-10-25.

## Assumptions

1. InkNote remains a local-first Electron application; this module must not
   introduce remote synchronization, PouchDB/CouchDB compatibility, or a
   third-party command package.
2. The existing document workspace remains the owner of document mutations.
   A command adapts a user intent to that owner; it never reads SQLite or IPC
   directly.
3. `note:new` must retain the current creation semantics and default notebook
   selection. Context-sensitive placement is a later `note-organization`
   decision.
4. The current preview bindings, including their `Cmd/Ctrl+P` behavior, are
   outside this module. This module adds no `Cmd/Ctrl+P` binding.
5. `Cmd/Ctrl+N` is the sole new keymap contribution in this module. A future
   command palette may dispatch the command through the existing `api` source,
   but a Telescope UI is not part of this scope.

## Objective

Make note creation follow the same command lifecycle and keymap path as the
workspace preview controls, using a small vertical slice that establishes the
pattern for later note, notebook, and tag actions.

An action initiated by the new-note control, a native `Cmd/Ctrl+N` shortcut,
or a future command palette must reach one named command (`note:new`) rather
than directly invoking `DocumentWorkspace.create()` from the page. The
integration must remain safe when React Strict Mode reconnects effects, so it
cannot reintroduce a plugin lifecycle-in-progress error.

### In scope

- A stable `note:new` command ID and a type guard for the command boundary.
- An internal `organization-commands` plugin that contributes `note:new` and
  the `mod-n` key binding in the semantic `workspace.global` context.
- A renderer hook that owns the plugin runtime lifecycle, dispatches the
  command with an explicit invocation source, and listens for matching native
  keyboard events.
- Routing the existing new-note UI affordance and `Cmd/Ctrl+N` through that
  hook without changing the resulting note-creation behavior.
- Tests for command registration, dispatch source, keymap resolution,
  lifecycle serialization, and React Strict Mode reconnection.

### Out of scope

- New note metadata, pinning, task counts, templates, sharing, search, or
  note-list selection policy.
- Duplicate, move, archive, restore, or permanent-delete commands. Those
  belong to `note-organization`.
- Notebook or tag commands and any notebook/tag data mutation.
- A command palette, menu registry, keymap preferences screen, chord input,
  or replacement of the current preview-command implementation.
- Schema, SQLite, IPC, bridge, backup, dependency, and CI changes.

## Public behavior

### Command contract

`note:new` is a valid kernel command ID. It is the only content command
introduced by this module.

The organization plugin accepts a typed `onCreateNote` callback. When its
command handler is dispatched, it invokes that callback exactly once and
preserves the `CommandInvocation` source (`api`, `menu`, `context-menu`, or
`keymap`) for future diagnostics and policy. The callback can be asynchronous;
its rejection propagates through the command registry and is reported by the
renderer adapter without leaving a duplicate registration behind.

The plugin itself has no knowledge of React state, document IDs, SQLite, IPC,
or the Electron bridge.

### Renderer adapter

The hook owns a renderer-local plugin runtime and activates one
`organization-commands` plugin. Activation and deactivation share a serialized
lifecycle queue. A cleanup requested while activation is pending waits for
that activation before deactivating, and a failed activation is not followed
by an invalid deactivation attempt.

The callback supplied by the page is held through a current callback reference
instead of being an activation dependency. A normal React re-render therefore
uses the newest `onCreateNote` implementation without activating a second
plugin instance.

The hook exposes a typed dispatcher for `note:new`. Calls made before the
initial activation finishes wait for the activation result. Calls after a
completed cleanup return `false` and do not invoke a stale callback.

### Keyboard behavior

The adapter listens on `window` in the capture phase, resolves a normalized
key stroke against `workspace.global`, and dispatches only a matched,
recognized organization command with source `keymap`.

`Cmd+N` on macOS and `Ctrl+N` on other supported platforms normalize to
`mod-n`. The adapter calls `preventDefault()` only after that exact binding is
matched. It ignores modified keystrokes using Alt and ignores any other key.
No binding is added for `Cmd/Ctrl+P`; the module must not change preview or
system shortcut behavior.

### UI routing

`WorkspacePage` removes its direct `Cmd/Ctrl+N` document-workspace call and
uses the organization dispatcher for the new-note control. The remaining
navigation, distraction-free, preferences, and preview shortcuts preserve
their current paths until their own command modules are specified.

## Tech stack

- TypeScript 7.0.2 and React 19.3.0.
- InkNote's existing plugin kernel: `PluginManager`, `CommandRegistry`, and
  `KeymapRegistry` under `src/renderer/platform/`.
- Jest 30.5.1 with `jest-environment-jsdom` and React Testing Library 16.3.0.
- Electron 44.4.0 through the existing renderer build; no Electron API is
  called directly by this module.

## Commands

Development:

```sh
npm start
```

Focused tests after implementation:

```sh
npm test -- --runInBand src/__tests__/features/organization
```

Quality checks:

```sh
npm run lint
npm run typecheck
npm run test:ci
npm run build
npm run verify
```

## Project structure

```text
src/renderer/features/organization/
  model/organizationCommands.ts       # Stable IDs and command type guard
  runtime/organizationCommandsPlugin.ts # Kernel contribution, no React
  hooks/useOrganizationCommands.ts    # React lifecycle and DOM-key adapter
src/__tests__/features/organization/
  organizationCommands.test.ts        # Plugin command/keymap behavior
  useOrganizationCommands.test.tsx    # Renderer, keyboard, Strict Mode behavior
src/renderer/pages/WorkspacePage.tsx  # Consumes typed dispatch; no direct Cmd/Ctrl+N mutation
SPEC-content-organization-map.md      # Approved module index
SPEC-organization-commands.md         # This module's specification
```

The planned folder is intentionally feature-local. The pure plugin remains a
consumer of `src/renderer/platform/`; no new API is added to the plugin kernel
for this first slice.

## Code style

- Use named exports, `Readonly` object types, `const`, and explicit public
  return types, matching the plugin-kernel and workspace-view conventions.
- Keep the command ID, type guard, plugin factory, and React adapter separate.
- Treat `CommandInvocation.detail` as untrusted/opaque; this slice must not
  require it.
- Handle an asynchronous command dispatch at its UI boundary so rejected
  promises are reported intentionally rather than becoming unhandled.

```ts
export const organizationCommandIds = Object.freeze({
  createNote: 'note:new',
});

export type OrganizationCommand =
  (typeof organizationCommandIds)[keyof typeof organizationCommandIds];

export const isOrganizationCommand = (
  value: unknown,
): value is OrganizationCommand =>
  value === organizationCommandIds.createNote;
```

## Testing strategy

Start with focused failing tests, then implement the smallest behavior that
makes them pass.

| Level | Coverage |
| --- | --- |
| Pure feature test | `note:new` is registered, calls its callback once, carries the invocation source, resolves `mod-n`, and disappears after deactivation. |
| Hook test | Menu/API dispatch and `Cmd/Ctrl+N` dispatch the same command; only the matched key prevents the browser default. |
| Lifecycle test | Strict Mode effect reconnection does not log a plugin-lifecycle error, leave duplicate registrations, or invoke a stale callback. |
| Regression test | Unmatched keys and `Cmd/Ctrl+P` are not consumed by organization commands. |
| Full verification | Run lint, typecheck, the serial test suite, native SQLite verification through `npm run verify`, and the renderer build. |

Tests must assert behavior, not private map contents. Existing workspace-view
tests remain unchanged unless a genuine shared regression requires an update.

## Boundaries

- **Always:** use the existing plugin command/keymap contracts; serialize
  lifecycle work; preserve `note:new` creation semantics; dispose event
  listeners and plugin contributions; add focused regression coverage before
  refactoring UI routing.
- **Ask first:** adding a dependency; changing the plugin-kernel public API;
  adding a global shortcut other than `mod-n`; changing default notebook
  selection; changing persistence, IPC, schema, backups, or CI; modifying the
  preview key bindings.
- **Never:** call SQLite or Electron from the plugin; bypass the command
  dispatcher from the migrated new-note UI; swallow command failures silently;
  register more than one active handler for `note:new`; alter user data as part
  of a command lifecycle cleanup.

## Success criteria

1. The page's new-note control and `Cmd/Ctrl+N` invoke `note:new`, which then
   invokes the document-workspace creation callback exactly once.
2. `note:new` is discoverable to any future in-process command palette through
   the same command registry and can be dispatched with `api`, `menu`,
   `context-menu`, or `keymap` provenance.
3. The native shortcut is prevented only when the organization keymap matches
   `mod-n`; unrelated keystrokes, especially `Cmd/Ctrl+P`, remain untouched by
   this module.
4. React Strict Mode mounting, cleanup, and reconnection do not produce
   `PLUGIN_LIFECYCLE_IN_PROGRESS`, duplicate handlers, or stale callback use.
5. The module adds no runtime dependencies and makes no persistence, IPC,
   schema, or preview-keymap changes.
6. The focused and full verification commands pass after implementation.

## Open questions

None for this module. The deferred modules decide their own command IDs,
selection payloads, confirmation policy, and persistent data changes.
