/** @jest-environment node */

import { summarizeMarkdownTaskProgress } from '../../../shared/documents/taskProgress';

describe('summarizeMarkdownTaskProgress', () => {
  it('counts checked Markdown tasks and ignores fenced examples', () => {
    const progress = summarizeMarkdownTaskProgress(
      [
        '- [x] Ship the migration',
        '- [ ] Verify the backup',
        '```md',
        '- [x] This is a code example',
        '```',
        '~~~markdown',
        '- [ ] This is another code example',
        '~~~',
      ].join('\n'),
    );

    expect(progress).toEqual({ total: 2, checked: 1 });
    expect(Object.isFrozen(progress)).toBe(true);
  });

  it('returns zero counters when Markdown contains no task items', () => {
    expect(summarizeMarkdownTaskProgress('# Plain note')).toEqual({
      total: 0,
      checked: 0,
    });
  });
});
