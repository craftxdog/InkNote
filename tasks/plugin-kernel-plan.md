# Implementation Plan: plugin-kernel

## Overview

Build the editor platform's pure extension foundation before a CodeMirror or
React consumer exists. The plan moves bottom-up from ownership/error primitives
to registries, then composes scoped facades and lifecycle behavior.

## Dependency graph

    plugin IDs + errors + registrations
                   |
          +--------+--------+
          |        |        |
       config   commands  keymaps
          |        |        |
          +--------+--------+
                   |
        scoped environment factory
                   |
             plugin manager

## Architecture decisions

- Use a module-local Registration with dispose(), not the current unrelated
  shared Disposable which exposes disposable().
- Make every plugin contribution scoped by PluginManager, not by an owner value
  supplied by plugin code.
- Keep configuration scalar and schema-controlled. The renderer uses a hydrated
  memory cache; persistence is injected asynchronously and never selected in
  this module.
- Treat keymaps as data and abstract matching; UI adapters own keyboard event
  normalization, focus, timeout, default prevention, and dispatch.
- Keep one namespaced command handler per ID. DOM bubbling and selector logic
  belong in a future adapter.
- Execute only internally supplied plugin modules. Extension loading requires a
  separate sandbox and trust model.

## Phases

### Phase 1: safe primitives and commands

- Define plugin identity, registration cleanup, kernel errors, command types,
  and CommandRegistry.
- Test validation, duplicate handling, dispatch behavior, error propagation,
  and registration disposal.

### Phase 2: configuration and keymap registries

- Define scalar configuration schemas, an in-memory storage adapter, and
  ConfigService with observation semantics.
- Define pure KeymapRegistry descriptors and deterministic resolution.
- Test all validation, observation, and precedence rules.

### Phase 3: scoped environment and lifecycle

- Compose registries behind scoped facades and Runtime options.
- Implement PluginManager activation rollback, safe deactivation, and retained
  environment rejection.
- Test cleanup across every contribution type.

### Checkpoint: complete plugin-kernel

- Run focused unit tests while implementing each phase.
- Run npm run lint, npm run typecheck, npm run test:ci, and npm run build.
- Confirm no plugin-kernel production file imports React, Electron, CodeMirror,
  SQLite, document-core, an HTTP client, or remote SDK.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A retained plugin facade registers after deactivation | High | Close the scope before deactivate and reject every later registration. |
| Activation fails after partial registration | High | Dispose registrations in reverse order and remove the schema. |
| An observer makes a successful config write look failed | Medium | Isolate observer/reporting exceptions from set(). |
| Keymap behavior is coupled to a browser event too early | Medium | Resolve descriptors through abstract targets only. |
| The registry is mistaken for arbitrary plugin support | High | Accept pre-imported internal plugins only and document the boundary. |

## Follow-on capability

The next editor-runtime slice can mount one CodeMirror Markdown editor and use
the command/keymap contracts without importing persistence or remote sync.
