import { createCommandId } from '../commands/command.types';
import { createPluginKernelError } from '../plugins/plugin.errors';
import {
  createPluginId,
  type PluginId,
  type Registration,
} from '../plugins/plugin.types';
import type {
  KeyBinding,
  KeyBindingInput,
  KeymapResolution,
  KeymapTarget,
} from './keymap.types';

export type { KeymapResolution, KeymapTarget } from './keymap.types';

type RegisteredBinding = Readonly<{
  binding: KeyBinding;
  order: number;
}>;

type ResolvedCandidate = Readonly<{
  entry: RegisteredBinding;
  specificity: number;
}>;

const PARTIAL_RESOLUTION: KeymapResolution = Object.freeze({ kind: 'partial' });
const NO_RESOLUTION: KeymapResolution = Object.freeze({ kind: 'none' });

/**
 * Resolves abstract keyboard descriptors only. A renderer adapter owns browser
 * event normalization, focus lookup, default prevention, chord timeouts, and
 * command dispatch.
 */
export class KeymapRegistry {
  private bindings: RegisteredBinding[] = [];

  private nextRegistrationOrder = 0;

  add(owner: PluginId, bindings: readonly KeyBindingInput[]): Registration {
    createPluginId(owner);

    if (!Array.isArray(bindings) || bindings.length === 0) {
      throw invalidKeyBinding('At least one key binding is required.');
    }

    const registrations = bindings.map((binding) =>
      Object.freeze({
        binding: normalizeKeyBinding(binding),
        order: this.nextRegistrationOrder++,
      }),
    );

    this.bindings.push(...registrations);

    let isDisposed = false;

    return Object.freeze({
      dispose: () => {
        if (isDisposed) {
          return;
        }

        isDisposed = true;

        const registrationsToRemove = new Set(registrations);

        this.bindings = this.bindings.filter(
          (registration) => !registrationsToRemove.has(registration),
        );
      },
    });
  }

  resolve(
    keystrokes: readonly string[],
    targets: readonly KeymapTarget[],
  ): KeymapResolution {
    const normalizedSequence = normalizeKeySequence(keystrokes);

    if (!Array.isArray(targets)) {
      throw invalidKeyBinding('Keymap targets must be an array.');
    }

    for (const target of targets) {
      assertKeymapTarget(target);

      const candidates = this.collectCandidates(normalizedSequence, target);

      if (candidates.length === 0) {
        continue;
      }

      const exactCandidates = candidates.filter(
        ({ entry }) =>
          entry.binding.keystrokes.length === normalizedSequence.length,
      );

      if (exactCandidates.length > 0) {
        const winner = selectWinner(exactCandidates);

        return Object.freeze({
          kind: 'matched',
          binding: winner.entry.binding,
        });
      }

      return PARTIAL_RESOLUTION;
    }

    return NO_RESOLUTION;
  }

  private collectCandidates(
    sequence: readonly string[],
    target: KeymapTarget,
  ): ResolvedCandidate[] {
    const candidates: ResolvedCandidate[] = [];

    for (const entry of this.bindings) {
      if (!startsWithSequence(entry.binding.keystrokes, sequence)) {
        continue;
      }

      const specificity = target.matches(entry.binding.context);

      if (specificity === null) {
        continue;
      }

      if (
        typeof specificity !== 'number' ||
        !Number.isFinite(specificity) ||
        specificity < 0
      ) {
        throw invalidKeyBinding(
          'A keymap target must return a non-negative finite specificity or null.',
        );
      }

      candidates.push(Object.freeze({ entry, specificity }));
    }

    return candidates;
  }
}

const normalizeKeyBinding = (value: KeyBindingInput): KeyBinding => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidKeyBinding('A key binding must be an object.');
  }

  const candidate = value as unknown as Record<string, unknown>;

  if (
    typeof candidate.context !== 'string' ||
    candidate.context.trim().length === 0
  ) {
    throw invalidKeyBinding(
      'A key binding context must be a non-empty string.',
    );
  }

  const priority = candidate.priority ?? 0;

  if (typeof priority !== 'number' || !Number.isFinite(priority)) {
    throw invalidKeyBinding('A key binding priority must be finite.');
  }

  return Object.freeze({
    context: candidate.context.trim(),
    keystrokes: Object.freeze(normalizeKeySequence(candidate.keystrokes)),
    command: createCommandId(candidate.command as string),
    priority,
  });
};

const normalizeKeySequence = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalidKeyBinding('A key binding requires at least one key stroke.');
  }

  return value.map((keyStroke) => {
    if (typeof keyStroke !== 'string') {
      throw invalidKeyBinding('A key stroke must be a string.');
    }

    const normalizedKeyStroke = keyStroke.trim().toLowerCase();

    if (normalizedKeyStroke.length === 0 || /\s/.test(normalizedKeyStroke)) {
      throw invalidKeyBinding(
        'A key stroke cannot be empty or contain whitespace.',
      );
    }

    return normalizedKeyStroke;
  });
};

const startsWithSequence = (
  binding: readonly string[],
  sequence: readonly string[],
): boolean =>
  binding.length >= sequence.length &&
  sequence.every((keyStroke, index) => binding[index] === keyStroke);

const selectWinner = (
  candidates: readonly ResolvedCandidate[],
): ResolvedCandidate =>
  candidates.reduce((winner, candidate) => {
    if (candidate.entry.binding.priority !== winner.entry.binding.priority) {
      return candidate.entry.binding.priority > winner.entry.binding.priority
        ? candidate
        : winner;
    }

    if (candidate.specificity !== winner.specificity) {
      return candidate.specificity > winner.specificity ? candidate : winner;
    }

    return candidate.entry.order > winner.entry.order ? candidate : winner;
  });

function assertKeymapTarget(value: unknown): asserts value is KeymapTarget {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as KeymapTarget).matches !== 'function'
  ) {
    throw invalidKeyBinding('A keymap target must expose a matches function.');
  }
}

const invalidKeyBinding = (message: string) =>
  createPluginKernelError('INVALID_KEY_BINDING', message);
