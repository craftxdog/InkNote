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
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import {
  EditorState,
  RangeSetBuilder,
  StateEffect,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';

import { findEmojiCompletions } from '../../markdown/model/emojiCompletions';
import { formatNoteReference } from '../../references/model/noteReferences';
import {
  applySlashCommand,
  slashCommandsFor,
  slashQueryForLine,
} from '../model/markdownAuthoring';
import type { NoteDocument } from '../../../../shared/documents/document.types';

import { markdownSelectionToolbar } from './MarkdownSelectionToolbar';
import { dispatchMarkdownTransformation } from './markdownTransformationDispatch';

type MarkdownEditorProps = {
  value: string;
  referenceDocuments?: readonly NoteDocument[];
  onChange: (value: string) => void;
  onSourceLineChange?: (sourceLine: number) => void;
  sourceLineToReveal?: number;
};

const inkNoteEditorTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--color-text)',
      backgroundColor: 'var(--color-workspace)',
    },
    '.cm-content': {
      caretColor: 'var(--color-text)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--color-text)',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection':
      {
        backgroundColor: 'var(--color-selection-background)',
      },
    '.cm-activeLine': {
      backgroundColor: 'var(--color-editor-active-line)',
    },
    '.cm-gutters': {
      color: 'var(--color-editor-gutter)',
      backgroundColor: 'var(--color-workspace)',
      border: 'none',
    },
    '.cm-activeLineGutter': {
      color: 'var(--color-focus)',
      backgroundColor: 'var(--color-editor-active-line)',
    },
    '.inknote-editor-token--comment': {
      color: 'var(--syntax-code-comment)',
      fontStyle: 'italic',
    },
    '.inknote-editor-token--keyword': {
      color: 'var(--syntax-code-keyword)',
    },
    '.inknote-editor-token--literal': {
      color: 'var(--syntax-code-literal)',
    },
    '.inknote-editor-token--number': {
      color: 'var(--syntax-code-number)',
    },
    '.inknote-editor-token--string': {
      color: 'var(--syntax-code-string)',
    },
  },
  { dark: false },
);

const inkNoteMarkdownHighlighting = HighlightStyle.define([
  {
    tag: [tags.heading, tags.heading1, tags.heading2, tags.heading3],
    color: 'var(--syntax-heading)',
    fontWeight: '700',
    textDecoration: 'none',
  },
  {
    tag: tags.punctuation,
    color: 'var(--syntax-punctuation)',
  },
  {
    tag: tags.strong,
    color: 'var(--color-text)',
    fontWeight: '700',
  },
  {
    tag: tags.emphasis,
    color: 'var(--syntax-emphasis)',
    fontStyle: 'italic',
  },
  {
    tag: [tags.link, tags.url],
    color: 'var(--syntax-link)',
  },
  {
    tag: tags.meta,
    color: 'var(--syntax-meta)',
  },
  {
    tag: tags.quote,
    color: 'var(--syntax-quote)',
  },
]);

type EditorCodeTokenKind =
  'comment' | 'keyword' | 'literal' | 'number' | 'string';

export type EditorCodeToken = Readonly<{
  from: number;
  to: number;
  kind: EditorCodeTokenKind;
}>;

const editorCodeTokenPattern =
  /(\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b|\b(?:async|await|class|const|def|else|export|for|from|function|if|import|interface|let|new|private|public|return|static|type|var|while)\b)/g;
const editorCodeFencePattern = /^ {0,3}(`{3,}|~{3,})[ \t]*(\S*)?.*$/;

const editorCodeTokenKindFor = (value: string): EditorCodeTokenKind => {
  if (value.startsWith('//') || value.startsWith('#')) {
    return 'comment';
  }

  if (/^(true|false|null|undefined)$/.test(value)) {
    return 'literal';
  }

  if (/^\d/.test(value)) {
    return 'number';
  }

  if (/^["'`]/.test(value)) {
    return 'string';
  }

  return 'keyword';
};

/**
 * Finds lightweight code tokens only inside fenced Markdown code blocks. This
 * is deliberately parser-free so every fenced language gains a polished,
 * contrast-safe baseline without growing the editor bundle per language.
 */
export const codeTokensForMarkdown = (
  markdownSource: string,
): readonly EditorCodeToken[] => {
  const tokens: EditorCodeToken[] = [];
  let activeFence: string | null = null;
  let lineStart = 0;

  for (const line of markdownSource.split('\n')) {
    const fence = line.match(editorCodeFencePattern);

    if (activeFence !== null) {
      const isClosingFence =
        fence !== null &&
        fence[1] !== undefined &&
        fence[1][0] === activeFence[0] &&
        fence[1].length >= activeFence.length &&
        line.trim().slice(fence[1].length).length === 0;

      if (isClosingFence) {
        activeFence = null;
      } else {
        editorCodeTokenPattern.lastIndex = 0;
        let match = editorCodeTokenPattern.exec(line);

        while (match !== null) {
          const value = match[0];
          tokens.push(
            Object.freeze({
              from: lineStart + match.index,
              to: lineStart + match.index + value.length,
              kind: editorCodeTokenKindFor(value),
            }),
          );
          match = editorCodeTokenPattern.exec(line);
        }
      }
    } else if (fence !== null && fence[1] !== undefined) {
      activeFence = fence[1];
    }

    lineStart += line.length + 1;
  }

  return tokens;
};

const codeTokenDecorationFor = (kind: EditorCodeTokenKind): Decoration =>
  Decoration.mark({ class: `inknote-editor-token--${kind}` });

const codeTokenDecorationsFor = (document: string): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>();

  for (const token of codeTokensForMarkdown(document)) {
    builder.add(token.from, token.to, codeTokenDecorationFor(token.kind));
  }

  return builder.finish();
};

const editorCodeTokenHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = codeTokenDecorationsFor(view.state.doc.toString());
    }

    update(update: { docChanged: boolean; state: EditorState }): void {
      if (update.docChanged) {
        this.decorations = codeTokenDecorationsFor(update.state.doc.toString());
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

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
  sourceLineToReveal,
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
    let isDisposed = false;
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
      markdown(),
      editorCodeTokenHighlighter,
      markdownSelectionToolbar,
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
      onSourceLineChangeRef.current?.(sourceLine);
    };

    viewRef.current = view;
    view.scrollDOM.addEventListener('scroll', reportSourceLine, {
      passive: true,
    });

    // Vim is an enhancement, never a reason for the writing surface to fail.
    void import('@replit/codemirror-vim')
      .then(({ vim }) => {
        if (!isDisposed) {
          view.dispatch({ effects: StateEffect.appendConfig.of(vim()) });
        }

        return undefined;
      })
      .catch(() => undefined);

    return () => {
      isDisposed = true;
      view.scrollDOM.removeEventListener('scroll', reportSourceLine);
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

    if (view === null || sourceLineToReveal === undefined) {
      return;
    }

    const lineNumber = Math.min(
      Math.max(1, sourceLineToReveal),
      view.state.doc.lines,
    );
    const lineBlock = view.lineBlockAt(view.state.doc.line(lineNumber).from);
    const maximumScrollTop = Math.max(
      0,
      view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight,
    );
    const scrollTop = Math.min(Math.max(0, lineBlock.top), maximumScrollTop);

    if (Math.abs(view.scrollDOM.scrollTop - scrollTop) < 1) {
      return;
    }

    pendingSynchronizedScrollTop.current = scrollTop;
    view.scrollDOM.scrollTop = scrollTop;
  }, [sourceLineToReveal]);

  return <div ref={hostRef} className="markdown-editor" />;
}
