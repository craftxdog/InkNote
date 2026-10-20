export const PLUGIN_KERNEL_ERROR_CODES = [
  'INVALID_PLUGIN_ID',
  'PLUGIN_ALREADY_ACTIVE',
  'PLUGIN_NOT_ACTIVE',
  'PLUGIN_LIFECYCLE_IN_PROGRESS',
  'PLUGIN_SCOPE_CLOSED',
  'INVALID_CONFIG_KEY',
  'CONFIG_SCHEMA_CONFLICT',
  'CONFIG_UNKNOWN_KEY',
  'INVALID_CONFIG_VALUE',
  'CONFIG_NOT_HYDRATED',
  'INVALID_COMMAND_ID',
  'INVALID_COMMAND_HANDLER',
  'INVALID_COMMAND_INVOCATION',
  'COMMAND_CONFLICT',
  'INVALID_KEY_BINDING',
] as const;

export type PluginKernelErrorCode = (typeof PLUGIN_KERNEL_ERROR_CODES)[number];

export class PluginKernelError extends Error {
  readonly code: PluginKernelErrorCode;

  constructor(code: PluginKernelErrorCode, message: string) {
    super(message);

    this.name = 'PluginKernelError';
    this.code = code;

    Object.freeze(this);
  }
}

export const createPluginKernelError = (
  code: PluginKernelErrorCode,
  message: string,
): PluginKernelError => new PluginKernelError(code, message);
