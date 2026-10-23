import type { EditorView } from '@codemirror/view';

import type { MarkdownTransformation } from '../model/markdownAuthoring';

/**
 * Applies a whole-document Markdown transformation as the smallest possible
 * CodeMirror change. This preserves history and avoids replacing the full
 * note when an authoring command changes a short selection.
 */
export const dispatchMarkdownTransformation = (
  view: EditorView,
  transformation: MarkdownTransformation,
): void => {
  const current = view.state.doc.toString();
  const next = transformation.text;
  let from = 0;

  while (
    from < current.length &&
    from < next.length &&
    current[from] === next[from]
  ) {
    from += 1;
  }

  let currentTo = current.length;
  let nextTo = next.length;

  while (
    currentTo > from &&
    nextTo > from &&
    current[currentTo - 1] === next[nextTo - 1]
  ) {
    currentTo -= 1;
    nextTo -= 1;
  }

  view.dispatch({
    changes: { from, to: currentTo, insert: next.slice(from, nextTo) },
    selection: {
      anchor: transformation.selection.from,
      head: transformation.selection.to,
    },
    scrollIntoView: true,
  });
};
