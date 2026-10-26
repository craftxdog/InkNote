export type MarkdownTaskProgress = Readonly<{
  total: number;
  checked: number;
}>;

const TASK_ITEM = /^\s*[-+*]\s+\[([ xX])\]\s+/;
const FENCED_CODE = /^\s*(`{3,}|~{3,})/;

/**
 * Derives Markdown checklist totals without treating fenced examples as live
 * tasks. It has no renderer dependency, so persistence and presentation use
 * the same projection.
 */
export const summarizeMarkdownTaskProgress = (
  markdown: string,
): MarkdownTaskProgress => {
  let total = 0;
  let checked = 0;
  let activeFence: '`' | '~' | null = null;

  for (const line of markdown.split('\n')) {
    const fence = line.match(FENCED_CODE)?.[1];

    if (fence !== undefined) {
      const fenceCharacter = fence[0] as '`' | '~';

      if (activeFence === null) {
        activeFence = fenceCharacter;
      } else if (activeFence === fenceCharacter) {
        activeFence = null;
      }

      continue;
    }

    if (activeFence !== null) {
      continue;
    }

    const task = line.match(TASK_ITEM);

    if (task === null) {
      continue;
    }

    total += 1;
    checked += task[1].toLocaleLowerCase() === 'x' ? 1 : 0;
  }

  return Object.freeze({ total, checked });
};
