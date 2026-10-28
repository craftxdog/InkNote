import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { InkdropMermaidDiagram } from './components/InkdropMermaidDiagram';

const MAX_MERMAID_DIAGRAMS_PER_DOCUMENT = 20;
const MAX_MERMAID_SOURCE_LENGTH = 100_000;
const mermaidMountSelector = '.inknote-mermaid-mount[data-mermaid="true"]';

type MountedMermaidDiagram = Readonly<{
  root: Root;
  code: string;
  title: string | undefined;
}>;

export type MountedMermaidDiagrams = Readonly<{
  updateTheme: (themeRevision: string | undefined) => void;
  dispose: () => void;
}>;

const renderDiagram = (
  diagram: MountedMermaidDiagram,
  themeRevision: string | undefined,
): void => {
  diagram.root.render(
    createElement(InkdropMermaidDiagram, {
      code: diagram.code,
      title: diagram.title,
      themeRevision,
    }),
  );
};

/**
 * Bridges InkNote's sanitized HTML Markdown pipeline to Inkdrop's current
 * React/Pele Mermaid renderer. The Markdown tree supplies mount elements and
 * source anchors; each mount then owns a React root whose colour tokens follow
 * the active theme without serializing theme-specific SVG colours.
 *
 * Source: https://github.com/inkdropapp/mermaid/tree/master/packages/mermaid
 */
export const mountMermaidDiagrams = (
  preview: HTMLElement,
  themeRevision: string | undefined,
): MountedMermaidDiagrams => {
  const diagrams: MountedMermaidDiagram[] = [];
  const mounts = [
    ...preview.querySelectorAll<HTMLElement>(mermaidMountSelector),
  ].slice(0, MAX_MERMAID_DIAGRAMS_PER_DOCUMENT);

  for (const mount of mounts) {
    const code = mount.querySelector('code')?.textContent?.trim() ?? '';

    if (code.length === 0 || code.length > MAX_MERMAID_SOURCE_LENGTH) {
      mount.classList.add('inknote-mermaid-mount--error');
      mount.setAttribute('aria-invalid', 'true');
      continue;
    }

    const diagram: MountedMermaidDiagram = {
      root: createRoot(mount),
      code,
      title: mount.dataset.codeTitle,
    };

    mount.replaceChildren();
    renderDiagram(diagram, themeRevision);
    diagrams.push(diagram);
  }

  return {
    updateTheme: (nextThemeRevision) => {
      for (const diagram of diagrams) {
        renderDiagram(diagram, nextThemeRevision);
      }
    },
    dispose: () => {
      for (const diagram of diagrams) {
        diagram.root.unmount();
      }
    },
  };
};
