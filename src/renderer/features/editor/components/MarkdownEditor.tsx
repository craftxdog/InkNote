import { useEffect, useRef } from 'react';

import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  autocompletion,
  type CompletionContext,
} from '@codemirror/autocomplete';
import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
import {
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';

import { codeLanguageDescriptionForFence } from '../../markdown/model/codeLanguages';
import { findEmojiCompletions } from '../../markdown/model/emojiCompletions';
import { inkdropSyntaxHighlighter } from '../../markdown/model/inkdropSyntaxHighlighter';
import {
  sourceScrollPositionFor,
  type SourceScrollPosition,
} from '../../markdown/model/scrollSynchronization';
import { formatNoteReference } from '../../references/model/noteReferences';
import {
  applyMarkdownLink,
  applySlashCommand,
  applyMarkdownFormat,
  slashCommandsFor,
  slashQueryForLine,
  type MarkdownFormatId,
} from '../model/markdownAuthoring';
import type { NoteDocument } from '../../../../shared/documents/document.types';

import { markdownSelectionToolbar } from './MarkdownSelectionToolbar';
import { dispatchMarkdownTransformation } from './markdownTransformationDispatch';

type MarkdownEditorProps = {
  value: string;
  referenceDocuments?: readonly NoteDocument[];
  onChange: (value: string) => void;
  onSourceLineChange?: (position: SourceScrollPosition) => void;
  sourceScrollPositionToReveal?: SourceScrollPosition;
};

/**
 * Local edits establish the author's current source line as the split-preview
 * anchor. Reading it from CodeMirror state avoids measuring DOM before the
 * editor has completed its own layout update.
 */
export const sourceLineForEditorSelection = (state: EditorState): number =>
  state.doc.lineAt(state.selection.main.head).number;

const inkNoteEditorTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--editor-foreground-color)',
      backgroundColor: 'var(--inknote-editor-background)',
    },
    '.cm-content': {
      caretColor: 'var(--editor-caret-color)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--editor-caret-color)',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--inknote-editor-selection-background)',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--inknote-editor-focused-selection-background)',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--inknote-editor-active-line-background)',
    },
    '.cm-gutters': {
      color: 'var(--inknote-editor-gutter-foreground)',
      backgroundColor: 'var(--inknote-editor-gutter-background)',
      border: 'none',
    },
    '.cm-activeLineGutter': {
      color: 'var(--primary-color)',
      backgroundColor: 'var(--inknote-editor-active-line-gutter-background)',
    },
  },
  { dark: false },
);

const inkNoteMarkdownHighlighting = HighlightStyle.define([
  {
    tag: [
      tags.heading,
      tags.heading1,
      tags.heading2,
      tags.heading3,
      tags.heading4,
      tags.heading5,
      tags.heading6,
    ],
    color: 'var(--syntax-heading-color)',
    fontWeight: '700',
    textDecoration: 'none',
  },
  {
    tag: tags.punctuation,
    color: 'var(--syntax-punctuation-color)',
  },
  {
    tag: tags.strong,
    color: 'var(--editor-foreground-color)',
    fontWeight: '700',
  },
  {
    tag: tags.emphasis,
    color: 'var(--syntax-emphasis-color)',
    fontStyle: 'italic',
  },
  {
    tag: [tags.link, tags.url],
    color: 'var(--syntax-url-color)',
  },
  {
    tag: tags.meta,
    color: 'var(--syntax-meta-color)',
  },
  {
    tag: tags.quote,
    color: 'var(--syntax-quote-color)',
  },
]);

const emojiCompletionSource = (context: CompletionContext) => {
  const shortcode = context.matchBefore(/:[a-z0-9_+-]*/i);

  if (shortcode === null) {
    return null;
  }

  const completions = findEmojiCompletions(shortcode.text.slice(1));

  if (completions.length === 0) {
    return null;
  }

  return {
    from: shortcode.from,
    options: completions.map((completion) => ({
      label: completion.label,
      detail: completion.emoji,
      info: completion.description,
      apply: completion.emoji,
      type: 'text',
    })),
    validFor: /^:[a-z0-9_+-]*$/i,
  };
};

