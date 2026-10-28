import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

import {
  useDefaultNotebookPreference,
  type DefaultNotebookPreferenceRuntime,
} from '../../../renderer/features/organization/hooks/useDefaultNotebookPreference';

function PreferenceHarness({
  onReady,
}: Readonly<{
  onReady: (runtime: DefaultNotebookPreferenceRuntime) => void;
}>) {
  const preference = useDefaultNotebookPreference();

  useEffect(() => onReady(preference), [onReady, preference]);

  return (
    <output aria-label="Default notebook preference">
      {preference.defaultNotebookId}:
      {preference.isLoading ? 'loading' : 'ready'}
    </output>
  );
}

describe('useDefaultNotebookPreference', () => {
  it('loads and persists the durable default notebook through the bridge', async () => {
    const getDefaultNotebook = jest
      .fn()
      .mockResolvedValue({ ok: true, value: { notebookId: 'work' } });
    const setDefaultNotebook = jest
      .fn()
      .mockResolvedValue({ ok: true, value: { notebookId: 'personal' } });
    Object.defineProperty(window, 'inknote', {
      configurable: true,
      value: {
        noteOrganization: { getDefaultNotebook, setDefaultNotebook },
      },
    });
    const onReady = jest.fn();

    render(<PreferenceHarness onReady={onReady} />);

    await waitFor(() =>
      expect(
        screen.getByLabelText('Default notebook preference'),
      ).toHaveTextContent('work:ready'),
    );

    const runtime = onReady.mock.calls.at(
      -1,
    )?.[0] as DefaultNotebookPreferenceRuntime;
    await act(async () => runtime.setDefaultNotebook('personal'));

    expect(setDefaultNotebook).toHaveBeenCalledWith('personal');
    expect(
      screen.getByLabelText('Default notebook preference'),
    ).toHaveTextContent('personal:ready');
  });

  it('keeps the prior preference when persistence rejects the selected notebook', async () => {
    const getDefaultNotebook = jest
      .fn()
      .mockResolvedValue({ ok: true, value: { notebookId: 'inbox' } });
    const setDefaultNotebook = jest.fn().mockResolvedValue({
      ok: false,
      error: {
        message: 'Default notebook must exist before it can be selected.',
      },
    });
    Object.defineProperty(window, 'inknote', {
      configurable: true,
      value: {
        noteOrganization: { getDefaultNotebook, setDefaultNotebook },
      },
    });
    const onReady = jest.fn();

    render(<PreferenceHarness onReady={onReady} />);

    await waitFor(() =>
      expect(
        screen.getByLabelText('Default notebook preference'),
      ).toHaveTextContent('inbox:ready'),
    );

    const runtime = onReady.mock.calls.at(
      -1,
    )?.[0] as DefaultNotebookPreferenceRuntime;
    await act(async () => {
      await expect(runtime.setDefaultNotebook('missing')).rejects.toThrow(
        'Default notebook must exist before it can be selected.',
      );
    });

    expect(
      screen.getByLabelText('Default notebook preference'),
    ).toHaveTextContent('inbox:ready');
  });
});
