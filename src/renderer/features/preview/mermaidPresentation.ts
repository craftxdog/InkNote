let nextMermaidDiagramId = 0;
let mermaidLoader: Promise<(typeof import('mermaid'))['default']> | null = null;

type MermaidRenderer = Pick<(typeof import('mermaid'))['default'], 'render'> &
  Partial<Pick<(typeof import('mermaid'))['default'], 'initialize'>>;
type MermaidThemeVariables = NonNullable<
  Parameters<
    (typeof import('mermaid'))['default']['initialize']
  >[0]['themeVariables']
>;

/**
 * Mermaid's HTML labels are emitted as SVG <foreignObject> nodes. We do not
 * allow those nodes into the preview because they can carry executable HTML,
 * so ask Mermaid to use ordinary SVG text labels instead. This keeps labels
 * visible without weakening the SVG sanitization boundary below.
 */
export const mermaidConfiguration = {
  startOnLoad: false,
  securityLevel: 'strict',
  htmlLabels: false,
  theme: 'base',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
} satisfies Parameters<(typeof import('mermaid'))['default']['initialize']>[0];

const mermaidThemeTokenFallbacks = {
  '--inknote-mermaid-background': '#282e34',
  '--inknote-mermaid-surface': '#323941',
  '--inknote-mermaid-text': '#e7eaed',
  '--inknote-mermaid-border': '#86b6f8',
  '--inknote-mermaid-line': '#bdc8d1',
  '--inknote-mermaid-edge-label-background': '#282e34',
  '--inknote-mermaid-accent': '#86b6f8',
} as const;

type RgbColor = readonly [red: number, green: number, blue: number];

const parseSvgColor = (value: string | null): RgbColor | null => {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  const hexadecimal = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(normalized);

  if (hexadecimal !== null) {
    const digits = hexadecimal[1];
    const expanded =
      digits.length === 3
        ? digits
            .split('')
            .map((digit) => `${digit}${digit}`)
            .join('')
        : digits;

    return [
      Number.parseInt(expanded.slice(0, 2), 16),
      Number.parseInt(expanded.slice(2, 4), 16),
      Number.parseInt(expanded.slice(4, 6), 16),
    ];
  }

  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+\s*([\d.]+)[,\s]+\s*([\d.]+)/i.exec(
    normalized,
  );

  if (rgb === null) {
    return null;
  }

  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
};

const relativeLuminance = ([red, green, blue]: RgbColor): number => {
  const channel = (value: number): number => {
    const normalized = value / 255;

    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    channel(red) * 0.2126 + channel(green) * 0.7152 + channel(blue) * 0.0722
  );
};

const contrastRatio = (first: RgbColor, second: RgbColor): number => {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((left, right) => right - left);

  return (lighter + 0.05) / (darker + 0.05);
};

const resolvedSvgColor = (
  element: SVGElement,
  property: 'fill' | 'color',
): RgbColor | null =>
  parseSvgColor(getComputedStyle(element).getPropertyValue(property)) ??
  parseSvgColor(element.style.getPropertyValue(property)) ??
  parseSvgColor(element.getAttribute(property));

/**
 * Mermaid permits authored `style ... fill:` directives. Such a directive can
 * turn a node light while the active dark theme correctly supplies a light
 * default label, leaving the note author's label unreadable. Resolve the
 * rendered fill after Mermaid's SVG is mounted and only correct labels that
 * fall below the WCAG body-text contrast target.
 */
export const rebalanceMermaidNodeLabelContrast = (svg: SVGSVGElement): void => {
  const darkText: RgbColor = [17, 24, 39];
  const lightText: RgbColor = [248, 250, 252];

  for (const node of svg.querySelectorAll<SVGGElement>('.node')) {
    const shape = [...node.children].find((child): child is SVGElement =>
      ['rect', 'polygon', 'ellipse', 'circle', 'path'].includes(
        child.localName.toLocaleLowerCase(),
      ),
    );
    const background =
      shape === undefined ? null : resolvedSvgColor(shape, 'fill');

    if (background === null) {
      continue;
    }

    const preferredText =
      contrastRatio(background, darkText) >=
      contrastRatio(background, lightText)
        ? { color: darkText, value: '#111827' }
        : { color: lightText, value: '#f8fafc' };

    for (const label of node.querySelectorAll<SVGElement>('text, tspan')) {
      const currentText = resolvedSvgColor(label, 'fill');

      if (
        currentText !== null &&
        contrastRatio(background, currentText) >= 4.5
      ) {
        continue;
      }

      if (contrastRatio(background, preferredText.color) >= 4.5) {
        label.style.setProperty('fill', preferredText.value, 'important');
      }
    }
  }
};

