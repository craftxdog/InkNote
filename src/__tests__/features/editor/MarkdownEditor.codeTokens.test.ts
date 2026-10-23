import { codeTokensForMarkdown } from '../../../renderer/features/editor/components/MarkdownEditor';

describe('codeTokensForMarkdown', () => {
  it('finds semantic tokens inside fenced code without touching prose', () => {
    const markdown = [
      'The number 42 remains prose.',
      '',
      '```ts',
      'const answer = 42; // computed',
      'const enabled = true;',
      '```',
    ].join('\n');

    const tokens = codeTokensForMarkdown(markdown);

    expect(tokens.map((token) => token.kind)).toEqual([
      'keyword',
      'number',
      'comment',
      'keyword',
      'literal',
    ]);
    expect(tokens.map(({ from, to }) => markdown.slice(from, to))).toEqual([
      'const',
      '42',
      '// computed',
      'const',
      'true',
    ]);
  });

  it('does not apply code colors after a matching closing fence', () => {
    const markdown = ['```python', 'def run():', '```', 'def prose():'].join(
      '\n',
    );

    expect(tokensWithText(markdown)).toEqual(['def']);
  });
});

const tokensWithText = (markdown: string): readonly string[] =>
  codeTokensForMarkdown(markdown).map(({ from, to }) =>
    markdown.slice(from, to),
  );
