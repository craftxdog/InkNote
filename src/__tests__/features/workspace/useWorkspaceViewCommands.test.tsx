import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act, useState } from 'react';

import { useWorkspaceViewCommands } from '../../../renderer/features/workspace/hooks/useWorkspaceViewCommands';
import { workspaceViewCommandIds } from '../../../renderer/features/workspace/model/viewCommands';
import type { WorkspaceViewMode } from '../../../renderer/types/workspace';

function WorkspaceViewCommandHarness() {
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('editor');
  const { dispatchViewCommand } = useWorkspaceViewCommands({
    setViewMode,
  });

  return (
    <>
      <output aria-label="Current workspace view">{viewMode}</output>
      <button
        type="button"
        onClick={() =>
          void dispatchViewCommand(workspaceViewCommandIds.showPreview, 'menu')
        }
      >
        Show preview
      </button>
    </>
  );
}

describe('useWorkspaceViewCommands', () => {
  it('routes view buttons and documented shortcuts through the active runtime', async () => {
    render(<WorkspaceViewCommandHarness />);

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Show preview' }));
      expect(screen.getByLabelText('Current workspace view')).toHaveTextContent(
        'preview',
      );
    });

    const togglePreview = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 'e',
    });
    await act(async () => {
      window.dispatchEvent(togglePreview);
      await Promise.resolve();
    });
    expect(togglePreview.defaultPrevented).toBe(true);
    await waitFor(() =>
      expect(screen.getByLabelText('Current workspace view')).toHaveTextContent(
        'editor',
      ),
    );

    fireEvent.keyDown(window, { ctrlKey: true, key: 'p' });
    await waitFor(() =>
      expect(screen.getByLabelText('Current workspace view')).toHaveTextContent(
        'split',
      ),
    );
  });
});