/**
 * Mermaid embeds its colours in generated SVG. Resolve the same semantic
 * preview tokens used by the workspace before each render so a package-theme
 * switch cannot leave dark labels or arrows behind from the previous palette.
 */
export const resolveMermaidThemeVariables = (
  readToken: (name: keyof typeof mermaidThemeTokenFallbacks) => string,
): MermaidThemeVariables => {
  const token = (name: keyof typeof mermaidThemeTokenFallbacks): string =>
    readToken(name).trim() || mermaidThemeTokenFallbacks[name];
  const background = token('--inknote-mermaid-background');
  const surface = token('--inknote-mermaid-surface');
  const text = token('--inknote-mermaid-text');
  const border = token('--inknote-mermaid-border');
  const line = token('--inknote-mermaid-line');
  const edgeLabelBackground = token('--inknote-mermaid-edge-label-background');
  const accent = token('--inknote-mermaid-accent');

  return {
    background,
    primaryColor: surface,
    primaryTextColor: text,
    primaryBorderColor: border,
    secondaryColor: background,
    secondaryTextColor: text,
    secondaryBorderColor: border,
    tertiaryColor: background,
    tertiaryTextColor: text,
    tertiaryBorderColor: border,
    textColor: text,
    lineColor: line,
    mainBkg: surface,
    nodeBorder: border,
    clusterBkg: background,
    clusterBorder: border,
    edgeLabelBackground,
    actorBkg: surface,
    actorBorder: border,
    actorTextColor: text,
    actorLineColor: line,
    signalColor: line,
    signalTextColor: text,
    labelBoxBkgColor: edgeLabelBackground,
    labelTextColor: text,
    noteBkgColor: surface,
    noteTextColor: text,
    noteBorderColor: border,
    activationBkgColor: accent,
    activationBorderColor: border,
    sequenceNumberColor: text,
  };
};

export const mermaidConfigurationForPreview = (
  preview: HTMLElement,
): Parameters<(typeof import('mermaid'))['default']['initialize']>[0] => {
  const styles = getComputedStyle(preview);

  return {
    ...mermaidConfiguration,
    themeVariables: resolveMermaidThemeVariables((name) =>
      styles.getPropertyValue(name),
    ),
  };
};

const forbiddenSvgElements = new Set([
  'embed',
  'foreignobject',
  'iframe',
  'object',
  'script',
]);
const MAX_MERMAID_DIAGRAMS_PER_DOCUMENT = 20;
const MAX_MERMAID_SOURCE_LENGTH = 100_000;

