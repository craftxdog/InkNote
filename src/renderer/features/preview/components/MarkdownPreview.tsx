import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';

import {
  previewScrollTopForSourceLine,
  sourceScrollPositionFor,
  sourceLineForPreviewScroll,
  type SourceScrollAnchor,
  type SourceScrollPosition,
} from '../../markdown/model/scrollSynchronization';
import { createPreviewScrollRenderGuard } from '../../markdown/model/previewScrollRenderGuard';
import { replaceEmojiShortcodes } from '../../markdown/model/emojiCompletions';
import { parseNoteReference } from '../../references/model/noteReferences';
import { renderMermaidDiagrams } from '../mermaidPresentation';
import type {
  NoteDocument,
  NoteId,
} from '../../../../shared/documents/document.types';

type MarkdownPreviewProps = {
  markdown: string;
  themeRevision?: string;
  referenceDocuments?: readonly NoteDocument[];
  onOpenReference?: (documentId: NoteId) => void;
  onSourceLineChange?: (position: SourceScrollPosition) => void;
  sourceScrollPositionToReveal?: SourceScrollPosition;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
};

type MarkdownTextNode = {
  type: 'text';
  value: string;
};

type MarkdownPosition = {
  start?: { line?: number };
  end?: { line?: number };
};

type MarkdownElementNode = {
  type: 'element';
  tagName: string;
  properties: Record<string, unknown>;
  children: MarkdownSyntaxTree[];
  position?: MarkdownPosition;
};

type MarkdownRootNode = {
  type: 'root';
  children: MarkdownSyntaxTree[];
  position?: MarkdownPosition;
};

export type MarkdownSyntaxTree =
  MarkdownElementNode | MarkdownRootNode | MarkdownTextNode;

export type CodeFenceMetadata = Readonly<{
  language: string;
  filename?: string;
  title?: string;
}>;

type CodeFenceMetadataByLine = ReadonlyMap<number, CodeFenceMetadata>;

type InlineHtmlTagName = 'sub' | 'sup';

type InlineHtmlToken = Readonly<{
  kind: 'open' | 'close';
  tagName: InlineHtmlTagName;
  value: string;
}>;

const calloutLabels = {
  caution: 'Caution',
  important: 'Important',
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
} as const;

type CalloutKind = keyof typeof calloutLabels;

const calloutMarkerPattern =
  /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n)?/i;
const inlineHighlightPattern = /==(?=\S)([^=\n]*?\S)==/g;
const protectedInlineTags = new Set([
  'code',
  'pre',
  'script',
  'style',
  'textarea',
]);
const sourceAnchoredTags = new Set([
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'p',
  'pre',
  'table',
]);
const codeLanguagesWithPresentation = new Set([
  'bash',
  'javascript',
  'js',
  'json',
  'jsx',
  'sh',
  'ts',
  'tsx',
  'typescript',
]);
const codeTokenPattern =
  /(\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b|\b(?:async|await|class|const|def|else|export|for|from|function|if|import|interface|let|new|private|public|return|static|type|var|while)\b)/g;
