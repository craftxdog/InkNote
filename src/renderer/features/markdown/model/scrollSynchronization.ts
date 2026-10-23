export type SourceScrollAnchor = Readonly<{
  startLine: number;
  endLine: number;
  top: number;
  height: number;
}>;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const lineSpan = (anchor: SourceScrollAnchor): number =>
  Math.max(1, anchor.endLine - anchor.startLine + 1);

const anchorForSourceLine = (
  anchors: readonly SourceScrollAnchor[],
  sourceLine: number,
): SourceScrollAnchor | null => {
  if (anchors.length === 0) {
    return null;
  }

  const containedAnchor = anchors.find(
    (anchor) => sourceLine >= anchor.startLine && sourceLine <= anchor.endLine,
  );

  if (containedAnchor !== undefined) {
    return containedAnchor;
  }

  return anchors.reduce((nearest, anchor) => {
    const nearestDistance = Math.min(
      Math.abs(sourceLine - nearest.startLine),
      Math.abs(sourceLine - nearest.endLine),
    );
    const anchorDistance = Math.min(
      Math.abs(sourceLine - anchor.startLine),
      Math.abs(sourceLine - anchor.endLine),
    );

    return anchorDistance < nearestDistance ? anchor : nearest;
  });
};

/**
 * Returns the vertical preview offset for a source Markdown line. Individual
 * lines within a source block interpolate across that rendered block, which
 * keeps long code fences and tables aligned instead of relying on document
 * height ratios.
 */
export const previewScrollTopForSourceLine = (
  anchors: readonly SourceScrollAnchor[],
  sourceLine: number,
): number | null => {
  const anchor = anchorForSourceLine(anchors, sourceLine);

  if (anchor === null) {
    return null;
  }

  const relativeLine = clamp(
    sourceLine - anchor.startLine,
    0,
    lineSpan(anchor),
  );

  return anchor.top + (anchor.height * relativeLine) / lineSpan(anchor);
};

/**
 * Finds the source line represented by the top of the preview viewport. The
 * last anchor above the viewport is intentional: it lets a reader scrolling
 * through a long rendered block keep the editor on the same Markdown block.
 */
export const sourceLineForPreviewScroll = (
  anchors: readonly SourceScrollAnchor[],
  scrollTop: number,
): number | null => {
  if (anchors.length === 0) {
    return null;
  }

  const sortedAnchors = [...anchors].sort(
    (left, right) => left.top - right.top,
  );
  const anchor = sortedAnchors.reduce(
    (current, candidate) => (candidate.top <= scrollTop ? candidate : current),
    sortedAnchors[0],
  );

  if (anchor === undefined) {
    return null;
  }

  const relativeOffset = clamp(scrollTop - anchor.top, 0, anchor.height);
  const relativeLine = Math.floor(
    (relativeOffset / Math.max(anchor.height, 1)) * lineSpan(anchor),
  );

  return clamp(
    anchor.startLine + relativeLine,
    anchor.startLine,
    anchor.endLine,
  );
};
