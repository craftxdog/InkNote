export type MarkdownSelection = Readonly<{
  from: number;
  to: number;
}>;

export type MarkdownTransformation = Readonly<{
  text: string;
  selection: MarkdownSelection;
}>;

export type SlashCommandId =
  | 'blockquote'
  | 'bullet-list'
  | 'code-block'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'horizontal-rule'
  | 'image'
  | 'inline-code'
  | 'numbered-list'
  | 'task-list';

export type MarkdownFormatId =
  | 'blockquote'
  | 'bold'
  | 'bullet-list'
  | 'code-block'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'inline-code'
  | 'italic'
  | 'link'
  | 'numbered-list'
  | 'strikethrough'
  | 'task-list';

export type SlashCommand = Readonly<{
  id: SlashCommandId;
  label: string;
  keywords: readonly string[];
}>;

export type SlashQuery = Readonly<{
  from: number;
  query: string;
}>;

const slashCommands: readonly SlashCommand[] = Object.freeze([
  {
    id: 'blockquote',
    label: 'Blockquote',
    keywords: ['quote', 'callout'],
  },
  {
    id: 'code-block',
    label: 'Code block',
    keywords: ['code', 'fence', 'snippet'],
  },
  {
    id: 'heading-1',
    label: 'Heading 1',
    keywords: ['heading', 'title', 'h1'],
  },
  {
    id: 'heading-2',
    label: 'Heading 2',
    keywords: ['heading', 'subtitle', 'h2'],
  },
  {
    id: 'heading-3',
    label: 'Heading 3',
    keywords: ['heading', 'h3'],
  },
  {
    id: 'horizontal-rule',
    label: 'Horizontal rule',
    keywords: ['divider', 'separator', 'rule'],
  },
  {
    id: 'image',
    label: 'Image',
    keywords: ['picture', 'media'],
  },
  {
    id: 'inline-code',
    label: 'Inline code',
    keywords: ['code', 'monospace'],
  },
  {
    id: 'bullet-list',
    label: 'Bulleted list',
    keywords: ['list', 'unordered', 'bullet'],
  },
  {
    id: 'numbered-list',
    label: 'Numbered list',
    keywords: ['list', 'ordered', 'number'],
  },
  {
    id: 'task-list',
    label: 'Task list',
    keywords: ['todo', 'checklist', 'list'],
  },
]);

const normalizedSelection = (
  source: string,
  selection: MarkdownSelection,
): MarkdownSelection => ({
  from: Math.max(0, Math.min(selection.from, selection.to, source.length)),
  to: Math.max(
    0,
    Math.min(Math.max(selection.from, selection.to), source.length),
  ),
});

const replaceSelection = (
  source: string,
  selection: MarkdownSelection,
  replacement: string,
  nextSelection: MarkdownSelection,
): MarkdownTransformation => ({
  text: `${source.slice(0, selection.from)}${replacement}${source.slice(selection.to)}`,
  selection: nextSelection,
});

const wrapSelection = (
  source: string,
  selection: MarkdownSelection,
  opening: string,
  closing: string,
  placeholder = 'text',
): MarkdownTransformation => {
  const selected = source.slice(selection.from, selection.to);
  const content = selected.length === 0 ? placeholder : selected;
  const contentStart = selection.from + opening.length;

  return replaceSelection(source, selection, `${opening}${content}${closing}`, {
    from: contentStart,
    to: contentStart + content.length,
  });
};

const lineRangeFor = (
  source: string,
  selection: MarkdownSelection,
): MarkdownSelection => {
  const from = source.lastIndexOf('\n', Math.max(0, selection.from - 1)) + 1;
  const selectedEnd = Math.max(selection.from, selection.to - 1);
  const lineBreak = source.indexOf('\n', selectedEnd);

  return {
    from,
    to: lineBreak === -1 ? source.length : lineBreak,
  };
};

const prefixLines = (
  source: string,
  selection: MarkdownSelection,
  prefixForLine: (index: number) => string,
  removePrefix: RegExp,
): MarkdownTransformation => {
  const lineRange = lineRangeFor(source, selection);
  const lines = source.slice(lineRange.from, lineRange.to).split('\n');
  const replacement = lines
    .map(
      (line, index) =>
        `${prefixForLine(index)}${line.replace(removePrefix, '')}`,
    )
    .join('\n');
  const firstPrefixLength = prefixForLine(0).length;

  return replaceSelection(source, lineRange, replacement, {
    from: lineRange.from + firstPrefixLength,
    to: lineRange.from + replacement.length,
  });
};

const fencedCodeBlock = (
  source: string,
  selection: MarkdownSelection,
): MarkdownTransformation => {
  const selected = source.slice(selection.from, selection.to);
  const content = selected.length === 0 ? '' : selected;
  const replacement = `\`\`\`\n${content}\n\`\`\``;
  const contentStart = selection.from + 4;

  return replaceSelection(source, selection, replacement, {
    from: contentStart,
    to: contentStart + content.length,
  });
};

