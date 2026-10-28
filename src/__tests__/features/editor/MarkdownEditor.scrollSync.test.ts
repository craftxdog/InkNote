import { EditorState } from '@codemirror/state';

import { sourceLineForEditorSelection } from '../../../renderer/features/editor/components/MarkdownEditor';

describe('MarkdownEditor scroll synchronization', () => {
  it('uses the current writing line as the preview synchronization anchor', () => {
    const state = EditorState.create({
      doc: 'Opening line\nA middle line\nCurrent writing line\n',
      selection: {
        anchor: 'Opening line\nA middle line\n'.length,
      },
    });

    expect(sourceLineForEditorSelection(state)).toBe(3);
  });
});
