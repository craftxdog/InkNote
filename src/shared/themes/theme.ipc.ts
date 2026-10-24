import {
  validateThemeAppearanceSettings,
  validateThemeDescriptor,
  validateThemeStyles,
  type ThemeAppearanceSettings,
  type ThemeDescriptor,
  type ThemeStyles,
} from './theme.types';

export type ThemeIpcResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: Readonly<{ message: string }> }>;

export const runThemeIpcOperation = async <T>(
  operation: () => T | Promise<T>,
): Promise<ThemeIpcResult<T>> => {
  try {
    return Object.freeze({ ok: true, value: await operation() });
  } catch (error) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        message:
          error instanceof Error
            ? error.message
            : 'The theme operation could not be completed.',
      }),
    });
  }
};

export const unwrapThemeIpcResult = <T>(
  candidate: unknown,
  decodeValue: (value: unknown) => T,
): T => {
  if (!isRecord(candidate)) {
    throw new Error('The theme operation returned an invalid response.');
  }

  if (candidate.ok === true && Object.hasOwn(candidate, 'value')) {
    try {
      return decodeValue(candidate.value);
    } catch {
      throw new Error('The theme operation returned an invalid response.');
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

  throw new Error('The theme operation returned an invalid response.');
};

export const validateThemeList = (
  value: unknown,
): readonly ThemeDescriptor[] => {
  if (!Array.isArray(value)) {
    throw new Error('The theme response has an invalid list.');
  }

  return Object.freeze(value.map(validateThemeDescriptor));
};

export const validateThemeStylesResponse = (value: unknown): ThemeStyles =>
  validateThemeStyles(value);

export const validateThemeAppearanceResponse = (
  value: unknown,
): ThemeAppearanceSettings => validateThemeAppearanceSettings(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
