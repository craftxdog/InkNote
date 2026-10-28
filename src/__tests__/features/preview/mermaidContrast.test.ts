import {
  applyExplicitNodeTextContrast,
  foregroundForFill,
} from '../../../renderer/features/preview/mermaidContrast';

describe('Mermaid explicit-node contrast', () => {
  it('chooses a neutral foreground from the declared fill rather than a theme palette', () => {
    expect(foregroundForFill('#e8f5e9')).toBe('#000000');
    expect(foregroundForFill('rgb(35, 25, 55)')).toBe('#ffffff');
    expect(foregroundForFill('var(--custom-fill)')).toBeNull();
  });

  it('adds contrast only for author-styled nodes without an explicit text color', () => {
    const preview = document.createElement('div');
    preview.innerHTML = `
      <svg>
        <g class="pele-node" data-id="light">
          <rect style="fill: #e8f5e9; stroke: #43a047" />
          <text class="pele-label">Readable automatically</text>
        </g>
        <g class="pele-node" data-id="authored">
          <rect style="fill: #fff3e0; stroke: #fb8c00" />
          <text class="pele-label" style="fill: #7c2d12">Author chooses this</text>
        </g>
        <g class="pele-node" data-id="theme-default">
          <rect fill="var(--_s)" />
          <text class="pele-label">Theme controls this</text>
        </g>
      </svg>
    `;

    applyExplicitNodeTextContrast(preview);

    const labels = preview.querySelectorAll<SVGTextElement>('.pele-label');
    expect(labels[0].style.fill).toBe('#000000');
    expect(labels[1].style.fill).toBe('#7c2d12');
    expect(labels[2].style.fill).toBe('');
  });
});