const isSafeStyle = (value: string): boolean => {
  const normalized = value.toLocaleLowerCase();

  return (
    !normalized.includes('expression(') &&
    !normalized.includes('@import') &&
    !normalized.includes('-moz-binding') &&
    !/url\(\s*(['"])?(?!#)/.test(normalized)
  );
};

const configuredMermaid = async (): Promise<
  (typeof import('mermaid'))['default']
> => {
  if (mermaidLoader === null) {
    mermaidLoader = import('mermaid').then(({ default: mermaid }) => mermaid);
  }

  return mermaidLoader;
};

/**
 * Mermaid returns an SVG string. This second defensive boundary removes
 * executable elements, inline event handlers, and any external navigation
 * before the generated SVG enters the preview DOM.
 */
export const sanitizeMermaidSvg = (markup: string): SVGSVGElement | null => {
  const document = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = document.documentElement;

  if (
    root.localName.toLocaleLowerCase() !== 'svg' ||
    document.querySelector('parsererror') !== null
  ) {
    return null;
  }

  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (forbiddenSvgElements.has(element.localName.toLocaleLowerCase())) {
      element.remove();
      continue;
    }

    if (
      element.localName.toLocaleLowerCase() === 'style' &&
      !isSafeStyle(element.textContent ?? '')
    ) {
      element.remove();
      continue;
    }

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLocaleLowerCase();

      if (
        name.startsWith('on') ||
        name === 'href' ||
        name === 'xlink:href' ||
        (name === 'style' && !isSafeStyle(attribute.value))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  root.setAttribute('role', 'img');
  root.setAttribute('focusable', 'false');

  return root as unknown as SVGSVGElement;
};

const sourceAnchorAttributes = [
  'data-source-line',
  'data-source-end-line',
] as const;
const MERMAID_ZOOM_STEP = 0.25;
const MERMAID_MIN_ZOOM = 0.5;
const MERMAID_MAX_ZOOM = 3;
const MERMAID_PAN_STEP = 72;

const clampMermaidZoom = (value: number): number =>
  Math.min(MERMAID_MAX_ZOOM, Math.max(MERMAID_MIN_ZOOM, value));

const formatMermaidZoom = (value: number): string =>
  Number(value.toFixed(2)).toString();

const setMermaidDiagramZoom = (
  figure: HTMLElement,
  canvas: HTMLElement,
  zoom: number,
): void => {
  const normalizedZoom = clampMermaidZoom(zoom);

  figure.dataset.zoom = formatMermaidZoom(normalizedZoom);
  canvas.style.width = `${normalizedZoom * 100}%`;
};

const mermaidDiagramZoom = (figure: HTMLElement): number => {
  const value = Number(figure.dataset.zoom ?? '1');

  return Number.isFinite(value) ? clampMermaidZoom(value) : 1;
};

const addMermaidControl = (
  controls: HTMLElement,
  label: string,
  text: string,
  onClick: () => void,
): void => {
  const control = document.createElement('button');

  control.type = 'button';
  control.className = 'inknote-mermaid__control';
  control.setAttribute('aria-label', label);
  control.title = label;
  control.textContent = text;
  control.addEventListener('click', onClick);
  controls.append(control);
};

const configureMermaidInteraction = (
  figure: HTMLElement,
  viewport: HTMLElement,
  canvas: HTMLElement,
): void => {
  const applyZoom = (value: number): void =>
    setMermaidDiagramZoom(figure, canvas, value);
  const pan = (left: number, top: number): void => {
    viewport.scrollBy({ left, top, behavior: 'auto' });
  };
  const controls = document.createElement('div');

  controls.className = 'inknote-mermaid__controls';
  controls.setAttribute('role', 'toolbar');
  controls.setAttribute('aria-label', 'Mermaid diagram controls');
  addMermaidControl(controls, 'Zoom out Mermaid diagram', '−', () => {
    applyZoom(mermaidDiagramZoom(figure) - MERMAID_ZOOM_STEP);
  });
  addMermaidControl(controls, 'Reset Mermaid diagram zoom', '100%', () => {
    applyZoom(1);
  });
  addMermaidControl(controls, 'Zoom in Mermaid diagram', '+', () => {
    applyZoom(mermaidDiagramZoom(figure) + MERMAID_ZOOM_STEP);
  });
  figure.append(controls);
  setMermaidDiagramZoom(figure, canvas, 1);

  viewport.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    event.preventDefault();
    applyZoom(
      mermaidDiagramZoom(figure) +
        (event.deltaY < 0 ? MERMAID_ZOOM_STEP : -MERMAID_ZOOM_STEP),
    );
  });

  viewport.addEventListener('keydown', (event) => {
    switch (event.key) {
      case '+':
      case '=':
        event.preventDefault();
        applyZoom(mermaidDiagramZoom(figure) + MERMAID_ZOOM_STEP);
        break;
      case '-':
      case '_':
        event.preventDefault();
        applyZoom(mermaidDiagramZoom(figure) - MERMAID_ZOOM_STEP);
        break;
      case '0':
        event.preventDefault();
        applyZoom(1);
        break;
      case 'h':
        event.preventDefault();
        pan(-MERMAID_PAN_STEP, 0);
        break;
      case 'j':
        event.preventDefault();
        pan(0, MERMAID_PAN_STEP);
        break;
      case 'k':
        event.preventDefault();
        pan(0, -MERMAID_PAN_STEP);
        break;
      case 'l':
        event.preventDefault();
        pan(MERMAID_PAN_STEP, 0);
        break;
      default:
        break;
    }
  });

  let dragStart: Readonly<{
    pointerId: number;
    clientX: number;
    clientY: number;
    scrollLeft: number;
    scrollTop: number;
  }> | null = null;

  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }

    dragStart = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    viewport.setPointerCapture?.(event.pointerId);
    viewport.classList.add('inknote-mermaid__viewport--panning');
  });

  const stopDragging = (event: PointerEvent): void => {
    if (dragStart?.pointerId !== event.pointerId) {
      return;
    }

    dragStart = null;
    viewport.releasePointerCapture?.(event.pointerId);
    viewport.classList.remove('inknote-mermaid__viewport--panning');
  };

  viewport.addEventListener('pointerup', stopDragging);
  viewport.addEventListener('pointercancel', stopDragging);
  viewport.addEventListener('pointermove', (event) => {
    if (dragStart?.pointerId !== event.pointerId) {
      return;
    }

    viewport.scrollLeft =
      dragStart.scrollLeft - (event.clientX - dragStart.clientX);
    viewport.scrollTop =
      dragStart.scrollTop - (event.clientY - dragStart.clientY);
  });
};

