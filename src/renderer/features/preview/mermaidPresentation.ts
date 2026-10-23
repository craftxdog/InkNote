let nextMermaidDiagramId = 0;
let mermaidLoader: Promise<(typeof import('mermaid'))['default']> | null = null;

type MermaidRenderer = Pick<(typeof import('mermaid'))['default'], 'render'>;

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
    mermaidLoader = import('mermaid').then(({ default: mermaid }) => {
      // Mermaid documents `initialize` before `render`; strict mode keeps
      // diagram source from enabling click handlers or arbitrary HTML. With
      // HTML labels off, Mermaid emits safe SVG text instead of foreignObject.
      mermaid.initialize(mermaidConfiguration);

      return mermaid;
    });
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
  canvas.append(document.importNode(svg, true));
  viewport.append(canvas);
  figure.append(viewport);
  configureMermaidInteraction(figure, viewport, canvas);
  codeBlock.replaceWith(figure);
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
