import {
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
});
