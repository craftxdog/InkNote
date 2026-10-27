const render = jest.fn();
const initialize = jest.fn();

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize,
    render,
  },
}));

import {
  rebalanceMermaidNodeLabelContrast,
  mermaidConfiguration,
  mermaidConfigurationForPreview,
  renderMermaidDiagrams,
  resolveMermaidThemeVariables,
  sanitizeMermaidSvg,
} from '../../../renderer/features/preview/mermaidPresentation';

describe('sanitizeMermaidSvg', () => {
  it('configures Mermaid to emit SVG labels rather than foreignObject labels', () => {
    expect(mermaidConfiguration).toMatchObject({
      securityLevel: 'strict',
      htmlLabels: false,
    });
  });

  it('maps the active preview palette into Mermaid theme variables', () => {
    const tokens: Readonly<Record<string, string>> = {
      '--inknote-mermaid-background': '#1d2630',
      '--inknote-mermaid-surface': '#293544',
      '--inknote-mermaid-text': '#e8edf4',
      '--inknote-mermaid-border': '#7894b3',
      '--inknote-mermaid-line': '#b2c4d8',
      '--inknote-mermaid-edge-label-background': '#202c39',
      '--inknote-mermaid-accent': '#8fbef8',
    };

    expect(
      resolveMermaidThemeVariables((name) => tokens[name] ?? ''),
    ).toMatchObject({
      background: '#1d2630',
      primaryColor: '#293544',
      primaryTextColor: '#e8edf4',
      primaryBorderColor: '#7894b3',
      lineColor: '#b2c4d8',
      edgeLabelBackground: '#202c39',
      signalTextColor: '#e8edf4',
    });
  });

  it('uses a dark label tone when a Mermaid node has an authored light fill', () => {
    const svg = sanitizeMermaidSvg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <g class="node"><rect fill="#fff3e0" /><text fill="#e7eaed">Payment accepted?</text></g>
      </svg>
    `);

    expect(svg).not.toBeNull();

    rebalanceMermaidNodeLabelContrast(svg as SVGSVGElement);

    expect(svg?.querySelector('text')?.style.fill).toBe('#111827');
  });

  it('reconfigures Mermaid with the current preview palette before rendering', async () => {
    const configure = jest.fn();
    const preview = document.createElement('div');

    preview.style.setProperty('--inknote-mermaid-background', '#1d2630');
    preview.style.setProperty('--inknote-mermaid-surface', '#293544');
    preview.style.setProperty('--inknote-mermaid-text', '#e8edf4');
    preview.style.setProperty('--inknote-mermaid-border', '#7894b3');
    preview.style.setProperty('--inknote-mermaid-line', '#b2c4d8');
    preview.style.setProperty(
      '--inknote-mermaid-edge-label-background',
      '#202c39',
    );
    preview.style.setProperty('--inknote-mermaid-accent', '#8fbef8');
    preview.innerHTML = `
      <pre class="inknote-code-block" data-language="MERMAID"><code>flowchart TD\nA --&gt; B</code></pre>
    `;
    document.body.append(preview);
    render.mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>CI</text></svg>',
    });

    await renderMermaidDiagrams(preview, async () => ({
      render,
      initialize: configure,
    }));

    expect(configure).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: 'strict',
        htmlLabels: false,
        themeVariables: expect.objectContaining({
          primaryTextColor: '#e8edf4',
          lineColor: '#b2c4d8',
        }),
      }),
    );
    expect(mermaidConfigurationForPreview(preview)).toEqual(
      expect.objectContaining({
        themeVariables: expect.objectContaining({
          edgeLabelBackground: '#202c39',
        }),
      }),
    );

    preview.remove();
  });

  it('retains an SVG diagram while removing executable and external content', () => {
    const svg = sanitizeMermaidSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" onload="alert('nope')">
        <text><tspan>Safe SVG label</tspan></text>
        <script>alert('nope')</script>
        <foreignObject><div>untrusted HTML</div></foreignObject>
        <a href="https://example.invalid"><text>External link</text></a>
        <style>@import url(https://example.invalid/theme.css);</style>
        <rect style="fill: url(https://example.invalid/pixel.svg)" />
        <path style="marker-end: url(#arrowhead)" />
      </svg>
    `);

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.querySelector('script')).toBeNull();
    expect(svg?.querySelector('foreignObject')).toBeNull();
    expect(svg?.querySelector('text')?.textContent).toBe('Safe SVG label');
    expect(svg?.querySelector('a')?.getAttribute('href')).toBeNull();
    expect(svg?.querySelector('style')).toBeNull();
    expect(svg?.querySelector('rect')?.getAttribute('style')).toBeNull();
    expect(svg?.querySelector('path')?.getAttribute('style')).toBe(
      'marker-end: url(#arrowhead)',
    );
  });

  it('rejects markup that is not a valid SVG document', () => {
    expect(sanitizeMermaidSvg('<svg><g></svg>')).toBeNull();
    expect(sanitizeMermaidSvg('<div>not an SVG</div>')).toBeNull();
  });

  it('replaces Mermaid fences with a safe, source-anchored diagram', async () => {
    render.mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>CI</text></svg>',
    });
    const preview = document.createElement('div');

    preview.innerHTML = `
      <pre class="inknote-code-block" data-language="MERMAID" data-code-title="CI flow" data-source-line="3" data-source-end-line="8"><code>flowchart TD\nA --&gt; B</code></pre>
    `;
    document.body.append(preview);

    await renderMermaidDiagrams(preview, async () => ({ render }));

    expect(render).toHaveBeenCalledWith(
      expect.stringMatching(/^inknote-mermaid-/),
      'flowchart TD\nA --> B',
    );
    const figure = preview.querySelector('figure.inknote-mermaid');

    expect(figure?.getAttribute('data-source-line')).toBe('3');
    expect(figure?.getAttribute('aria-label')).toBe('CI flow');
    expect(figure?.textContent).toContain('CI flow');
    expect(figure?.querySelector('svg')?.getAttribute('role')).toBe('img');

    preview.remove();
  });

  it('corrects a low-contrast Mermaid label after the diagram is mounted', async () => {
    render.mockResolvedValue({
      svg: `
        <svg xmlns="http://www.w3.org/2000/svg">
          <g class="node"><rect fill="#fff3e0" /><text fill="#e7eaed">Payment accepted?</text></g>
        </svg>
      `,
    });
    const preview = document.createElement('div');

    preview.innerHTML = `
      <pre class="inknote-code-block" data-language="MERMAID"><code>flowchart TD\nA --&gt; B</code></pre>
    `;
    document.body.append(preview);

    await renderMermaidDiagrams(preview, async () => ({ render }));

    expect(preview.querySelector<SVGTextElement>('svg text')?.style.fill).toBe(
      '#111827',
    );

    preview.remove();
  });

  it('does not let unavailable SVG metadata interrupt contrast reconciliation', () => {
    const malformedSvg = {
      querySelectorAll: () => [
        {
          children: [{}],
          querySelectorAll: () => [],
        },
      ],
    } as unknown as SVGSVGElement;

    expect(() => rebalanceMermaidNodeLabelContrast(malformedSvg)).not.toThrow();
  });

  it('adds keyboard-accessible pan and zoom controls to each diagram', async () => {
    render.mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>CI</text></svg>',
    });
    const preview = document.createElement('div');

    preview.innerHTML = `
      <pre class="inknote-code-block" data-language="MERMAID"><code>flowchart TD\nA --&gt; B</code></pre>
    `;
    document.body.append(preview);

    await renderMermaidDiagrams(preview, async () => ({ render }));

    const figure = preview.querySelector<HTMLElement>('.inknote-mermaid');
    const viewport = preview.querySelector<HTMLElement>(
      '.inknote-mermaid__viewport',
    );
    const canvas = preview.querySelector<HTMLElement>(
      '.inknote-mermaid__canvas',
    );
    const zoomIn = preview.querySelector<HTMLButtonElement>(
      '[aria-label="Zoom in Mermaid diagram"]',
    );

    expect(viewport).not.toBeNull();
    expect(viewport?.getAttribute('tabindex')).toBe('0');
    expect(zoomIn).not.toBeNull();
    expect(figure?.dataset.zoom).toBe('1');

    zoomIn?.click();

    expect(figure?.dataset.zoom).toBe('1.25');
    expect(canvas?.style.width).toBe('125%');

    preview.remove();
  });
});
