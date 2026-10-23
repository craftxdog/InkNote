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
  mermaidConfiguration,
  renderMermaidDiagrams,
  sanitizeMermaidSvg,
} from '../../../renderer/features/preview/mermaidPresentation';

describe('sanitizeMermaidSvg', () => {
  it('configures Mermaid to emit SVG labels rather than foreignObject labels', () => {
    expect(mermaidConfiguration).toMatchObject({
      securityLevel: 'strict',
      htmlLabels: false,
    });
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
