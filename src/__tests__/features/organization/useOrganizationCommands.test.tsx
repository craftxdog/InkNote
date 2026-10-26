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
import {
  organizationCommandIds,
  type OrganizationCommand,
} from '../../../renderer/features/organization/model/organizationCommands';

type OrganizationCommandHarnessProps = Readonly<{
  onCommand: (
    command: OrganizationCommand,
    invocation: { source: string; detail?: unknown },
  ) => void | Promise<void>;
  onReady?: (commands: OrganizationCommands) => void;
}>;

function OrganizationCommandHarness({
  onCommand,
  onReady,
}: OrganizationCommandHarnessProps) {
  const commands = useOrganizationCommands({ onCommand });

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
  it('routes menu and matching native shortcuts through typed note commands', async () => {
    const onCommand = jest.fn();

    render(<OrganizationCommandHarness onCommand={onCommand} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
    await waitFor(() =>
      expect(onCommand).toHaveBeenLastCalledWith(
        organizationCommandIds.createNote,
        { source: 'menu' },
      ),
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
      expect(onCommand).toHaveBeenLastCalledWith(
        organizationCommandIds.createNote,
        { source: 'keymap' },
      ),
    );

    const previewShortcut = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 'p',
    });
    window.dispatchEvent(previewShortcut);

    expect(previewShortcut.defaultPrevented).toBe(false);
    expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it('uses the latest callback without a duplicate plugin during Strict Mode reconnection', async () => {
    const firstOnCommand = jest.fn();
    const secondOnCommand = jest.fn();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const view = render(
        <StrictMode>
          <OrganizationCommandHarness onCommand={firstOnCommand} />
        </StrictMode>,
      );

      await act(async () => {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 0);
        });
      });

      fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
      await waitFor(() =>
        expect(firstOnCommand).toHaveBeenCalledWith(
          organizationCommandIds.createNote,
          { source: 'menu' },
        ),
      );

      view.rerender(
        <StrictMode>
          <OrganizationCommandHarness onCommand={secondOnCommand} />
        </StrictMode>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Create note' }));

      await waitFor(() =>
        expect(secondOnCommand).toHaveBeenCalledWith(
          organizationCommandIds.createNote,
          { source: 'menu' },
        ),
      );
      expect(firstOnCommand).toHaveBeenCalledTimes(1);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('does not dispatch a stale callback after cleanup completes', async () => {
    const onCommand = jest.fn();
    const onReady = jest.fn();
    const view = render(
      <OrganizationCommandHarness
        onCommand={onCommand}
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
    expect(onCommand).not.toHaveBeenCalled();
  });
});
