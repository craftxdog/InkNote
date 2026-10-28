const render = jest.fn();
const unmount = jest.fn();
const createRoot = jest.fn(() => ({ render, unmount }));

jest.mock('react-dom/client', () => ({ createRoot }));
jest.mock(
  '../../../renderer/features/preview/components/InkdropMermaidDiagram',
  () => ({ InkdropMermaidDiagram: () => null }),
);

import { createMermaidPresentation } from '../../../renderer/features/preview/mermaidPresentation';
import { reconcilePreviewMarkup } from '../../../renderer/features/preview/previewMarkupReconciliation';

describe('createMermaidPresentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps an unchanged diagram mounted when Markdown outside its fence changes', () => {
    const preview = document.createElement('div');

    preview.innerHTML = [
      '<div class="inknote-mermaid-mount" data-mermaid="true" data-code-title="CI flow" data-source-line="3" data-source-end-line="8">',
      '<code>flowchart TD\nA --&gt; B</code>',
      '</div>',
    ].join('');

    const presentation = createMermaidPresentation();

    presentation.sync(preview, 'nord');

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

    reconcilePreviewMarkup(
      preview,
      [
        '<p>Edited text outside the diagram.</p>',
        '<div class="inknote-mermaid-mount" data-mermaid="true" data-code-title="CI flow" data-source-line="5" data-source-end-line="10">',
        '<code>flowchart TD\nA --&gt; B</code>',
        '</div>',
      ].join(''),
    );
    presentation.sync(preview, 'nord');

    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(unmount).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);

    presentation.updateTheme('solarized-dark');
    expect(render).toHaveBeenCalledTimes(2);
    expect(render.mock.calls[1]?.[0].props.themeRevision).toBe(
      'solarized-dark',
    );

    presentation.dispose();
    expect(unmount).toHaveBeenCalledTimes(1);
  });

  it('unmounts only the Mermaid renderer whose source changed', () => {
    const preview = document.createElement('div');
    const presentation = createMermaidPresentation();

    preview.innerHTML = [
      '<div class="inknote-mermaid-mount" data-mermaid="true">',
      '<code>flowchart TD\nA --&gt; B</code>',
      '</div>',
    ].join('');

    presentation.sync(preview, 'nord');
    reconcilePreviewMarkup(
      preview,
      [
        '<div class="inknote-mermaid-mount" data-mermaid="true">',
        '<code>flowchart TD\nA --&gt; C</code>',
        '</div>',
      ].join(''),
    );
    presentation.sync(preview, 'nord');

    expect(createRoot).toHaveBeenCalledTimes(2);
    expect(unmount).toHaveBeenCalledTimes(1);

    presentation.dispose();
    expect(unmount).toHaveBeenCalledTimes(2);
  });
});
