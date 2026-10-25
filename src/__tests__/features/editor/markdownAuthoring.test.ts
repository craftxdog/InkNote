import {
  applyMarkdownLink,
  applyMarkdownFormat,
  applySlashCommand,
  slashQueryForLine,
  slashCommandsFor,
} from '../../../renderer/features/editor/model/markdownAuthoring';

describe('Markdown authoring commands', () => {
  it('filters slash commands and inserts a fenced code block at the cursor', () => {
    expect(slashCommandsFor('code')).toEqual([
      expect.objectContaining({ id: 'code-block', label: 'Code block' }),
      expect.objectContaining({ id: 'inline-code', label: 'Inline code' }),
    ]);

    expect(applySlashCommand('', { from: 0, to: 1 }, 'code-block')).toEqual({
      text: '```\n\n```',
      selection: { from: 4, to: 4 },
    });

    expect(
      applySlashCommand('/heading', { from: 0, to: 8 }, 'heading-2'),
    ).toEqual({
      text: '## ',
      selection: { from: 3, to: 3 },
    });
  });

  it('opens slash authoring only after whitespace, never inside a URL', () => {
    expect(slashQueryForLine('  /head', 7)).toEqual({
      from: 2,
      query: 'head',
    });
    expect(slashQueryForLine('https://docs.example', 20)).toBeNull();
  });

  it('wraps the selected text for inline formatting and leaves it selected', () => {
    expect(
      applyMarkdownFormat('Ship this today', { from: 5, to: 9 }, 'bold'),
    ).toEqual({
      text: 'Ship **this** today',
      selection: { from: 7, to: 11 },
    });

    expect(
      applyMarkdownFormat('Ship this today', { from: 5, to: 9 }, 'link'),
    ).toEqual({
      text: 'Ship [this](url) today',
      selection: { from: 12, to: 15 },
    });
  });

  it('converts every selected line into the requested Markdown block', () => {
    expect(
      applyMarkdownFormat('alpha\nbeta', { from: 0, to: 10 }, 'task-list'),
    ).toEqual({
      text: '- [ ] alpha\n- [ ] beta',
      selection: { from: 6, to: 22 },
    });

    expect(
      applyMarkdownFormat('draft', { from: 0, to: 5 }, 'heading-1'),
    ).toEqual({
      text: '# draft',
      selection: { from: 2, to: 7 },
    });
  });

  it('offers all six documented heading levels from the slash menu', () => {
    expect(slashCommandsFor('heading')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'heading-4', label: 'Heading 4' }),
        expect.objectContaining({ id: 'heading-5', label: 'Heading 5' }),
        expect.objectContaining({ id: 'heading-6', label: 'Heading 6' }),
      ]),
    );

    expect(applySlashCommand('', { from: 0, to: 0 }, 'heading-6')).toEqual({
      text: '###### ',
      selection: { from: 7, to: 7 },
    });
  });

  it('toggles a blockquote across each selected source line', () => {
    const quoted = applyMarkdownFormat(
      'first\nsecond',
      { from: 0, to: 12 },
      'blockquote',
    );

    expect(quoted).toEqual({
      text: '> first\n> second',
      selection: { from: 2, to: 16 },
    });
    expect(
      applyMarkdownFormat(
        quoted.text,
        { from: 0, to: quoted.text.length },
        'blockquote',
      ),
    ).toEqual({
      text: 'first\nsecond',
      selection: { from: 0, to: 12 },
    });
  });

  it('turns a pasted supported URL into a Markdown link for the selected text', () => {
    expect(
      applyMarkdownLink(
        'Read the Inkdrop manual',
        { from: 9, to: 16 },
        'https://docs.inkdrop.app/',
      ),
    ).toEqual({
      text: 'Read the [Inkdrop](https://docs.inkdrop.app/) manual',
      selection: { from: 19, to: 44 },
    });

    expect(
      applyMarkdownLink('Keep this', { from: 0, to: 4 }, 'not a URL'),
    ).toBeNull();
  });
});