const linkSelection = (
  source: string,
  selection: MarkdownSelection,
): MarkdownTransformation => {
  const selected = source.slice(selection.from, selection.to) || 'link text';
  const replacement = `[${selected}](url)`;
  const urlStart = selection.from + selected.length + 3;

  return replaceSelection(source, selection, replacement, {
    from: urlStart,
    to: urlStart + 3,
  });
};

const image = (source: string, selection: MarkdownSelection) => {
  const selected = source.slice(selection.from, selection.to) || 'alt text';
  const replacement = `![${selected}](url)`;
  const urlStart = selection.from + selected.length + 4;

  return replaceSelection(source, selection, replacement, {
    from: urlStart,
    to: urlStart + 3,
  });
};

export const slashCommandsFor = (query: string): readonly SlashCommand[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (normalizedQuery.length === 0) {
    return slashCommands;
  }

  return slashCommands.filter((command) =>
    [command.label, ...command.keywords].some((candidate) =>
      candidate.toLocaleLowerCase().includes(normalizedQuery),
    ),
  );
};

/**
 * Finds an unfinished slash command on a single editor line. Commands start
 * only at the beginning of a line or after whitespace so URLs remain ordinary
 * Markdown text rather than unexpectedly opening an authoring menu.
 */
export const slashQueryForLine = (
  line: string,
  cursor: number,
): SlashQuery | null => {
  const textBeforeCursor = line.slice(0, Math.max(0, cursor));
  const match = textBeforeCursor.match(/(?:^|\s)\/([a-z0-9 -]*)$/i);

  if (match === null || match.index === undefined) {
    return null;
  }

  return {
    from: match.index + match[0].lastIndexOf('/'),
    query: match[1] ?? '',
  };
};

export const applyMarkdownFormat = (
  source: string,
  initialSelection: MarkdownSelection,
  command: MarkdownFormatId,
): MarkdownTransformation => {
  const selection = normalizedSelection(source, initialSelection);

  switch (command) {
    case 'bold':
      return wrapSelection(source, selection, '**', '**');
    case 'italic':
      return wrapSelection(source, selection, '*', '*');
    case 'strikethrough':
      return wrapSelection(source, selection, '~~', '~~');
    case 'inline-code':
      return wrapSelection(source, selection, '`', '`');
    case 'link':
      return linkSelection(source, selection);
    case 'code-block':
      return fencedCodeBlock(source, selection);
    case 'heading-1':
      return prefixLines(source, selection, () => '# ', /^ {0,3}#{1,6}\s*/);
    case 'heading-2':
      return prefixLines(source, selection, () => '## ', /^ {0,3}#{1,6}\s*/);
    case 'heading-3':
      return prefixLines(source, selection, () => '### ', /^ {0,3}#{1,6}\s*/);
    case 'blockquote':
      return prefixLines(source, selection, () => '> ', /^ {0,3}>\s?/);
    case 'bullet-list':
      return prefixLines(source, selection, () => '- ', /^\s*[-*+]\s+/);
    case 'numbered-list':
      return prefixLines(
        source,
        selection,
        (index) => `${index + 1}. `,
        /^\s*\d+[.)]\s+/,
      );
    case 'task-list':
      return prefixLines(
        source,
        selection,
        () => '- [ ] ',
        /^\s*[-*+]\s+\[[ xX]\]\s+/,
      );
  }
};

export const applySlashCommand = (
  source: string,
  selection: MarkdownSelection,
  command: SlashCommandId,
): MarkdownTransformation => {
  const normalized = normalizedSelection(source, selection);

  switch (command) {
    case 'blockquote':
      return replaceSelection(source, normalized, '> ', {
        from: normalized.from + 2,
        to: normalized.from + 2,
      });
    case 'bullet-list':
      return replaceSelection(source, normalized, '- ', {
        from: normalized.from + 2,
        to: normalized.from + 2,
      });
    case 'heading-1':
      return replaceSelection(source, normalized, '# ', {
        from: normalized.from + 2,
        to: normalized.from + 2,
      });
    case 'heading-2':
      return replaceSelection(source, normalized, '## ', {
        from: normalized.from + 3,
        to: normalized.from + 3,
      });
    case 'heading-3':
      return replaceSelection(source, normalized, '### ', {
        from: normalized.from + 4,
        to: normalized.from + 4,
      });
    case 'horizontal-rule':
      return replaceSelection(source, normalized, '---', {
        from: normalized.from + 3,
        to: normalized.from + 3,
      });
    case 'image':
      return image(source, normalized);
    case 'inline-code':
      return wrapSelection(source, normalized, '`', '`', 'code');
    case 'numbered-list':
      return replaceSelection(source, normalized, '1. ', {
        from: normalized.from + 3,
        to: normalized.from + 3,
      });
    case 'task-list':
      return replaceSelection(source, normalized, '- [ ] ', {
        from: normalized.from + 6,
        to: normalized.from + 6,
      });
    case 'code-block':
      return fencedCodeBlock(source, normalized);
  }
};
