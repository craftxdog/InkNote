# Spec: plugin-kernel

Status: in progress on 2026-10-20.

## Objective

Provide the small, framework-free extension kernel that the InkNote editor
needs before it mounts CodeMirror: scoped configuration, commands, contextual
key bindings, an injected environment, and deterministic plugin cleanup.

The design is informed by the public Inkdrop module APIs, but it is an InkNote
API. It does not claim to load or be binary-compatible with arbitrary Inkdrop,
VimScript, Lua, Neovim, or npm plugins.

## Scope

### Included

- A branded plugin identifier and an immutable, idempotent registration handle
  with dispose().
- Structured kernel errors with stable codes.
- A typed configuration schema for booleans, strings, integers, and numbers.
- An injected asynchronous configuration storage port with a volatile in-memory
  adapter, including hydration, defaults, coercion, observation, and change
  observation.
- A command registry that owns one namespaced handler per command.
- A keymap registry that resolves descriptor data against abstract targets.
- Plugin activation/deactivation with ownership tracking and rollback.
- A pure runtime factory that injects only the intended capabilities.

### Excluded

- React context, DOM events, CSS selector parsing, KeyboardEvent handling, or
  CodeMirror extensions.
- Plugin discovery, package installation, filesystem loading, sandboxing, or
  execution of arbitrary third-party code.
- SQLite, IPC, note-document access, HTTP, Supabase, Appwrite, or secrets.
- Menus, context menus, component/layout managers, Markdown rendering, and
  Markdown editor mounting. Those are later consumers of this kernel.

## Public behavior

### Plugin ownership and lifecycle

A plugin is a pre-imported internal module with an ID, an optional config
schema, an activate(environment) callback, and an optional
deactivate(environment) callback. Plugin identifiers are non-empty,
lowercase, kebab-case segments separated by dots. A plugin never passes an
owner ID to a registry: it receives facades scoped to its own lifetime.

PluginManager activation registers the plugin schema, creates its scoped
environment, and invokes activate(). A duplicate active or activating ID is
rejected. If activation fails, every contribution made during activation is
released in reverse order, the schema is removed, and the error is rethrown.

Deactivation closes the scope first, so a retained asynchronous callback cannot
add work after shutdown. It invokes deactivate() when present and releases all
registered contributions in a finally path. Deactivation is idempotent. A
deactivation error is surfaced only after cleanup completes.

This version intentionally accepts plugin objects supplied directly to the
manager. Loading untrusted extension code is a separate security design.

### Configuration

Config values are scalar JSON values: string, number, or boolean. Schemas are
keyed by a plugin-local lower camel-case setting name. A setting declares one
of boolean, string, integer, or number, a default, optional title, and number
limits where relevant. Defaults must satisfy their own schema.

The root ConfigService keeps an in-memory cache of canonical keys formed as
plugin-id plus a dot plus local key. Before any plugin activation, the runtime
must hydrate that cache through ConfigStorage.load(). It never exposes its
mutable state. The scoped config facade only accepts a plugin-local key, so a
plugin cannot read or write another plugin's configuration.

After hydration, get() synchronously returns a validated cached override when
one exists, otherwise the schema default. set() validates or coerces an input,
serializes writes, awaits ConfigStorage.apply(), then updates the cache. For
numeric settings, numeric strings are accepted and minimum/maximum values are
clamped. Integer settings reject non-integral results. Booleans and strings
must already have their declared runtime type. A failed persistence operation
does not update the cache or notify observers.

observe() invokes the listener immediately with the effective value and again
after every committed effective value change. onDidChange() skips the initial
value and only reports a change when the effective value differs by Object.is;
it receives oldValue and newValue. Listener errors are sent to an optional
diagnostic callback and cannot undo an accepted configuration write. Disposing
an observer stops further notifications.

The first storage adapter is explicitly volatile and in memory. The storage
port remains injected so a later secure IPC persistence adapter can replace it
without changing a plugin contract. Removing a schema does not erase a stored
override; re-activating the same plugin can safely restore it.

### Commands

Command IDs use namespace:action with lowercase kebab-case segments. For
example, editor:toggle-vim-mode. One handler owns each ID. Registration fails
on invalid IDs or a duplicate ID; dispose removes only the exact registration
that created it and can be called repeatedly.

dispatch(command, invocation) returns false when no handler exists, otherwise
awaits the handler and returns true. Invocation contains a source of api,
keymap, menu, or context-menu and optional opaque detail. Handler failures
propagate to the caller; the registry does not hide command failures.

