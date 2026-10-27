import {
  sourceScrollPositionFor,
  sourceLineForPreviewScroll,
  previewScrollTopForSourceLine,
  type SourceScrollAnchor,
} from '../../../renderer/features/markdown/model/scrollSynchronization';

const anchors: readonly SourceScrollAnchor[] = [
  { startLine: 1, endLine: 3, top: 0, height: 96 },
  { startLine: 4, endLine: 10, top: 96, height: 252 },
  { startLine: 11, endLine: 18, top: 348, height: 320 },
];

describe('Markdown scroll synchronization', () => {
  it('maps a source line inside a rendered block to its corresponding preview offset', () => {
    expect(previewScrollTopForSourceLine(anchors, 7)).toBe(204);
  });

  it('maps a preview offset inside a rendered block back to the corresponding source line', () => {
    expect(sourceLineForPreviewScroll(anchors, 204)).toBe(7);
  });

  it('keeps the nearest source block when the requested line is between rendered anchors', () => {
    expect(previewScrollTopForSourceLine(anchors, 24)).toBe(668);
  });

  it('preserves the bottom boundary instead of synchronizing to the first visible source line', () => {
    expect(
      sourceScrollPositionFor({
        sourceLine: 14,
        scrollTop: 900,
        scrollHeight: 1_000,
        clientHeight: 100,
      }),
    ).toEqual({ kind: 'end' });

    expect(
      sourceScrollPositionFor({
        sourceLine: 12,
        scrollTop: 600,
        scrollHeight: 700,
        clientHeight: 100,
      }),
    ).toEqual({ kind: 'end' });
  });
});
