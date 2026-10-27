import type { TagColor } from '../../../../shared/documents/document.types';
import type { NoteTag } from './note.types';

export const noteTagColors = [
  'blue',
  'green',
  'red',
  'purple',
  'orange',
] as const satisfies readonly NoteTag['color'][];

export const tagColorHex: Record<TagColor, string> = {
  default: '#8e96a3',
  blue: '#4e81f3',
  green: '#22c160',
  red: '#ed5668',
  purple: '#8b6df4',
  orange: '#f8b126',
  yellow: '#d9a800',
  olive: '#81911b',
  teal: '#17a6a6',
  violet: '#7b61d1',
  pink: '#d95f9d',
  brown: '#9a6b4f',
  grey: '#6f7782',
  black: '#343a40',
};

/**
 * A tag keeps the same semantic color wherever it is shown. Using its text as
 * the input makes the result stable across notes, sessions, and list order.
 */
export const colorForTag = (tag: string): NoteTag['color'] => {
  let hash = 0;

  for (const character of tag.toLocaleLowerCase()) {
    hash = (hash * 31 + character.codePointAt(0)!) | 0;
  }

  return noteTagColors[Math.abs(hash) % noteTagColors.length];
};