const replaceWithMermaidFigure = (
  codeBlock: HTMLPreElement,
  svg: SVGSVGElement,
): void => {
  const figure = document.createElement('figure');
  const viewport = document.createElement('div');
  const canvas = document.createElement('div');
  const title = codeBlock.dataset.codeTitle;

  figure.className = 'inknote-mermaid';
  figure.setAttribute('aria-label', title ?? 'Mermaid diagram');

  for (const name of sourceAnchorAttributes) {
    const value = codeBlock.getAttribute(name);

    if (value !== null) {
      figure.setAttribute(name, value);
    }
  }

  if (title !== undefined && title.length > 0) {
    const caption = document.createElement('figcaption');

    caption.textContent = title.replaceAll('\n', ' — ');
    figure.append(caption);
  }

  viewport.className = 'inknote-mermaid__viewport';
  viewport.tabIndex = 0;
  viewport.setAttribute(
    'aria-label',
    'Interactive Mermaid diagram. Use + and - to zoom, 0 to reset, and h j k l to pan.',
  );
  canvas.className = 'inknote-mermaid__canvas';
  const renderedSvg = document.importNode(svg, true) as SVGSVGElement;

  canvas.append(renderedSvg);
  viewport.append(canvas);
  figure.append(viewport);
  codeBlock.replaceWith(figure);
  rebalanceMermaidNodeLabelContrast(renderedSvg);
  configureMermaidInteraction(figure, viewport, canvas);
};

export const renderMermaidDiagrams = async (
  preview: HTMLElement,
  loadMermaid: () => Promise<MermaidRenderer> = configuredMermaid,
): Promise<void> => {
  const codeBlocks = [
    ...preview.querySelectorAll<HTMLPreElement>(
      'pre.inknote-code-block[data-language="MERMAID"]',
    ),
  ].slice(0, MAX_MERMAID_DIAGRAMS_PER_DOCUMENT);

  if (codeBlocks.length === 0) {
    return;
  }

  const mermaid = await loadMermaid();

  // Mermaid keeps global configuration and serializes colours into the SVG.
  // Re-initialize for the active preview palette whenever its HTML is mounted
  // so theme or Acrylic changes cannot retain stale, low-contrast diagrams.
  mermaid.initialize?.(mermaidConfigurationForPreview(preview));

  // Mermaid coordinates some render state through the document. Rendering
  // fences one at a time avoids cross-diagram ID/container collisions.
  for (const codeBlock of codeBlocks) {
    const source = codeBlock.querySelector('code')?.textContent?.trim();

    if (source === undefined || source.length === 0) {
      continue;
    }

    if (source.length > MAX_MERMAID_SOURCE_LENGTH) {
      codeBlock.classList.add('inknote-code-block--error');
      codeBlock.setAttribute('aria-invalid', 'true');
      continue;
    }

    try {
      const { svg } = await mermaid.render(
        `inknote-mermaid-${++nextMermaidDiagramId}`,
        source,
      );
      const safeSvg = sanitizeMermaidSvg(svg);

      if (safeSvg === null || !codeBlock.isConnected) {
        throw new Error('Mermaid did not produce a safe SVG.');
      }

      replaceWithMermaidFigure(codeBlock, safeSvg);
    } catch {
      if (codeBlock.isConnected) {
        codeBlock.classList.add('inknote-code-block--error');
        codeBlock.setAttribute('aria-invalid', 'true');
      }
    }
  }
};
