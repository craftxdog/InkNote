import {
  codeFenceMetadataFor,
  enhanceInkNoteMarkdownTree,
  preserveSafeInlineHtml,
  type MarkdownSyntaxTree,
} from '../../../renderer/features/preview/components/MarkdownPreview';
import {
  createNoteId,
  createRevision,
  type NoteDocument,
} from '../../../shared/documents/document.types';

describe('enhanceInkNoteMarkdownTree', () => {
  it('ships Markdown math parser and renderer extensions', () => {
    expect(require.resolve('remark-math')).toContain('remark-math');
    expect(require.resolve('rehype-katex')).toContain('rehype-katex');
  });

  it('turns supported callout markers and inline highlight syntax into semantic preview nodes', () => {
    const tree: MarkdownSyntaxTree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'blockquote',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'p',
              properties: {},
              children: [
                {
                  type: 'text',
                  value: '[!NOTE]\nShip the ==small and shippable== slice.',
                },
              ],
            },
          ],
        },
      ],
    };

    enhanceInkNoteMarkdownTree(tree);

    const callout = tree.children[0];
    expect(callout).toMatchObject({
      type: 'element',
      tagName: 'blockquote',
      properties: {
        className: ['inknote-callout', 'inknote-callout--note'],
        dataCallout: 'note',
      },
    });

    const calloutChildren = (callout as { children: MarkdownSyntaxTree[] })
      .children;
    expect(calloutChildren[0]).toMatchObject({
      type: 'element',
      tagName: 'strong',
      properties: { className: ['inknote-callout__label'] },
      children: [{ type: 'text', value: 'Note' }],
    });
    expect(calloutChildren[1]).toMatchObject({
      type: 'element',
      tagName: 'p',
      children: [
        { type: 'text', value: 'Ship the ' },
        {
          type: 'element',
          tagName: 'mark',
          children: [{ type: 'text', value: 'small and shippable' }],
        },
        { type: 'text', value: ' slice.' },
      ],
    });
  });

  it('leaves highlight delimiters untouched inside fenced code content', () => {
    const tree: MarkdownSyntaxTree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: {},
              children: [
                { type: 'text', value: 'const marker = "==not a mark==";' },
              ],
            },
          ],
        },
      ],
    };

    enhanceInkNoteMarkdownTree(tree);

    expect(tree.children[0]).toMatchObject({
      children: [
        {
          children: [
            { type: 'text', value: 'const marker = "==not a mark==";' },
          ],
        },
      ],
    });
  });

  it('keeps source line anchors on rendered blocks for scroll synchronization', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'h2',
          properties: {},
          position: {
            start: { line: 4 },
            end: { line: 4 },
          },
          children: [{ type: 'text', value: 'Config' }],
        },
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          position: {
            start: { line: 6 },
            end: { line: 13 },
          },
          children: [],
        },
      ],
    } as Extract<MarkdownSyntaxTree, { type: 'root' }>;

    enhanceInkNoteMarkdownTree(tree);

    expect(tree.children).toMatchObject([
      {
        properties: {
          dataSourceLine: 4,
          dataSourceEndLine: 4,
        },
      },
      {
        properties: {
          dataSourceLine: 6,
          dataSourceEndLine: 13,
        },
      },
    ]);
  });

  it('renders emoji shortcodes and semantic tokens in supported code blocks', () => {
    const tree: MarkdownSyntaxTree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: [{ type: 'text', value: 'Ship it :rocket:' }],
        },
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: { className: ['language-json'] },
              children: [
                {
                  type: 'text',
                  value: '{"enabled": true, "title": "InkNote"}',
                },
              ],
            },
          ],
        },
      ],
    };

    enhanceInkNoteMarkdownTree(tree);

    expect(tree.children[0]).toMatchObject({
      children: [{ type: 'text', value: 'Ship it 🚀' }],
    });
    expect(tree.children[1]).toMatchObject({
      properties: {
        className: ['inknote-code-block', 'codeblock'],
        dataLanguage: 'JSON',
      },
    });
    const codeBlock = tree.children[1] as Extract<
      MarkdownSyntaxTree,
      { type: 'element' }
    >;
    const code = codeBlock.children[0] as Extract<
      MarkdownSyntaxTree,
      { type: 'element' }
    >;

    expect(code.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'element',
          properties: {
            className: ['tok-property-name'],
          },
        }),
        expect.objectContaining({
          type: 'element',
          properties: {
            className: ['tok-bool'],
          },
        }),
      ]),
    );
  });

  it('uses the registered C++ grammar instead of a generic token regex', () => {
    const tree: MarkdownSyntaxTree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: { className: ['language-c++'] },
              children: [
                {
                  type: 'text',
                  value: '#include <iostream>\nint main() { return 42; }',
                },
              ],
            },
          ],
        },
      ],
    };

    enhanceInkNoteMarkdownTree(tree);

    const codeBlock = tree.children[0] as Extract<
      MarkdownSyntaxTree,
      { type: 'element' }
    >;
    const code = codeBlock.children[0] as Extract<
      MarkdownSyntaxTree,
      { type: 'element' }
    >;

    expect(tokenClassNamesFor(code)).toEqual(
      expect.arrayContaining(['tok-control-keyword', 'tok-number']),
    );
  });

  it('turns Mermaid fences into anchored component mounts instead of raw code blocks', () => {
    const tree: MarkdownSyntaxTree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          position: {
            start: { line: 7 },
            end: { line: 10 },
          },
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: { className: ['language-mermaid'] },
              children: [
                { type: 'text', value: 'sequenceDiagram\nAlice->>Bob: Hello' },
              ],
            },
          ],
        },
      ],
    };

    enhanceInkNoteMarkdownTree(tree);

    expect(tree.children[0]).toMatchObject({
      type: 'element',
      tagName: 'div',
      properties: {
        className: ['inknote-mermaid-mount'],
        dataMermaid: 'true',
        dataSourceLine: 7,
        dataSourceEndLine: 10,
      },
    });
  });

  it('keeps fenced-code titles and filenames for the preview header', () => {
    const metadataByLine = codeFenceMetadataFor(
      [
        'A short reference.',
        '',
        '```ts filename="postcss.ts" title="Use PostCSS API"',
        "import postcss from 'postcss'",
        '```',
      ].join('\n'),
    );
    const tree: MarkdownSyntaxTree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          position: {
            start: { line: 3 },
            end: { line: 5 },
          },
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: { className: ['language-ts'] },
              children: [
                { type: 'text', value: "import postcss from 'postcss'" },
              ],
            },
          ],
        },
      ],
    };

    enhanceInkNoteMarkdownTree(tree, metadataByLine);

    expect(metadataByLine.get(3)).toEqual({
      language: 'ts',
      filename: 'postcss.ts',
      title: 'Use PostCSS API',
    });
    expect(tree.children[0]).toMatchObject({
      properties: {
        dataLanguage: 'TS',
        dataCodeTitle: 'Use PostCSS API\npostcss.ts',
      },
    });
  });

  it('turns available internal-note links into accessible reference cards', () => {
    const noteId = createNoteId('linux-commands');
    const referencedDocument: NoteDocument = {
      id: noteId,
      title: 'Linux commands',
      body: '',
      notebookId: 'commands',
      status: 'active',
      tags: [],
      createdAt: '2026-10-23T15:00:00.000Z',
      updatedAt: '2026-10-23T15:00:00.000Z',
      revision: createRevision('local-1'),
      deletedAt: null,
    };
    const tree: MarkdownSyntaxTree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'a',
              properties: { href: 'inknote://note/linux-commands' },
              children: [{ type: 'text', value: 'Linux commands' }],
            },
          ],
        },
      ],
    };

    enhanceInkNoteMarkdownTree(
      tree,
      new Map(),
      new Map([[noteId, referencedDocument]]),
    );

    expect(tree.children[0]).toMatchObject({
      children: [
        {
          properties: {
            className: ['inknote-note-reference'],
            dataNoteId: noteId,
            ariaLabel: 'Open note Linux commands',
          },
        },
      ],
    });
  });

  it('adds a safe color swatch only for documented inline color models', () => {
    const tree: MarkdownSyntaxTree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: {},
              children: [{ type: 'text', value: 'rgb(9, 105, 218)' }],
            },
            {
              type: 'element',
              tagName: 'code',
              properties: {},
              children: [{ type: 'text', value: ' #0969DA ' }],
            },
          ],
        },
      ],
    };

    enhanceInkNoteMarkdownTree(tree);

    const paragraph = tree.children[0] as Extract<
      MarkdownSyntaxTree,
      { type: 'element' }
    >;
    expect(paragraph.children[0]).toMatchObject({
      properties: {
        className: ['inknote-color-model'],
        dataColorModel: 'rgb',
        style: '--inknote-color-swatch: rgb(9, 105, 218)',
      },
    });
    expect(paragraph.children[1]).toMatchObject({ properties: {} });
  });

  it('preserves only documented subscript and superscript tags before sanitization', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'text', value: 'H' },
        { type: 'html', value: '<sub>' },
        { type: 'text', value: '2' },
        { type: 'html', value: '</sub>' },
        { type: 'html', value: '<script>' },
      ],
    };

    preserveSafeInlineHtml()(tree);
    enhanceInkNoteMarkdownTree(tree as MarkdownSyntaxTree);

    expect(tree.children).toEqual([
      { type: 'text', value: 'H' },
      {
        type: 'element',
        tagName: 'sub',
        properties: {},
        children: [{ type: 'text', value: '2' }],
      },
      { type: 'html', value: '<script>' },
    ]);
  });
});

const tokenClassNamesFor = (node: MarkdownSyntaxTree): readonly string[] => {
  if (node.type === 'text') {
    return [];
  }

  const ownClassNames =
    node.type === 'element' && Array.isArray(node.properties.className)
      ? node.properties.className.filter(
          (className): className is string => typeof className === 'string',
        )
      : [];

  return [
    ...ownClassNames,
    ...node.children.flatMap((child) => tokenClassNamesFor(child)),
  ];
};
