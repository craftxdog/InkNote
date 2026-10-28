import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { InkdropMermaidDiagram } from './components/InkdropMermaidDiagram';
import {
  mermaidMountSelector,
  mermaidSourceFor,
  rememberMermaidSource,
} from './previewMarkupReconciliation';

const MAX_MERMAID_DIAGRAMS_PER_DOCUMENT = 20;
const MAX_MERMAID_SOURCE_LENGTH = 100_000;

type MountedMermaidDiagram = Readonly<{
  root: Root;
  code: string;
  title: string | undefined;
}>;

export type MountedMermaidDiagrams = Readonly<{
  sync: (preview: HTMLElement, themeRevision: string | undefined) => void;
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
 * React/Pele Mermaid renderer. Its lifecycle deliberately matches Inkdrop's:
 * one React root stays attached to one preserved Markdown mount. Ordinary
 * Markdown edits therefore leave existing diagrams and their SVGs on screen;
 * only a changed Mermaid source gets a new root.
 *
 * Source: https://github.com/inkdropapp/mermaid/tree/master/packages/mermaid
 */
export const createMermaidPresentation = (): MountedMermaidDiagrams => {
  const diagramsByMount = new Map<HTMLElement, MountedMermaidDiagram>();

  const mountDiagram = (
    mount: HTMLElement,
    themeRevision: string | undefined,
  ): void => {
    const source = mermaidSourceFor(mount);

    if (source === null || source.code.length > MAX_MERMAID_SOURCE_LENGTH) {
      mount.classList.add('inknote-mermaid-mount--error');
      mount.setAttribute('aria-invalid', 'true');
      return;
    }

    const diagram: MountedMermaidDiagram = {
      root: createRoot(mount),
      code: source.code,
      title: source.title,
    };

    rememberMermaidSource(mount, source.code);
    mount.replaceChildren();
    renderDiagram(diagram, themeRevision);
    diagramsByMount.set(mount, diagram);
  };

  return {
    sync: (preview, themeRevision) => {
      const mounts = [
        ...preview.querySelectorAll<HTMLElement>(mermaidMountSelector),
      ].slice(0, MAX_MERMAID_DIAGRAMS_PER_DOCUMENT);
      const liveMounts = new Set(mounts);

      for (const [mount, diagram] of diagramsByMount) {
        if (liveMounts.has(mount)) {
          continue;
        }

        diagram.root.unmount();
        diagramsByMount.delete(mount);
      }

      for (const mount of mounts) {
        const diagram = diagramsByMount.get(mount);

        if (diagram === undefined) {
          mountDiagram(mount, themeRevision);
          continue;
        }

        const nextTitle = mount.dataset.codeTitle;

        if (diagram.title !== nextTitle) {
          const renamedDiagram: MountedMermaidDiagram = {
            ...diagram,
            title: nextTitle,
          };
          diagramsByMount.set(mount, renamedDiagram);
          renderDiagram(renamedDiagram, themeRevision);
        }
      }
    },
    updateTheme: (nextThemeRevision) => {
      for (const diagram of diagramsByMount.values()) {
        renderDiagram(diagram, nextThemeRevision);
      }
    },
    dispose: () => {
      for (const diagram of diagramsByMount.values()) {
        diagram.root.unmount();
      }
      diagramsByMount.clear();
    },
  };
};

/**
 * Backwards-compatible one-shot entrypoint for callers that only need an
 * initial presentation. New preview code should retain the presentation and
 * call sync after reconciling sanitized Markdown markup.
 */
export const mountMermaidDiagrams = (
  preview: HTMLElement,
  themeRevision: string | undefined,
): MountedMermaidDiagrams => {
  const presentation = createMermaidPresentation();
  presentation.sync(preview, themeRevision);
  return presentation;
};
