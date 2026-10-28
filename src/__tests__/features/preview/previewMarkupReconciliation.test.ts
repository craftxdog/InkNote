import {
  mermaidMountKeyForCode,
  reconcilePreviewMarkup,
} from '../../../renderer/features/preview/previewMarkupReconciliation';

const mermaidMount = (code: string, startLine: number): string =>
  [
    `<div class="inknote-mermaid-mount" data-mermaid="true" data-source-line="${startLine}" data-source-end-line="${startLine + 2}">`,
    `<code>${code}</code>`,
    '</div>',
  ].join('');

describe('reconcilePreviewMarkup', () => {
  it('keeps an unchanged Mermaid host and its rendered children while surrounding Markdown changes', () => {
    const preview = document.createElement('div');
    const code = 'flowchart TD\nA --> B';

    preview.innerHTML = [
      '<p>Before</p>',
      mermaidMount(code, 3),
      '<p>After</p>',
    ].join('');

    const existingMount = preview.querySelector<HTMLElement>(
      '.inknote-mermaid-mount',
    );
    const renderedDiagram = document.createElement('svg');

    if (existingMount === null) {
      throw new Error('Expected Mermaid mount.');
    }

    existingMount.dataset.mermaidSourceKey = mermaidMountKeyForCode(code);
    existingMount.replaceChildren(renderedDiagram);

    reconcilePreviewMarkup(
      preview,
      [
        '<p>Updated surrounding Markdown.</p>',
        mermaidMount(code, 7),
        '<p>After</p>',
      ].join(''),
    );

    const retainedMount = preview.querySelector<HTMLElement>(
      '.inknote-mermaid-mount',
    );

    expect(retainedMount).toBe(existingMount);
    expect(retainedMount?.contains(renderedDiagram)).toBe(true);
    expect(retainedMount?.getAttribute('data-source-line')).toBe('7');
    expect(preview.textContent).toContain('Updated surrounding Markdown.');
  });

  it('replaces a Mermaid host when its source changes', () => {
    const preview = document.createElement('div');
    const firstCode = 'flowchart TD\nA --> B';

    preview.innerHTML = mermaidMount(firstCode, 3);

    const existingMount = preview.querySelector<HTMLElement>(
      '.inknote-mermaid-mount',
    );

    if (existingMount === null) {
      throw new Error('Expected Mermaid mount.');
    }

    existingMount.dataset.mermaidSourceKey = mermaidMountKeyForCode(firstCode);
    existingMount.replaceChildren(document.createElement('svg'));

    reconcilePreviewMarkup(preview, mermaidMount('flowchart TD\nA --> C', 3));

    const nextMount = preview.querySelector<HTMLElement>(
      '.inknote-mermaid-mount',
    );

    expect(nextMount).not.toBe(existingMount);
    expect(nextMount?.textContent).toContain('A --> C');
  });
});
