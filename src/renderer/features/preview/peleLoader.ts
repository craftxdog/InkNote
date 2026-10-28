let peleLoader: Promise<typeof import('pele')> | null = null;

/**
 * Pele is intentionally lazy: Inkdrop keeps the diagram engine out of the
 * eager plugin bundle, and InkNote should not load it for notes without
 * Mermaid fences either.
 */
export const loadPele = (): Promise<typeof import('pele')> => {
  if (peleLoader === null) {
    peleLoader = import('pele');
  }

  return peleLoader;
};
