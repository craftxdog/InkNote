import { act, render, waitFor } from '@testing-library/react';

const destroy = jest.fn();
const refresh = jest.fn();
const update = jest.fn();
const mount = jest.fn(() => ({
  destroy,
  refresh,
  update,
  result: undefined,
  zoom: undefined,
}));

jest.mock('../../../renderer/features/preview/peleLoader', () => ({
  loadPele: jest.fn(async () => ({ mount })),
}));

import { InkdropMermaidDiagram } from '../../../renderer/features/preview/components/InkdropMermaidDiagram';

describe('InkdropMermaidDiagram', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mounts Mermaid source through Inkdrop's Pele renderer and refreshes after a theme swap", async () => {
    const { rerender, unmount } = render(
      <InkdropMermaidDiagram
        code={'sequenceDiagram\nAlice->>Bob: Hello'}
        panZoom={false}
        themeRevision="inknote-dark"
      />,
    );

    await waitFor(() =>
      expect(mount).toHaveBeenCalledWith(
        expect.any(HTMLDivElement),
        'sequenceDiagram\nAlice->>Bob: Hello',
        expect.objectContaining({
          autoDirection: false,
          linkSchemes: ['http', 'https', 'mailto', 'tel', 'inknote'],
          zoom: false,
        }),
      ),
    );

    rerender(
      <InkdropMermaidDiagram
        code={'sequenceDiagram\nAlice->>Bob: Hello'}
        panZoom={false}
        themeRevision="nord"
      />,
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 410));
    });

    expect(refresh).toHaveBeenCalledTimes(1);

    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