The current registry does not perform Inkdrop-style DOM event bubbling. A
future DOM adapter may resolve a target and translate a DOM event into this
pure invocation contract.

### Keymaps

A KeyBinding contains an abstract context, a non-empty sequence of normalized
key strokes, a command ID, and an optional numeric priority. Context is an
opaque semantic string such as editor.focused rather than a CSS selector in
this initial runtime. KeymapRegistry stores only descriptors; it does not
inspect KeyboardEvent, prevent browser defaults, run commands, implement
timeouts, or replay buffered keys.

resolve(sequence, targets) receives targets ordered from focused element to
ancestor. Each target provides matches(context), returning context specificity
or null. At the first target with candidates, the registry chooses the greatest
priority, then specificity; a tie chooses the most recently registered binding.
It returns matched, partial for a valid chord prefix, or none. An exact match
at a focused target wins over any ancestor binding.

This preserves the useful ownership, precedence, and chord concepts from
Inkdrop while keeping DOM and CodeMirror policy out of the platform core.

### Environment

PluginEnvironment exposes only apiVersion, appVersion, devMode, scoped config,
scoped commands, and scoped keymaps. It exposes no global singleton, Electron,
document session, database, network client, filesystem, or privileged bridge.
The runtime factory receives appVersion, devMode, an optional storage adapter,
and an optional listener-error reporter. The manager hydrates configuration
before invoking activate().

## Error vocabulary

PluginKernelError is immutable and exposes a stable code:

- INVALID_PLUGIN_ID
- PLUGIN_ALREADY_ACTIVE
- PLUGIN_NOT_ACTIVE
- PLUGIN_LIFECYCLE_IN_PROGRESS
- PLUGIN_SCOPE_CLOSED
- INVALID_CONFIG_KEY
- CONFIG_SCHEMA_CONFLICT
- CONFIG_UNKNOWN_KEY
- INVALID_CONFIG_VALUE
- CONFIG_NOT_HYDRATED
- INVALID_COMMAND_ID
- INVALID_COMMAND_HANDLER
- INVALID_COMMAND_INVOCATION
- COMMAND_CONFLICT
- INVALID_KEY_BINDING

Messages may improve over time; callers should branch only on code.

## Project structure

    src/renderer/platform/plugins/
      plugin.types.ts
      plugin.errors.ts
      PluginManager.ts
    src/renderer/platform/config/
      config.types.ts
      config.storage.ts
      ConfigService.ts
    src/renderer/platform/commands/
      command.types.ts
      CommandRegistry.ts
    src/renderer/platform/keymaps/
      keymap.types.ts
      KeymapRegistry.ts
    src/renderer/platform/environment/
      environment.types.ts
      createEnvironment.ts
      runtime.ts
    src/__tests__/platform/
      plugins/
      config/
      commands/
      keymaps/
      environment/

EnvironmentProvider.tsx remains empty in this capability. A React adapter is
not part of the pure kernel.

## Testing strategy

- Start each registry with focused failing Jest tests.
- Prove hydration, config defaults, validation/coercion, serialized durable
  writes, immediate observation, real change observation, listener isolation,
  and observer disposal.
- Prove command validation, duplicate rejection, async dispatch, handler
  error propagation, and idempotent disposal.
- Prove exact/partial/missing keymap resolution, target precedence,
  specificity, recency, and disposal.
- Prove activation rollback, deactivation cleanup, duplicate activation, and
  retained scoped facade rejection after closure.
- Run lint, typecheck, the full CI test suite, and the renderer build after
  the module is complete.

## Boundaries

- Always keep plugin-kernel free of React, Electron, CodeMirror, SQLite,
  document-core, HTTP clients, and remote credentials.
- Always clean contributions through the scope even when lifecycle callbacks
  throw.
- Ask before adding a dependency, enabling package execution, or exposing an
  Electron/IPC capability to plugins.
- Never expose a mutable registry map, a global environment object, a direct
  database client, or arbitrary plugin loading in this layer.

## Success criteria

- A built-in feature can register configuration, commands, and keymaps without
  knowing how the application stores settings or handles DOM events.
- Disabling that feature removes every contribution it registered.
- A future CodeMirror adapter can translate keyboard input into keymap
  resolution and dispatch without expanding plugin privileges.
- The module compiles and its tests demonstrate lifecycle cleanup and
  deterministic precedence.
