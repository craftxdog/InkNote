const render = jest.fn();
const unmount = jest.fn();
const createRoot = jest.fn(() => ({ render, unmount }));

jest.mock('react-dom/client', () => ({ createRoot }));
jest.mock(
  '../../../renderer/features/preview/components/InkdropMermaidDiagram',
  () => ({ InkdropMermaidDiagram: () => null }),
);

import { mountMermaidDiagrams } from '../../../renderer/features/preview/mermaidPresentation';

describe('mountMermaidDiagrams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('replaces Mermaid mounts with Inkdrop renderer roots while preserving source anchors', () => {
    const preview = document.createElement('div');

    preview.innerHTML = [
      '<div class="inknote-mermaid-mount" data-mermaid="true" data-code-title="CI flow" data-source-line="3" data-source-end-line="8">',
      '<code>flowchart TD\nA --&gt; B</code>',
      '</div>',
    ].join('');

    const mounted = mountMermaidDiagrams(preview, 'nord');

    expect(createRoot).toHaveBeenCalledWith(
      preview.querySelector('.inknote-mermaid-mount'),
    );
    expect(render).toHaveBeenCalledTimes(1);

    const diagram = render.mock.calls[0]?.[0];

    expect(diagram.props).toMatchObject({
      code: 'flowchart TD\nA --> B',
      themeRevision: 'nord',
      title: 'CI flow',
    });
    expect(
      preview
        .querySelector('.inknote-mermaid-mount')
        ?.getAttribute('data-source-line'),
    ).toBe('3');

    mounted.updateTheme('solarized-dark');
    expect(render).toHaveBeenCalledTimes(2);
    expect(render.mock.calls[1]?.[0].props.themeRevision).toBe(
      'solarized-dark',
    );

    mounted.dispose();
    expect(unmount).toHaveBeenCalledTimes(1);
  });
});