const codeFencePattern = /^ {0,3}(`{3,}|~{3,})[ \t]*(.*?)\s*$/;
const codeFenceAttributePattern =
  /\b(filename|title)=(?:"([^"]*)"|'([^']*)')/gi;
const inlineHtmlTokens: readonly InlineHtmlToken[] = [
  { kind: 'open', tagName: 'sub', value: '\uE000inknote-sub-open\uE001' },
  { kind: 'close', tagName: 'sub', value: '\uE000inknote-sub-close\uE001' },
  { kind: 'open', tagName: 'sup', value: '\uE000inknote-sup-open\uE001' },
  { kind: 'close', tagName: 'sup', value: '\uE000inknote-sup-close\uE001' },
];
const inlineHtmlTokenPattern = new RegExp(
  inlineHtmlTokens.map(({ value }) => value).join('|'),
  'g',
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isMarkdownAstContainer = (
  node: unknown,
): node is { children: unknown[] } =>
  isRecord(node) && Array.isArray(node.children);

const inlineHtmlTokenFor = (value: string): InlineHtmlToken | null => {
  const normalized = value.toLocaleLowerCase();

  switch (normalized) {
    case '<sub>':
      return inlineHtmlTokens[0] ?? null;
    case '</sub>':
      return inlineHtmlTokens[1] ?? null;
    case '<sup>':
      return inlineHtmlTokens[2] ?? null;
    case '</sup>':
      return inlineHtmlTokens[3] ?? null;
    default:
      return null;
  }
};

/**
 * Preserve only the two inline HTML tags documented by Inkdrop. Raw HTML is
 * otherwise still discarded by remark-rehype and rehype-sanitize, so enabling
 * subscript and superscript does not widen the preview's script/style surface.
 */
export const preserveSafeInlineHtml =
  () =>
  (tree: unknown): void => {
    const visit = (node: unknown): void => {
      if (!isMarkdownAstContainer(node)) {
        return;
      }

      node.children = node.children.map((child) => {
        if (
          isRecord(child) &&
          child.type === 'html' &&
          typeof child.value === 'string'
        ) {
          const token = inlineHtmlTokenFor(child.value);

          if (token !== null) {
            return { type: 'text', value: token.value };
          }
        }

        visit(child);
        return child;
      });
    };

    visit(tree);
  };

/**
 * Reads display metadata from a fenced-code info string. We keep it separate
 * from the Markdown body, then reconnect it to the sanitized <pre> by line.
 */
export const codeFenceMetadataFor = (
  markdown: string,
): ReadonlyMap<number, CodeFenceMetadata> => {
  const metadataByLine = new Map<number, CodeFenceMetadata>();
  let openFence: string | null = null;

  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const fence = line.match(codeFencePattern);

    if (openFence !== null) {
      if (
        fence !== null &&
        fence[2]?.trim().length === 0 &&
        fence[1]?.[0] === openFence[0] &&
        fence[1].length >= openFence.length
      ) {
        openFence = null;
      }

      continue;
    }

    if (fence === null) {
      continue;
    }

    const marker = fence[1];
    const info = fence[2]?.trim() ?? '';

    if (marker === undefined || info.length === 0) {
      openFence = marker ?? null;
      continue;
    }

    const [language = ''] = info.split(/\s+/, 1);

    if (language.length > 0) {
      const attributes = Object.fromEntries(
        [...info.matchAll(codeFenceAttributePattern)].flatMap((match) => {
          const key = match[1]?.toLocaleLowerCase();
          const value = match[2] ?? match[3];

          return key === undefined || value === undefined ? [] : [[key, value]];
        }),
      );
      const filename = attributes.filename;
      const title = attributes.title;

      metadataByLine.set(index + 1, {
        language,
        ...(filename === undefined ? {} : { filename }),
        ...(title === undefined ? {} : { title }),
      });
    }

    openFence = marker;
  }

  return metadataByLine;
};

const isSyntaxContainer = (
  node: unknown,
): node is MarkdownElementNode | MarkdownRootNode =>
  isRecord(node) &&
  (node.type === 'root' || node.type === 'element') &&
  Array.isArray(node.children);

const isElement = (node: MarkdownSyntaxTree): node is MarkdownElementNode =>
  node.type === 'element';

const isText = (node: MarkdownSyntaxTree): node is MarkdownTextNode =>
  node.type === 'text';

const asClassNames = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (className): className is string => typeof className === 'string',
    );
  }

  return typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : [];
};

const withClassName = (
  properties: Record<string, unknown>,
  className: string,
): Record<string, unknown> => ({
  ...properties,
  className: [...new Set([...asClassNames(properties.className), className])],
});

const findFirstTextNode = (
  node: MarkdownSyntaxTree,
): MarkdownTextNode | null => {
  if (isText(node)) {
    return node;
  }

  if (isSyntaxContainer(node)) {
    for (const child of node.children) {
      const text = findFirstTextNode(child);

      if (text !== null) {
        return text;
      }
    }
  }

  return null;
};

const createTextNode = (value: string): MarkdownTextNode => ({
  type: 'text',
  value,
});

const createHighlightNode = (value: string): MarkdownElementNode => ({
  type: 'element',
  tagName: 'mark',
  properties: {},
  children: [createTextNode(value)],
});

const createInlineHtmlNode = (
  tagName: InlineHtmlTagName,
  children: MarkdownSyntaxTree[],
): MarkdownElementNode => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});

const createCodeTokenNode = (
  value: string,
  tokenKind: 'comment' | 'keyword' | 'literal' | 'number' | 'string',
): MarkdownElementNode => ({
  type: 'element',
  tagName: 'span',
  properties: {
    className: ['inknote-code-token', `inknote-code-token--${tokenKind}`],
  },
  children: [createTextNode(value)],
});

const codeTokenKindFor = (
  value: string,
): 'comment' | 'keyword' | 'literal' | 'number' | 'string' => {
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

const enhanceCodeTokens = (text: MarkdownTextNode): MarkdownSyntaxTree[] => {
  codeTokenPattern.lastIndex = 0;
  let match = codeTokenPattern.exec(text.value);

  if (match === null) {
    return [text];
  }

  const nodes: MarkdownSyntaxTree[] = [];
  let offset = 0;

  while (match !== null) {
    const token = match[0];

    if (match.index > offset) {
      nodes.push(createTextNode(text.value.slice(offset, match.index)));
    }

    nodes.push(createCodeTokenNode(token, codeTokenKindFor(token)));
    offset = match.index + token.length;
    match = codeTokenPattern.exec(text.value);
  }

  if (offset < text.value.length) {
    nodes.push(createTextNode(text.value.slice(offset)));
  }

  return nodes;
};

const enhanceInlineHighlights = (
  text: MarkdownTextNode,
): MarkdownSyntaxTree[] => {
  text.value = replaceEmojiShortcodes(text.value);
  inlineHighlightPattern.lastIndex = 0;
  let match = inlineHighlightPattern.exec(text.value);

  if (match === null) {
    return [text];
  }

  const nodes: MarkdownSyntaxTree[] = [];
  let offset = 0;

  while (match !== null) {
    if (match.index > offset) {
      nodes.push(createTextNode(text.value.slice(offset, match.index)));
    }

    nodes.push(createHighlightNode(match[1]));
    offset = match.index + match[0].length;
    match = inlineHighlightPattern.exec(text.value);
  }

  if (offset < text.value.length) {
    nodes.push(createTextNode(text.value.slice(offset)));
  }

  return nodes;
};

type InlineColorModel = 'hex' | 'hsl' | 'rgb';

const colorValueForInlineCode = (
  value: string,
): Readonly<{ model: InlineColorModel; value: string }> | null => {
  if (value.length === 0 || value.trim() !== value) {
    return null;
  }

  if (/^#[\da-f]{6}$/i.test(value)) {
    return { model: 'hex', value };
  }

  const rgb = value.match(
    /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i,
  );

  if (rgb !== null && rgb.slice(1).every((part) => Number(part) <= 255)) {
    return { model: 'rgb', value };
  }

  const hsl = value.match(
    /^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/i,
  );

  if (
    hsl !== null &&
    Number(hsl[1]) <= 360 &&
    Number(hsl[2]) <= 100 &&
    Number(hsl[3]) <= 100
  ) {
    return { model: 'hsl', value };
  }

  return null;
};

const decorateInlineColorCode = (code: MarkdownElementNode): void => {
  if (code.children.length !== 1 || !isText(code.children[0])) {
    return;
  }

  const color = colorValueForInlineCode(code.children[0].value);

  if (color === null) {
    return;
  }

  code.properties = {
    ...withClassName(code.properties, 'inknote-color-model'),
    dataColorModel: color.model,
    style: `--inknote-color-swatch: ${color.value}`,
  };
};

const restoreSafeInlineHtml = (
  parent: MarkdownElementNode | MarkdownRootNode,
): void => {
  const children: MarkdownSyntaxTree[] = [];
  const openTags: Array<{
    tagName: InlineHtmlTagName;
    children: MarkdownSyntaxTree[];
  }> = [];
  const append = (child: MarkdownSyntaxTree): void => {
    const current = openTags.at(-1);

    if (current === undefined) {
      children.push(child);
    } else {
      current.children.push(child);
    }
  };

  const appendText = (value: string): void => {
    if (value.length > 0) {
      append(createTextNode(value));
    }
  };

  for (const child of parent.children) {
    if (!isText(child)) {
      append(child);
      continue;
    }

    inlineHtmlTokenPattern.lastIndex = 0;
    let offset = 0;
    let match = inlineHtmlTokenPattern.exec(child.value);

    while (match !== null) {
      const matchedValue = match[0];
      const matchedIndex = match.index;

      appendText(child.value.slice(offset, matchedIndex));
      const token = inlineHtmlTokens.find(
        ({ value }) => value === matchedValue,
      );

      if (token === undefined) {
        appendText(matchedValue);
      } else if (token.kind === 'open') {
        openTags.push({ tagName: token.tagName, children: [] });
      } else {
        const openTag = openTags.at(-1);

        if (openTag?.tagName === token.tagName) {
          openTags.pop();
          append(createInlineHtmlNode(openTag.tagName, openTag.children));
        } else {
          appendText(token.tagName === 'sub' ? '</sub>' : '</sup>');
        }
      }

      offset = matchedIndex + matchedValue.length;
      match = inlineHtmlTokenPattern.exec(child.value);
    }

    appendText(child.value.slice(offset));
  }

  while (openTags.length > 0) {
    const openTag = openTags.pop();

    if (openTag !== undefined) {
      append(createInlineHtmlNode(openTag.tagName, openTag.children));
    }
  }

  parent.children = children;
};

const decorateCallout = (blockquote: MarkdownElementNode): void => {
  const firstText = findFirstTextNode(blockquote);
  const marker = firstText?.value.match(calloutMarkerPattern);

  if (firstText === null || marker === null || marker === undefined) {
    return;
  }

  const rawKind = marker[1];
  const rawMarker = marker[0];

  if (rawKind === undefined || rawMarker === undefined) {
    return;
  }

  const kind = rawKind.toLowerCase() as CalloutKind;
  firstText.value = firstText.value.slice(rawMarker.length);
  const classNames = [
    ...asClassNames(blockquote.properties.className),
    'inknote-callout',
    `inknote-callout--${kind}`,
  ];
  blockquote.properties = {
    ...blockquote.properties,
    className: [...new Set(classNames)],
    dataCallout: kind,
    'aria-label': `${calloutLabels[kind]} callout`,
  };
  blockquote.children.unshift({
    type: 'element',
    tagName: 'strong',
    properties: { className: ['inknote-callout__label'] },
    children: [createTextNode(calloutLabels[kind])],
  });
};

const decorateCodeBlock = (
  pre: MarkdownElementNode,
  codeFenceMetadataByLine: CodeFenceMetadataByLine,
): void => {
  const code = pre.children.find(
    (child): child is MarkdownElementNode =>
      isElement(child) && child.tagName === 'code',
  );

  if (code === undefined) {
    return;
  }

  const languageClass = asClassNames(code.properties.className).find(
    (className) => className.startsWith('language-'),
  );
  const metadata =
    pre.position?.start?.line === undefined
      ? undefined
      : codeFenceMetadataByLine.get(pre.position.start.line);
  const language =
    languageClass?.slice('language-'.length).trim() ?? metadata?.language;

  if (language === undefined || language.length === 0) {
    return;
  }

  pre.properties = {
    ...withClassName(pre.properties, 'inknote-code-block'),
    dataLanguage: language.toUpperCase(),
    ...(metadata?.title === undefined && metadata?.filename === undefined
      ? {}
      : {
          dataCodeTitle: [metadata.title, metadata.filename]
            .filter((part): part is string => part !== undefined)
            .join('\n'),
        }),
  };

  if (!codeLanguagesWithPresentation.has(language.toLocaleLowerCase())) {
    return;
  }

  code.children = code.children.flatMap((child) =>
    isText(child) ? enhanceCodeTokens(child) : [child],
  );
};

const decorateSourceAnchor = (element: MarkdownElementNode): void => {
  if (!sourceAnchoredTags.has(element.tagName)) {
    return;
  }

  const startLine = element.position?.start?.line;
  const endLine = element.position?.end?.line;

  if (
    startLine === undefined ||
    endLine === undefined ||
    startLine < 1 ||
    endLine < startLine
  ) {
    return;
  }

  element.properties = {
    ...element.properties,
    dataSourceLine: startLine,
    dataSourceEndLine: endLine,
  };
};

const decorateNoteReference = (
  anchor: MarkdownElementNode,
  referenceDocumentsById: ReadonlyMap<NoteId, NoteDocument>,
): void => {
  if (anchor.tagName !== 'a' || typeof anchor.properties.href !== 'string') {
    return;
  }

  const noteId = parseNoteReference(anchor.properties.href);

  if (noteId === null) {
    return;
  }

  const referencedDocument = referenceDocumentsById.get(noteId);
  const properties = withClassName(anchor.properties, 'inknote-note-reference');

  if (referencedDocument === undefined) {
    const withoutHref = { ...properties };
    delete withoutHref.href;
    anchor.properties = {
      ...withClassName(withoutHref, 'inknote-note-reference--unavailable'),
      dataNoteId: noteId,
      ariaDisabled: 'true',
      tabIndex: -1,
    };
    return;
  }

  anchor.properties = {
    ...properties,
    dataNoteId: noteId,
    ariaLabel: `Open note ${referencedDocument.title}`,
  };
};

const enhanceChildren = (
  parent: MarkdownElementNode | MarkdownRootNode,
  isProtected: boolean,
  codeFenceMetadataByLine: CodeFenceMetadataByLine,
  referenceDocumentsById: ReadonlyMap<NoteId, NoteDocument>,
): void => {
  restoreSafeInlineHtml(parent);

  parent.children = parent.children.flatMap((child) => {
    if (isText(child)) {
      return isProtected ? [child] : enhanceInlineHighlights(child);
    }

    if (!isElement(child)) {
      return [child];
    }

    decorateSourceAnchor(child);

    if (child.tagName === 'blockquote') {
      decorateCallout(child);
    }

    if (child.tagName === 'pre') {
      decorateCodeBlock(child, codeFenceMetadataByLine);
    }

    if (
      child.tagName === 'code' &&
      (!isElement(parent) || parent.tagName !== 'pre')
    ) {
      decorateInlineColorCode(child);
    }

    decorateNoteReference(child, referenceDocumentsById);

    enhanceChildren(
      child,
      isProtected || protectedInlineTags.has(child.tagName),
      codeFenceMetadataByLine,
      referenceDocumentsById,
    );

    return [child];
  });
};

/**
 * Adds only presentation nodes to an already-sanitized Markdown syntax tree.
 * User-authored HTML never reaches this step, so generated callout and mark
 * elements remain safe while keeping standard GFM output intact.
 */
export const enhanceInkNoteMarkdownTree = (
  tree: MarkdownSyntaxTree,
  codeFenceMetadataByLine: CodeFenceMetadataByLine = new Map(),
  referenceDocumentsById: ReadonlyMap<NoteId, NoteDocument> = new Map(),
): void => {
  if (!isSyntaxContainer(tree)) {
    return;
  }

  enhanceChildren(tree, false, codeFenceMetadataByLine, referenceDocumentsById);
};

const sourceScrollAnchorsFor = (
  container: HTMLElement,
): readonly SourceScrollAnchor[] => {
  const containerRect = container.getBoundingClientRect();

  return [...container.querySelectorAll<HTMLElement>('[data-source-line]')]
    .flatMap((element): SourceScrollAnchor[] => {
      const startLine = Number(element.dataset.sourceLine);
      const endLine = Number(element.dataset.sourceEndLine);

      if (
        !Number.isInteger(startLine) ||
        !Number.isInteger(endLine) ||
        startLine < 1 ||
        endLine < startLine
      ) {
        return [];
      }

      const rect = element.getBoundingClientRect();

      return [
        {
          startLine,
          endLine,
          top: rect.top - containerRect.top + container.scrollTop,
          height: Math.max(rect.height, 1),
        },
      ];
    })
    .sort((left, right) => left.top - right.top);
};

const inkNoteMarkdownPresentation =
  (
    codeFenceMetadataByLine: CodeFenceMetadataByLine,
    referenceDocumentsById: ReadonlyMap<NoteId, NoteDocument>,
  ) =>
  () =>
  (tree: unknown): void => {
    if (isSyntaxContainer(tree)) {
      enhanceInkNoteMarkdownTree(
        tree,
        codeFenceMetadataByLine,
        referenceDocumentsById,
      );
    }
  };

/**
 * Builds InkNote's Markdown preview from the same remark → rehype pipeline
 * documented by Inkdrop. Keeping it exported makes syntax support directly
 * testable without relying on a rendered React lifecycle.
 */
export const renderInkNoteMarkdown = async (
  markdown: string,
  codeFenceMetadataByLine = codeFenceMetadataFor(markdown),
  referenceDocumentsById: ReadonlyMap<NoteId, NoteDocument> = new Map(),
): Promise<string> => {
  const [
    { unified },
    { default: remarkParse },
    { default: remarkMath },
    { default: remarkGfm },
    { default: remarkRehype },
    { default: rehypeSanitize, defaultSchema },
    { default: rehypeKatex },
    { default: rehypeStringify },
  ] = await Promise.all([
    import('unified'),
    import('remark-parse'),
    import('remark-math'),
    import('remark-gfm'),
    import('remark-rehype'),
    import('rehype-sanitize'),
    import('rehype-katex'),
    import('rehype-stringify'),
  ]);

  return (
    unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkGfm)
      .use(preserveSafeInlineHtml)
      .use(remarkRehype)
      .use(rehypeSanitize, {
        ...defaultSchema,
        protocols: {
          ...defaultSchema.protocols,
          href: [...(defaultSchema.protocols?.href ?? []), 'inknote'],
        },
      })
      // KaTeX receives only the already parsed and sanitized math nodes. Keep
      // its trust boundary explicit: untrusted TeX cannot enable raw HTML,
      // links, or style attributes in the preview.
      .use(rehypeKatex, { trust: false, throwOnError: false })
      .use(
        inkNoteMarkdownPresentation(
          codeFenceMetadataByLine,
          referenceDocumentsById,
        ),
      )
      .use(rehypeStringify)
      .process(markdown)
      .then((result) => result.toString())
  );
};

/**
 * Renders Markdown only after it has moved through remark-rehype and the
 * default GitHub-style sanitization schema. Links are delegated to Electron's
 * already allowlisted external-window handler instead of navigating the
 * renderer in place.
 */
export function MarkdownPreview({
  markdown,
  themeRevision,
  referenceDocuments = [],
  onOpenReference,
  onSourceLineChange,
  sourceScrollPositionToReveal,
  scrollContainerRef,
}: MarkdownPreviewProps) {
  const [html, setHtml] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const deferredMarkdown = useDeferredValue(markdown);
  const onSourceLineChangeRef = useRef(onSourceLineChange);
  const onOpenReferenceRef = useRef(onOpenReference);
  const pendingSynchronizedScrollTop = useRef<number | null>(null);
  const renderedHtmlRef = useRef('');
  const renderedMermaidThemeRef = useRef<string | undefined>(undefined);
  const previewScrollRenderGuardRef = useRef(createPreviewScrollRenderGuard());
  const referenceDocumentsById = useMemo(
    () =>
      new Map(referenceDocuments.map((document) => [document.id, document])),
    [referenceDocuments],
  );

  useEffect(() => {
    onSourceLineChangeRef.current = onSourceLineChange;
  }, [onSourceLineChange]);

  useEffect(() => {
    onOpenReferenceRef.current = onOpenReference;
  }, [onOpenReference]);

  useEffect(() => {
    let isDisposed = false;
    const codeFenceMetadataByLine = codeFenceMetadataFor(deferredMarkdown);

    void renderInkNoteMarkdown(
      deferredMarkdown,
      codeFenceMetadataByLine,
      referenceDocumentsById,
    )
      .then((result) => {
        if (!isDisposed && renderedHtmlRef.current !== result) {
          previewScrollRenderGuardRef.current.beginRender();
          renderedHtmlRef.current = result;
          setHtml(result);
        }

        return undefined;
      })
      .catch(() => {
        const fallback = '<p>Unable to render this document.</p>';

        if (!isDisposed && renderedHtmlRef.current !== fallback) {
          previewScrollRenderGuardRef.current.beginRender();
          renderedHtmlRef.current = fallback;
          setHtml(fallback);
        }

        return undefined;
      });

    return () => {
      isDisposed = true;
    };
  }, [deferredMarkdown, referenceDocumentsById]);

  useLayoutEffect(() => {
    const guard = previewScrollRenderGuardRef.current;

    if (guard.shouldReportScroll()) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => guard.completeRender());

    return () => window.cancelAnimationFrame(frame);
  }, [html]);

  useEffect(() => {
    const container = containerRef.current;

    if (container === null) {
      return undefined;
    }

    const openExternalLink = (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const link = event.target.closest('a[href]');
      const href = link?.getAttribute('href');

      if (href === null || href === undefined) {
        return;
      }

      event.preventDefault();
      const noteId = parseNoteReference(href);

      if (noteId !== null) {
        onOpenReferenceRef.current?.(noteId);
        return;
      }

      window.open(href, '_blank', 'noopener');
    };

    container.addEventListener('click', openExternalLink);

    return () => {
      container.removeEventListener('click', openExternalLink);
    };
  }, []);

  useEffect(() => {
    const container = scrollContainerRef?.current;

    if (container === null || container === undefined) {
      return undefined;
    }

    const reportSourceLine = (): void => {
      if (!previewScrollRenderGuardRef.current.shouldReportScroll()) {
        pendingSynchronizedScrollTop.current = null;
        return;
      }

      const synchronizedScrollTop = pendingSynchronizedScrollTop.current;

      if (
        synchronizedScrollTop !== null &&
        Math.abs(container.scrollTop - synchronizedScrollTop) < 1
      ) {
        pendingSynchronizedScrollTop.current = null;
        return;
      }

      const sourceLine = sourceLineForPreviewScroll(
        sourceScrollAnchorsFor(container),
        container.scrollTop,
      );

      if (sourceLine !== null) {
        onSourceLineChangeRef.current?.(
          sourceScrollPositionFor({
            sourceLine,
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
          }),
        );
      }
    };

    container.addEventListener('scroll', reportSourceLine, { passive: true });

    return () => {
      container.removeEventListener('scroll', reportSourceLine);
    };
  }, [scrollContainerRef]);

  useEffect(() => {
    const container = scrollContainerRef?.current;

    if (
      container === null ||
      container === undefined ||
      sourceScrollPositionToReveal === undefined
    ) {
      return;
    }

    const maximumScrollTop = Math.max(
      0,
      container.scrollHeight - container.clientHeight,
    );
    let nextScrollTop: number;

    if (sourceScrollPositionToReveal.kind === 'end') {
      nextScrollTop = maximumScrollTop;
    } else {
      const scrollTop = previewScrollTopForSourceLine(
        sourceScrollAnchorsFor(container),
        sourceScrollPositionToReveal.sourceLine,
      );

      if (scrollTop === null) {
        return;
      }

      nextScrollTop = Math.min(Math.max(0, scrollTop), maximumScrollTop);
    }

    if (Math.abs(container.scrollTop - nextScrollTop) < 1) {
      return;
    }

    pendingSynchronizedScrollTop.current = nextScrollTop;
    container.scrollTo({ top: nextScrollTop, behavior: 'auto' });
  }, [html, scrollContainerRef, sourceScrollPositionToReveal]);

  useEffect(() => {
    const preview = containerRef.current;

    if (preview === null) {
      return;
    }

    // Mermaid serializes its palette into the SVG. Restoring the sanitized
    // Markdown on a theme change recreates its fences without changing note
    // content, then the current palette is rendered below.
    if (renderedMermaidThemeRef.current !== themeRevision) {
      preview.innerHTML = html;
      renderedMermaidThemeRef.current = themeRevision;
    }

    // Mermaid renders after the already-sanitized Markdown HTML is in the
    // document. Its own output is sanitized again before replacing the fence.
    void renderMermaidDiagrams(preview).catch(() => undefined);
  }, [html, themeRevision]);

  return (
    <div
      ref={containerRef}
      className="markdown-preview"
      aria-label="Rendered Markdown preview"
      aria-busy={markdown !== deferredMarkdown}
      // The HTML was parsed from Markdown and passed through rehype-sanitize
      // immediately before stringification above.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
