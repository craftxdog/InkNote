import { insertNewlineAndIndent } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { highlightTree } from '@lezer/highlight';

import { codeLanguageDescriptionForFence } from '../../../renderer/features/markdown/model/codeLanguages';
import { inkdropSyntaxHighlighter } from '../../../renderer/features/markdown/model/inkdropSyntaxHighlighter';

const markdownWithRegisteredCodeLanguages = () =>
  markdown({ codeLanguages: codeLanguageDescriptionForFence });

const tokenClassesFor = (state: EditorState): readonly string[] => {
  const classes: string[] = [];

  highlightTree(
    syntaxTree(state),
    inkdropSyntaxHighlighter,
    (_from, _to, value) => {
      classes.push(...value.split(/\s+/).filter(Boolean));
    },
  );

  return classes;
};

describe('MarkdownEditor fenced languages', () => {
  it('parses TypeScript inside a fence with the shared Inkdrop token contract', () => {
    const state = EditorState.create({
      doc: [
        '```typescript filename="example.ts"',
        'const answer: number = 42;',
        '```',
      ].join('\n'),
      extensions: [markdownWithRegisteredCodeLanguages()],
    });

    expect(tokenClassesFor(state)).toEqual(
      expect.arrayContaining([
        'tok-definition-keyword',
        'tok-type-name',
        'tok-number',
      ]),
    );
  });

  it('indents a new line according to the fenced TypeScript grammar', () => {
    let state = EditorState.create({
      doc: ['```ts', 'if (ready) {'].join('\n'),
      selection: { anchor: '```ts\nif (ready) {'.length },
      extensions: [markdownWithRegisteredCodeLanguages()],
    });

    const inserted = insertNewlineAndIndent({
      state,
      dispatch: (transaction) => {
        state = transaction.state;
      },
    });

    expect(inserted).toBe(true);
    expect(state.doc.toString()).toBe('```ts\nif (ready) {\n  ');
  });
});