const noteReferenceCompletionSource = (
  referenceDocumentsRef: Readonly<{ current: readonly NoteDocument[] }>,
) => {
  return (context: CompletionContext) => {
    const reference = context.matchBefore(/\[\[[^\]\n]*/);

    if (reference === null) {
      return null;
    }

    const query = reference.text.slice(2).trim().toLocaleLowerCase();
    const matchingDocuments = referenceDocumentsRef.current.filter(
      (document) =>
        query.length === 0 ||
        document.title.toLocaleLowerCase().includes(query),
    );

    if (matchingDocuments.length === 0) {
      return null;
    }

    return {
      from: reference.from,
      options: matchingDocuments.map((document) => ({
        label: document.title.trim() || 'Untitled note',
        detail: 'Note reference',
        apply: formatNoteReference(document),
        type: 'text',
      })),
      validFor: /\[\[[^\]\n]*$/,
    };
  };
};

const slashCommandCompletionSource = (context: CompletionContext) => {
  const line = context.state.doc.lineAt(context.pos);
  const query = slashQueryForLine(line.text, context.pos - line.from);

  if (query === null) {
    return null;
  }

  const commands = slashCommandsFor(query.query);

  if (commands.length === 0) {
    return null;
  }

  return {
    from: line.from + query.from,
    options: commands.map((command) => ({
      label: command.label,
      detail: `/${command.id.replaceAll('-', ' ')}`,
      type: 'keyword',
      apply: (
        view: EditorView,
        _completion: unknown,
        from: number,
        to: number,
      ) =>
        dispatchMarkdownTransformation(
          view,
          applySlashCommand(
            view.state.doc.toString(),
            { from, to },
            command.id,
          ),
        ),
    })),
  };
};

const applyFormatToEditor = (
  view: EditorView,
  format: MarkdownFormatId,
): boolean => {
  dispatchMarkdownTransformation(
    view,
    applyMarkdownFormat(
      view.state.doc.toString(),
      view.state.selection.main,
      format,
    ),
  );
  return true;
};

const pasteSelectedUrl = (view: EditorView, event: ClipboardEvent): void => {
  const selection = view.state.selection.main;

  if (selection.empty) {
    return;
  }

  const clipboardText = event.clipboardData?.getData('text/plain');

  if (clipboardText === undefined) {
    return;
  }

  const transformation = applyMarkdownLink(
    view.state.doc.toString(),
    selection,
    clipboardText,
  );

  if (transformation === null) {
    return;
  }

  event.preventDefault();
  dispatchMarkdownTransformation(view, transformation);
};

/**
 * Intercept a URL paste before CodeMirror replaces the selected label. The
 * returned cleanup keeps the DOM listener's lifetime tied to its EditorView.
 */
export const attachMarkdownPasteHandler = (view: EditorView): (() => void) => {
  const handlePaste = (event: ClipboardEvent): void =>
    pasteSelectedUrl(view, event);

  view.contentDOM.addEventListener('paste', handlePaste, true);

  return () => {
    view.contentDOM.removeEventListener('paste', handlePaste, true);
  };
};

const markdownAuthoringKeymap = keymap.of([
  { key: 'Mod-b', run: (view) => applyFormatToEditor(view, 'bold') },
  { key: 'Mod-i', run: (view) => applyFormatToEditor(view, 'italic') },
  { key: "Mod-'", run: (view) => applyFormatToEditor(view, 'blockquote') },
  { key: 'Mod-Alt-k', run: (view) => applyFormatToEditor(view, 'link') },
]);

/**
 * CodeMirror is deliberately uncontrolled from React while a user types. React
 * supplies authoritative document changes, and this component only emits local
 * text intents; the parent serializes persistence through DocumentSession.
 */
export function MarkdownEditor({
  value,
  referenceDocuments = [],
  onChange,
  onSourceLineChange,
  sourceScrollPositionToReveal,
}: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSourceLineChangeRef = useRef(onSourceLineChange);
  const referenceDocumentsRef = useRef(referenceDocuments);
  const valueRef = useRef(value);
  const isApplyingExternalValue = useRef(false);
  const pendingSynchronizedScrollTop = useRef<number | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSourceLineChangeRef.current = onSourceLineChange;
  }, [onSourceLineChange]);

  useEffect(() => {
    referenceDocumentsRef.current = referenceDocuments;
  }, [referenceDocuments]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const host = hostRef.current;

    if (host === null) {
      return undefined;
    }

    const extensions: Extension[] = [
      history(),
      drawSelection(),
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      syntaxHighlighting(inkNoteMarkdownHighlighting),
      syntaxHighlighting(inkdropSyntaxHighlighter),
      markdown({ codeLanguages: codeLanguageDescriptionForFence }),
      indentOnInput(),
      markdownSelectionToolbar,
      markdownAuthoringKeymap,
      autocompletion({
        activateOnTyping: true,
        override: [
          slashCommandCompletionSource,
          emojiCompletionSource,
          noteReferenceCompletionSource(referenceDocumentsRef),
        ],
      }),
      inkNoteEditorTheme,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': 'Markdown editor' }),
      keymap.of([
        ...markdownKeymap,
        indentWithTab,
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !isApplyingExternalValue.current) {
          onChangeRef.current(update.state.doc.toString());
          onSourceLineChangeRef.current?.({
            kind: 'line',
            sourceLine: sourceLineForEditorSelection(update.state),
          });
        }
      }),
    ];
    const state = EditorState.create({
      doc: valueRef.current,
      extensions,
    });
    const view = new EditorView({ state, parent: host });
    const reportSourceLine = (): void => {
      const scrollTop = view.scrollDOM.scrollTop;
      const synchronizedScrollTop = pendingSynchronizedScrollTop.current;

      if (
        synchronizedScrollTop !== null &&
        Math.abs(scrollTop - synchronizedScrollTop) < 1
      ) {
        pendingSynchronizedScrollTop.current = null;
        return;
      }

      const lineBlock = view.lineBlockAtHeight(scrollTop);
      const sourceLine = view.state.doc.lineAt(lineBlock.from).number;
      onSourceLineChangeRef.current?.(
        sourceScrollPositionFor({
          sourceLine,
          scrollTop,
          scrollHeight: view.scrollDOM.scrollHeight,
          clientHeight: view.scrollDOM.clientHeight,
        }),
      );
    };

    viewRef.current = view;

    view.scrollDOM.addEventListener('scroll', reportSourceLine, {
      passive: true,
    });
    // Capture before CodeMirror mutates the selected source text. This keeps
    // the selected label and uses the clipboard URL as the link destination.
    const removeMarkdownPasteHandler = attachMarkdownPasteHandler(view);

    return () => {
      view.scrollDOM.removeEventListener('scroll', reportSourceLine);
      removeMarkdownPasteHandler();
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;

    if (view === null || view.state.doc.toString() === value) {
      return;
    }

    isApplyingExternalValue.current = true;

    try {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
      });
    } finally {
      isApplyingExternalValue.current = false;
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;

    if (view === null || sourceScrollPositionToReveal === undefined) {
      return;
    }

    const maximumScrollTop = Math.max(
      0,
      view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight,
    );

    if (sourceScrollPositionToReveal.kind === 'end') {
      if (Math.abs(view.scrollDOM.scrollTop - maximumScrollTop) < 1) {
        return;
      }

      pendingSynchronizedScrollTop.current = maximumScrollTop;
      view.scrollDOM.scrollTop = maximumScrollTop;
      return;
    }

    const lineNumber = Math.min(
      Math.max(1, sourceScrollPositionToReveal.sourceLine),
      view.state.doc.lines,
    );
    const lineBlock = view.lineBlockAt(view.state.doc.line(lineNumber).from);
    const scrollTop = Math.min(Math.max(0, lineBlock.top), maximumScrollTop);

    if (Math.abs(view.scrollDOM.scrollTop - scrollTop) < 1) {
      return;
    }

    pendingSynchronizedScrollTop.current = scrollTop;
    view.scrollDOM.scrollTop = scrollTop;
  }, [sourceScrollPositionToReveal]);

  return <div ref={hostRef} className="markdown-editor" />;
}
