export type NoteOrganizationIpcResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: Readonly<{ message: string }> }>;

export const runNoteOrganizationIpcOperation = async <T>(
  operation: () => T | Promise<T>,
): Promise<NoteOrganizationIpcResult<T>> => {
  try {
    return Object.freeze({ ok: true, value: await operation() });
  } catch (error) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        message:
          error instanceof Error
            ? error.message
            : 'The note organization operation could not be completed.',
      }),
    });
  }
};

export const unwrapNoteOrganizationIpcResult = <T>(
  candidate: unknown,
  decodeValue: (value: unknown) => T,
): T => {
  if (!isRecord(candidate)) {
    throw new Error(
      'The note organization operation returned an invalid response.',
    );
  }

  if (candidate.ok === true && Object.hasOwn(candidate, 'value')) {
    try {
      return decodeValue(candidate.value);
    } catch {
      throw new Error(
        'The note organization operation returned an invalid response.',
      );
    }
  }

  if (
    candidate.ok === false &&
    isRecord(candidate.error) &&
    typeof candidate.error.message === 'string' &&
    candidate.error.message.length > 0
  ) {
    throw new Error(candidate.error.message);
  }

  throw new Error(
    'The note organization operation returned an invalid response.',
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
