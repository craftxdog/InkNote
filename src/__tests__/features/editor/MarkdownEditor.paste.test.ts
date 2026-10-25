import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { attachMarkdownPasteHandler } from '../../../renderer/features/editor/components/MarkdownEditor';

describe('MarkdownEditor URL paste', () => {
  it('converts a selected label into a link before CodeMirror replaces it', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const view = new EditorView({
      state: EditorState.create({
        doc: 'Read Inkdrop manual',
        selection: { anchor: 5, head: 12 },
      }),
      parent: host,
    });
    const removePasteHandler = attachMarkdownPasteHandler(view);
    const event = new Event('paste', {
      bubbles: true,
      cancelable: true,
    }) as ClipboardEvent;

    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData: (type: string) =>
          type === 'text/plain' ? 'https://docs.inkdrop.app/' : '',
      },
    });

    view.contentDOM.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.toString()).toBe(
      'Read [Inkdrop](https://docs.inkdrop.app/) manual',
    );

    removePasteHandler();
    view.destroy();
    host.remove();
  });

  it('delegates an unsupported clipboard value to CodeMirror', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const view = new EditorView({
      state: EditorState.create({
        doc: 'Read Inkdrop manual',
        selection: { anchor: 5, head: 12 },
      }),
      parent: host,
    });
    const removePasteHandler = attachMarkdownPasteHandler(view);
    const event = new Event('paste', {
      bubbles: true,
      cancelable: true,
    }) as ClipboardEvent;

    Object.defineProperty(event, 'clipboardData', {
      value: { getData: () => 'not a URL' },
    });

    view.contentDOM.dispatchEvent(event);

    expect(view.state.doc.toString()).toBe('Read not a URL manual');

    removePasteHandler();
    view.destroy();
    host.remove();
  });
});
