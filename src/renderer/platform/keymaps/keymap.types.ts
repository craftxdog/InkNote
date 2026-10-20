import type { CommandId } from '../commands/command.types';
import type { Registration } from '../plugins/plugin.types';

export type KeySequence = readonly string[];

export type KeyBindingInput = Readonly<{
  context: string;
  keystrokes: KeySequence;
  command: string;
  priority?: number;
}>;

export type KeyBinding = Readonly<{
  context: string;
  keystrokes: KeySequence;
  command: CommandId;
  priority: number;
}>;

export type KeymapTarget = Readonly<{
  matches(context: string): number | null;
}>;

export type KeymapResolution =
  | Readonly<{
      kind: 'matched';
      binding: KeyBinding;
    }>
  | Readonly<{
      kind: 'partial';
    }>
  | Readonly<{
      kind: 'none';
    }>;

export type ScopedKeymapRegistry = Readonly<{
  add(bindings: readonly KeyBindingInput[]): Registration;
}>;
