import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode, useEffect } from 'react';

import {
  useOrganizationCommands,
  type OrganizationCommands,
} from '../../../renderer/features/organization/hooks/useOrganizationCommands';
import { organizationCommandIds } from '../../../renderer/features/organization/model/organizationCommands';

type OrganizationCommandHarnessProps = Readonly<{
  onCreateNote: () => void | Promise<void>;
  onReady?: (commands: OrganizationCommands) => void;
}>;

function OrganizationCommandHarness({
  onCreateNote,
  onReady,
}: OrganizationCommandHarnessProps) {
  const commands = useOrganizationCommands({ onCreateNote });

  useEffect(() => {
    onReady?.(commands);
  }, [commands, onReady]);

  return (
    <button
      type="button"
      onClick={() =>
        void commands.dispatchOrganizationCommand(
          organizationCommandIds.createNote,
          'menu',
        )
      }
    >
      Create note
    </button>
  );
}

describe('useOrganizationCommands', () => {
  it('routes menu and matching native shortcuts through note:new only', async () => {
    const onCreateNote = jest.fn();

    render(<OrganizationCommandHarness onCreateNote={onCreateNote} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
    await waitFor(() =>
      expect(onCreateNote).toHaveBeenLastCalledWith({ source: 'menu' }),
    );

    const createShortcut = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 'n',
    });
    await act(async () => {
      window.dispatchEvent(createShortcut);
      await Promise.resolve();
    });
    expect(createShortcut.defaultPrevented).toBe(true);
    await waitFor(() =>
      expect(onCreateNote).toHaveBeenLastCalledWith({ source: 'keymap' }),
    );

    const previewShortcut = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 'p',
    });
    window.dispatchEvent(previewShortcut);

    expect(previewShortcut.defaultPrevented).toBe(false);
    expect(onCreateNote).toHaveBeenCalledTimes(2);
  });

  it('uses the latest callback without a duplicate plugin during Strict Mode reconnection', async () => {
    const firstCreateNote = jest.fn();
    const secondCreateNote = jest.fn();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const view = render(
        <StrictMode>
          <OrganizationCommandHarness onCreateNote={firstCreateNote} />
        </StrictMode>,
      );

      await act(async () => {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 0);
        });
      });

      fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
      await waitFor(() =>
        expect(firstCreateNote).toHaveBeenCalledWith({ source: 'menu' }),
      );

      view.rerender(
        <StrictMode>
          <OrganizationCommandHarness onCreateNote={secondCreateNote} />
        </StrictMode>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Create note' }));

      await waitFor(() =>
        expect(secondCreateNote).toHaveBeenCalledWith({ source: 'menu' }),
      );
      expect(firstCreateNote).toHaveBeenCalledTimes(1);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('does not dispatch a stale callback after cleanup completes', async () => {
    const onCreateNote = jest.fn();
    const onReady = jest.fn();
    const view = render(
      <OrganizationCommandHarness
        onCreateNote={onCreateNote}
        onReady={onReady}
      />,
    );

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    const commands = onReady.mock.calls[0][0] as OrganizationCommands;
    view.unmount();

    await expect(
      commands.dispatchOrganizationCommand(
        organizationCommandIds.createNote,
        'api',
      ),
    ).resolves.toBe(false);
    expect(onCreateNote).not.toHaveBeenCalled();
  });
});
