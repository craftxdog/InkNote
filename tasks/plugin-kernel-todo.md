# Tasks: plugin-kernel

## Task 1: plugin primitives and command registry

**Description:** Define the branded plugin and command contracts, immutable
kernel errors, local registration cleanup, and a namespaced command registry.

**Acceptance criteria:**

- [ ] Command IDs validate as namespace:action.
- [ ] Duplicate command registration is explicit and cannot replace a handler.
- [ ] Dispatch awaits a handler, reports absence as false, and propagates a
      handler failure.
- [ ] Registration disposal is scoped and idempotent.

**Verification:**

- [ ] Focused commands Jest suite passes.
- [ ] npm run typecheck passes.

## Task 2: configuration service

**Description:** Add scalar config schemas, a volatile in-memory storage
adapter behind an asynchronous port, hydration, validation/coercion, and safe
observer semantics.

**Acceptance criteria:**

- [ ] Config defaults survive missing hydrated values.
- [ ] Failed persistence leaves the memory cache and observers unchanged.
- [ ] A scoped plugin config cannot read/write another plugin's key.
- [ ] observe is immediate; onDidChange only sees actual later changes.
- [ ] Failed observers cannot reverse an accepted write.

**Verification:**

- [ ] Focused config Jest suite passes.
- [ ] npm run typecheck passes.

## Task 3: pure keymap registry

**Description:** Register descriptor data and resolve it against abstract
targets, without DOM or CodeMirror imports.

**Acceptance criteria:**

- [ ] Exact, partial, and absent sequences are distinguishable.
- [ ] Focused-target, priority, specificity, and recency precedence is
      deterministic.
- [ ] Disposal removes registered bindings.

**Verification:**

- [ ] Focused keymaps Jest suite passes.
- [ ] npm run typecheck passes.

## Task 4: injected environment and plugin lifecycle

**Description:** Scope all facades through PluginManager and prove activation
rollback/deactivation cleanup.

**Acceptance criteria:**

- [ ] A plugin has no owner-spoofing API.
- [ ] Activation failure rolls back config, command, keymap, and observer work.
- [ ] Deactivation always cleans all contributions, even when its callback
      throws.
- [ ] Retained environments cannot register after their scope closes.

**Verification:**

- [ ] Focused plugin/environment Jest suites pass.
- [ ] npm run lint, npm run typecheck, npm run test:ci, and npm run build pass.

## Checkpoint: complete plugin-kernel

- [ ] All public values and registrations are immutable/idempotent.
- [ ] No dependency file has changed.
- [ ] No production module imports React, Electron, CodeMirror, SQLite,
      document-core, HTTP, or a remote SDK.
