import { useCallback, useEffect, useState } from 'react';

import { unwrapNoteOrganizationIpcResult } from '../../../../shared/note-organization/noteOrganizationPreferences.ipc';
import {
  defaultNotebookPreference,
  validateDefaultNotebookPreference,
} from '../../../../shared/note-organization/noteOrganizationPreferences.types';

export type DefaultNotebookPreferenceRuntime = Readonly<{
  defaultNotebookId: string;
  isLoading: boolean;
  error: string | null;
  setDefaultNotebook: (notebookId: string) => Promise<void>;
}>;

/**
 * Owns the renderer side of the durable default-notebook preference. The
 * value is deliberately kept outside generic configuration so its validation
 * remains coupled to the notebook catalogue in the main process.
 */
export const useDefaultNotebookPreference =
  (): DefaultNotebookPreferenceRuntime => {
    const isOrganizationAvailable =
      window.inknote.noteOrganization !== undefined;
    const [defaultNotebookId, setDefaultNotebookId] = useState(
      () => defaultNotebookPreference().notebookId,
    );
    const [isLoading, setIsLoading] = useState(isOrganizationAvailable);
    const [error, setError] = useState<string | null>(
      isOrganizationAvailable
        ? null
        : 'Note organization preferences are unavailable in this build.',
    );

    useEffect(() => {
      let isCurrent = true;
      const organization = window.inknote.noteOrganization;

      if (organization === undefined) {
        return undefined;
      }

      const load = async (): Promise<void> => {
        try {
          const preference = unwrapNoteOrganizationIpcResult(
            await organization.getDefaultNotebook(),
            validateDefaultNotebookPreference,
          );

          if (!isCurrent) return;
          setDefaultNotebookId(preference.notebookId);
          setError(null);
        } catch (nextError) {
          if (isCurrent) setError(messageForPreferenceError(nextError));
        } finally {
          if (isCurrent) setIsLoading(false);
        }
      };

      void load();

      return () => {
        isCurrent = false;
      };
    }, []);

    const setDefaultNotebook = useCallback(
      async (notebookId: string): Promise<void> => {
        const organization = window.inknote.noteOrganization;

        if (organization === undefined) {
          const unavailable = new Error(
            'Note organization preferences are unavailable in this build.',
          );
          setError(unavailable.message);
          throw unavailable;
        }

        try {
          const preference = unwrapNoteOrganizationIpcResult(
            await organization.setDefaultNotebook(notebookId),
            validateDefaultNotebookPreference,
          );

          setDefaultNotebookId(preference.notebookId);
          setError(null);
        } catch (nextError) {
          const message = messageForPreferenceError(nextError);
          setError(message);
          throw new Error(message, { cause: nextError });
        }
      },
      [],
    );

    return Object.freeze({
      defaultNotebookId,
      isLoading,
      error,
      setDefaultNotebook,
    });
  };

const messageForPreferenceError = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : 'The default notebook preference could not be updated.';
